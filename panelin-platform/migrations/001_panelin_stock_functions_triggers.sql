-- Panelin BMC Platform v1 — Stock integrity functions + triggers
-- Robust upserts, negative stock prevention, automatic low-stock alerts, price recalc helpers.

-- Helper: updated_at trigger (reusable)
create or replace function panelin_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach updated_at triggers to relevant tables (idempotent via drop/create)
drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated
  before update on products
  for each row execute function panelin_set_updated_at();

drop trigger if exists trg_product_prices_updated on product_prices;
create trigger trg_product_prices_updated
  before update on product_prices
  for each row execute function panelin_set_updated_at();

drop trigger if exists trg_stock_updated on stock;
create trigger trg_stock_updated
  before update on stock
  for each row execute function panelin_set_updated_at();

drop trigger if exists trg_stock_thresholds_updated on stock_thresholds;
create trigger trg_stock_thresholds_updated
  before update on stock_thresholds
  for each row execute function panelin_set_updated_at();

-- ============================================================
-- Core: robust stock movement recorder (prevents negative stock)
-- ============================================================
create or replace function panelin_record_stock_movement(
  p_sku text,
  p_deposito text,
  p_delta numeric,
  p_reason text default 'manual',
  p_ref_type text default null,
  p_ref_id text default null,
  p_created_by text default null
) returns stock_movements as $$
declare
  v_current numeric;
  v_new numeric;
  v_row stock_movements;
begin
  if p_sku is null or p_deposito is null or p_delta is null then
    raise exception 'panelin: sku, deposito and delta are required';
  end if;

  -- Lock/ensure stock row exists
  insert into stock (sku, deposito, qty, last_movement_at)
  values (p_sku, p_deposito, 0, now())
  on conflict (sku, deposito) do update set sku = excluded.sku
  returning qty into v_current;

  -- Re-fetch under lock for safety in concurrent scenarios
  select qty into v_current
  from stock
  where sku = p_sku and deposito = p_deposito
  for update;

  v_new := coalesce(v_current, 0) + p_delta;

  if v_new < 0 then
    raise exception 'panelin: stock_negativo (sku=%, deposito=%, current=%, delta=%, would_be=%)',
      p_sku, p_deposito, v_current, p_delta, v_new
      using hint = 'Use a positive delta for entries or reduce outgoing quantity';
  end if;

  -- Apply to snapshot
  update stock
  set qty = v_new,
      last_movement_at = now()
  where sku = p_sku and deposito = p_deposito;

  -- Record the movement (qty_after is the result after this delta)
  insert into stock_movements (
    sku, deposito, delta, qty_after, reason, ref_type, ref_id, created_by
  ) values (
    p_sku, p_deposito, p_delta, v_new, p_reason, p_ref_type, p_ref_id, p_created_by
  )
  returning * into v_row;

  -- Fire low-stock alert if applicable (idempotent-ish: only if no open alert in last 10min for same sku/dep)
  perform panelin_maybe_create_stock_alert(p_sku, p_deposito, v_new);

  return v_row;
end;
$$ language plpgsql;

-- ============================================================
-- Low stock alert generator (called from movement function)
-- ============================================================
create or replace function panelin_maybe_create_stock_alert(
  p_sku text,
  p_deposito text,
  p_current_qty numeric
) returns void as $$
declare
  v_threshold numeric;
  v_has_open boolean;
begin
  -- Get threshold (default 0 means "no alert" unless set)
  select min_qty into v_threshold
  from stock_thresholds
  where sku = p_sku and deposito = p_deposito;

  if v_threshold is null or v_threshold <= 0 then
    return;
  end if;

  if p_current_qty >= v_threshold then
    return;
  end if;

  -- Avoid spam: check for unresolved alert in last 15 minutes for same (sku,deposito)
  select exists (
    select 1 from stock_alerts
    where sku = p_sku
      and deposito = p_deposito
      and acknowledged = false
      and created_at > now() - interval '15 minutes'
  ) into v_has_open;

  if v_has_open then
    return;
  end if;

  insert into stock_alerts (sku, deposito, current_qty, threshold, severity)
  values (
    p_sku,
    p_deposito,
    p_current_qty,
    v_threshold,
    case when p_current_qty <= (v_threshold * 0.5) then 'critical' else 'low' end
  );
end;
$$ language plpgsql;

-- ============================================================
-- Upsert product + optional price recalc
-- ============================================================
create or replace function panelin_upsert_product(
  p_sku text,
  p_name text,
  p_cost_usd numeric default null,
  p_unit text default null,
  p_category text default null,
  p_active boolean default true,
  p_meta jsonb default null
) returns products as $$
declare
  v_row products;
begin
  if p_sku is null or p_name is null then
    raise exception 'panelin: sku and name are required for upsert_product';
  end if;

  insert into products (sku, name, cost_usd, unit, category, active, meta)
  values (
    p_sku,
    p_name,
    coalesce(p_cost_usd, 0),
    coalesce(p_unit, 'unid'),
    p_category,
    p_active,
    coalesce(p_meta, '{}'::jsonb)
  )
  on conflict (sku) do update set
    name = excluded.name,
    cost_usd = coalesce(p_cost_usd, products.cost_usd),
    unit = coalesce(p_unit, products.unit),
    category = coalesce(p_category, products.category),
    active = p_active,
    meta = coalesce(p_meta, products.meta)
  returning * into v_row;

  -- If cost changed we leave price recalc to explicit call (or backend) for auditability.
  -- App can call panelin_recalc_prices_for_sku(p_sku) after PATCH cost.

  return v_row;
end;
$$ language plpgsql;

-- ============================================================
-- Price recalculation based on cost + margin of price_list
-- ============================================================
create or replace function panelin_recalc_prices_for_sku(p_sku text)
returns int as $$
declare
  v_cost numeric;
  v_count int := 0;
  r record;
begin
  select cost_usd into v_cost from products where sku = p_sku;
  if v_cost is null then
    raise exception 'panelin: product % not found for price recalc', p_sku;
  end if;

  for r in
    select pl.id as price_list_id, pl.margin_pct
    from price_lists pl
    where pl.active = true
  loop
    insert into product_prices (sku, price_list_id, price_usd, source)
    values (
      p_sku,
      r.price_list_id,
      round(v_cost * (1 + r.margin_pct / 100.0), 2),
      'recalc'
    )
    on conflict (sku, price_list_id) do update set
      price_usd = excluded.price_usd,
      source = 'recalc',
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql;

-- ============================================================
-- Convenience: set threshold (upsert)
-- ============================================================
create or replace function panelin_set_stock_threshold(
  p_sku text,
  p_deposito text,
  p_min_qty numeric
) returns stock_thresholds as $$
declare
  v_row stock_thresholds;
begin
  insert into stock_thresholds (sku, deposito, min_qty)
  values (p_sku, coalesce(p_deposito, 'principal'), coalesce(p_min_qty, 0))
  on conflict (sku, deposito) do update set
    min_qty = excluded.min_qty,
    updated_at = now()
  returning * into v_row;

  -- Immediately evaluate current stock (may create alert)
  perform panelin_maybe_create_stock_alert(p_sku, coalesce(p_deposito, 'principal'),
    (select qty from stock where sku = p_sku and deposito = coalesce(p_deposito, 'principal'))
  );

  return v_row;
end;
$$ language plpgsql;

-- ============================================================
-- Optional: view for convenient "product with prices + stock"
-- (not a table, but very useful for API)
-- ============================================================
create or replace view panelin_products_full as
select
  p.sku,
  p.name,
  p.description,
  p.unit,
  p.category,
  p.cost_usd,
  p.active,
  p.meta,
  p.created_at as product_created_at,
  p.updated_at as product_updated_at,
  pl.code as price_list_code,
  pl.name as price_list_name,
  pp.price_usd as price_usd,
  pp.source as price_source,
  s.deposito,
  s.qty as stock_qty,
  s.last_movement_at,
  st.min_qty as threshold_min_qty,
  (s.qty < coalesce(st.min_qty, 0)) as below_threshold
from products p
left join product_prices pp on pp.sku = p.sku
left join price_lists pl on pl.id = pp.price_list_id
left join stock s on s.sku = p.sku
left join stock_thresholds st on st.sku = p.sku and st.deposito = coalesce(s.deposito, 'principal')
order by p.sku, pl.code, s.deposito;
