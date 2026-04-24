(function () {
  const API_BASE = '';
  let proximasEntregas = [];
  let auditData = [];
  let financialSnapshot = emptyFinancialSnapshot();
  let currentCurrency = '';
  let breakdownFilter = 'esta_semana';
  let ventasData = [];
  let ventasProveedorFilter = '';
  let stockData = [];
  let stockKpi = { bajoStock: 0, totalProductos: 0, valorInventario: 0 };

  function emptyFinancialSnapshot() {
    return {
      pendingPayments: [],
      calendar: [],
      byPeriod: {},
      byCurrency: {},
      currencies: [],
      metas: [],
    };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function showToast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 250);
    }, 2500);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  const INVOQUE_PANEL_MODEL = {
    blocks: [
      {
        title: 'Qué cubre esta interfaz',
        items: [
          { label: 'Inicio / KPI report', detail: 'snapshot ejecutivo (pagos, entregas, stock, meta).' },
          { label: 'Finanzas', detail: 'KPIs por moneda, tendencia de vencimientos y tabla de pagos pendientes.' },
          { label: 'Calendario', detail: 'vencimientos en lectura desde hoja.' },
          { label: 'Operaciones', detail: 'próximas entregas, mensaje de coordinación y marcar entregado.' },
          { label: 'Metas, Audit, Ventas 2.0, Stock', detail: 'tablas de apoyo y export CSV donde aplica.' },
        ],
      },
      {
        title: 'API que puebla app.js',
        lead: 'Mismo origen que la página (API_BASE vacío = rutas relativas). Lectura salvo donde se indica.',
        apiList: [
          { method: 'GET', path: '/api/kpi-report', detail: 'KPI inicio.' },
          { method: 'GET', path: '/api/kpi-financiero', detail: 'resumen financiero, tendencia, breakdown, metas.' },
          { method: 'GET', path: '/api/calendario-vencimientos', detail: 'calendario de vencimientos.' },
          { method: 'GET', path: '/api/proximas-entregas', detail: 'entregas de la semana.' },
          { method: 'GET', path: '/api/coordinacion-logistica', detail: 'texto para WhatsApp (opcional ?ids=).' },
          { method: 'POST', path: '/api/marcar-entregado', detail: 'marca entrega (cotizacionId, comentarios opcionales).' },
          { method: 'GET', path: '/api/audit', detail: 'audit log.' },
          { method: 'GET', path: '/api/ventas', detail: 'ventas 2.0.' },
          { method: 'GET', path: '/api/stock-ecommerce', detail: 'inventario de stock.' },
          { method: 'GET', path: '/api/stock-kpi', detail: 'KPIs de stock.' },
          { method: 'GET', path: '/api/wolfboard/pendientes', detail: 'Wolfboard: consultas pendientes Admin 2.0 (H–K).' },
          { method: 'GET', path: '/api/wolfboard/pipeline', detail: 'Wolfboard: estado env + mapping + auditoría ML↔CRM.' },
          { method: 'POST', path: '/api/wolfboard/sync', detail: 'sync bidireccional Admin ↔ CRM.' },
          { method: 'POST', path: '/api/wolfboard/row', detail: 'guardar I/J y CRM AF/AH/G; aprobado → AI.' },
          { method: 'POST', path: '/api/wolfboard/presupuesto', detail: 'P0: driveUrl + adminRow → columna J + CRM.' },
          { method: 'POST', path: '/api/wolfboard/batch', detail: 'lote máx. 30 filas presupuesto/link → CRM.' },
          { method: 'GET', path: '/api/wolfboard/export', detail: 'CSV export Wolfboard.' },
          { method: 'POST', path: '/api/wolfboard/enviados', detail: 'K → pestaña Enviados (force: true).' },
        ],
        hint: 'Desarrollo: con ?dev=1 en la URL, GET /api/dev/dashboard-mtime puede disparar recarga al cambiar estos archivos estáticos.',
      },
      {
        title: 'Planillas Google Sheets (origen de negocio)',
        lead: 'El servidor lee las pestañas configuradas en backend; esta UI solo las consume vía API.',
        sheets: [
          'Pagos_Pendientes',
          'Metas_Ventas',
          'Master_Cotizaciones',
          'AUDIT_LOG',
          '2.0 Ventas',
          'Stock E-Commerce',
        ],
      },
      {
        title: 'Fuera de esta página',
        muted: true,
        hint: 'Calculadora cotizaciones, chat Panelin y Evolution viewer son otros frontends; ver docs/team/INVOQUE-PANELIN-ESTADO.md. El enlace Cotizaciones del menú apunta al dev local de la calculadora.',
      },
    ],
  };

  function renderInvoqueBlock(block) {
    const className = 'invoque-block' + (block.muted ? ' invoque-block--muted' : '');
    let html = '<div class="' + className + '">';
    html += '<h3 class="invoque-subhead">' + escapeHtml(block.title || '') + '</h3>';

    if (block.lead) {
      html += '<p class="invoque-lead">' + escapeHtml(block.lead) + '</p>';
    }

    if (Array.isArray(block.items) && block.items.length) {
      html += '<ul class="invoque-list">';
      html += block.items.map(function (item) {
        const label = escapeHtml(item.label || '');
        const detail = escapeHtml(item.detail || '');
        return '<li><strong>' + label + '</strong> — ' + detail + '</li>';
      }).join('');
      html += '</ul>';
    }

    if (Array.isArray(block.apiList) && block.apiList.length) {
      html += '<ul class="invoque-list invoque-list--api">';
      html += block.apiList.map(function (row) {
        const method = escapeHtml(row.method || 'GET');
        const path = escapeHtml(row.path || '');
        const detail = escapeHtml(row.detail || '');
        return '<li><code>' + method + ' ' + path + '</code>' + (detail ? ' — ' + detail : '') + '</li>';
      }).join('');
      html += '</ul>';
    }

    if (Array.isArray(block.sheets) && block.sheets.length) {
      html += '<p class="invoque-sheets">' + block.sheets.map(escapeHtml).join(' · ') + '</p>';
    }

    if (block.hint) {
      const hintClass = block.apiList ? 'invoque-hint invoque-hint--tight' : 'invoque-hint';
      html += '<p class="' + hintClass + '">' + escapeHtml(block.hint) + '</p>';
    }

    html += '</div>';
    return html;
  }

  function renderInvoquePanel() {
    const panel = byId('invoquePanel');
    if (!panel) return;
    panel.innerHTML = (INVOQUE_PANEL_MODEL.blocks || []).map(renderInvoqueBlock).join('');
  }

  function normalizeCurrency(value) {
    const currency = String(value || '$').trim();
    return currency || '$';
  }

  function setLastRefresh(success) {
    const el = byId('lastRefresh');
    if (!el) return;
    const stamp = new Date().toLocaleTimeString('es-UY');
    el.textContent = success ? 'Actualizado ' + stamp : 'Sin actualizar - ' + stamp;
  }

  function setStateBanner(state, message) {
    const banner = byId('stateBanner');
    const label = byId('stateBannerLabel');
    const text = byId('stateBannerText');
    const retry = byId('btnRetry');
    if (!banner || !label || !text) return;

    if (!state || state === 'idle') {
      banner.hidden = true;
      banner.dataset.state = 'idle';
      if (retry) retry.hidden = true;
      return;
    }

    const labels = {
      loading: 'Cargando',
      empty: 'Sin datos',
      error: 'No disponible',
    };

    banner.hidden = false;
    banner.dataset.state = state;
    label.textContent = labels[state] || 'Estado';
    text.textContent = message || '';
    if (retry) retry.hidden = state === 'loading';
  }

  function clearStateBanner() {
    setStateBanner('idle', '');
  }

  async function readJsonResponse(res, fallbackMessage) {
    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      payload = null;
    }

    if (!res.ok) {
      throw new Error((payload && payload.error) || fallbackMessage);
    }
    if (payload && payload.ok === false) {
      throw new Error(payload.error || fallbackMessage);
    }
    return payload || {};
  }

  async function fetchProximasEntregas() {
    const res = await fetch(API_BASE + '/api/proximas-entregas');
    const json = await readJsonResponse(res, 'Error al cargar proximas entregas');
    return json.data || [];
  }

  async function fetchCoordinacionLogistica(ids) {
    const url = ids && ids.length
      ? API_BASE + '/api/coordinacion-logistica?ids=' + encodeURIComponent(ids.join(','))
      : API_BASE + '/api/coordinacion-logistica';
    const res = await fetch(url);
    const json = await readJsonResponse(res, 'Error al generar mensaje de coordinacion');
    return json.text || '';
  }

  async function fetchKpiFinanciero() {
    const res = await fetch(API_BASE + '/api/kpi-financiero');
    return readJsonResponse(res, 'Error al cargar datos financieros');
  }

  async function fetchAudit() {
    const res = await fetch(API_BASE + '/api/audit');
    const json = await readJsonResponse(res, 'Error al cargar audit log');
    return json.data || [];
  }

  async function fetchVentas() {
    const res = await fetch(API_BASE + '/api/ventas');
    const json = await readJsonResponse(res, 'Error al cargar ventas');
    return json.data || [];
  }

  async function fetchCalendarioVencimientos() {
    const res = await fetch(API_BASE + '/api/calendario-vencimientos');
    const json = await readJsonResponse(res, 'Error al cargar calendario de vencimientos');
    return { headers: json.headers || [], data: json.data || [] };
  }

  async function fetchStockEcommerce() {
    const res = await fetch(API_BASE + '/api/stock-ecommerce');
    const json = await readJsonResponse(res, 'Error al cargar stock');
    return json.data || [];
  }

  async function fetchStockKpi() {
    const res = await fetch(API_BASE + '/api/stock-kpi');
    const json = await readJsonResponse(res, 'Error al cargar KPIs de stock');
    return json;
  }

  async function fetchKpiReport() {
    const res = await fetch(API_BASE + '/api/kpi-report');
    return readJsonResponse(res, 'Error al cargar KPI Report');
  }

  function parseDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getStartOfWeek(baseDate) {
    const date = new Date(baseDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getEndOfWeek(baseDate) {
    const end = getStartOfWeek(baseDate);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return value || '-';
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatShortDate(value) {
    const date = parseDate(value);
    if (!date) return value || '-';
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return value || '-';
    return date.toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatPhone(value) {
    if (!value) return '-';
    const text = String(value).trim();
    return text || '-';
  }

  function formatMoney(value, currency) {
    if (value == null || value === '' || Number.isNaN(Number(value))) return '-';
    return normalizeCurrency(currency) + ' ' + Number(value).toLocaleString('es-UY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function formatCompactNumber(value) {
    return Number(value || 0).toLocaleString('es-UY', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }

  function normalizeFinancialSnapshot(payload) {
    return {
      pendingPayments: Array.isArray(payload.pendingPayments) ? payload.pendingPayments : [],
      calendar: Array.isArray(payload.calendar) ? payload.calendar : [],
      byPeriod: payload.byPeriod || {},
      byCurrency: payload.byCurrency || {},
      currencies: Array.isArray(payload.currencies) ? payload.currencies : [],
      metas: Array.isArray(payload.metas) ? payload.metas : [],
    };
  }

  function getCurrencyKeys(snapshot) {
    const set = new Set();
    (snapshot.currencies || []).forEach((currency) => set.add(normalizeCurrency(currency)));
    Object.keys(snapshot.byCurrency || {}).forEach((currency) => set.add(normalizeCurrency(currency)));
    (snapshot.pendingPayments || []).forEach((row) => set.add(normalizeCurrency(row.MONEDA)));
    (snapshot.calendar || []).forEach((point) => {
      Object.keys(point.byCurrency || {}).forEach((currency) => set.add(normalizeCurrency(currency)));
    });
    return Array.from(set).filter(Boolean).sort(function (left, right) {
      if (left === '$') return -1;
      if (right === '$') return 1;
      return left.localeCompare(right, 'es');
    });
  }

  function hasFinancialData(snapshot) {
    return Boolean(
      getCurrencyKeys(snapshot).length ||
      (snapshot.pendingPayments || []).length ||
      (snapshot.calendar || []).length
    );
  }

  function chooseDefaultCurrency(currencies) {
    if (!currencies.length) return '';
    return currencies.indexOf('$') !== -1 ? '$' : currencies[0];
  }

  function updateCurrencySelector(currencies) {
    const select = byId('currencySelect');
    if (!select) return;

    if (!currencies.length) {
      select.innerHTML = '<option value="">Sin datos</option>';
      select.disabled = true;
      return;
    }

    select.innerHTML = currencies
      .map(function (currency) {
        const selected = currency === currentCurrency ? ' selected' : '';
        return '<option value="' + escapeHtml(currency) + '"' + selected + '>' + escapeHtml(currency) + '</option>';
      })
      .join('');
    select.disabled = false;
    select.value = currentCurrency;
  }

  function setKpiValue(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setFinancialKpis(summary, currency) {
    if (!summary || !currency) {
      setKpiValue('kpiTotal', '-');
      setKpiValue('kpiEstaSemana', '-');
      setKpiValue('kpiProximaSemana', '-');
      setKpiValue('kpiEsteMes', '-');
      return;
    }
    setKpiValue('kpiTotal', formatMoney(summary.total, currency));
    setKpiValue('kpiEstaSemana', formatMoney(summary.estaSemana, currency));
    setKpiValue('kpiProximaSemana', formatMoney(summary.proximaSemana, currency));
    setKpiValue('kpiEsteMes', formatMoney(summary.esteMes, currency));
  }

  function setTableMessage(tbodyId, colspan, message, isLoading) {
    const tbody = byId(tbodyId);
    if (!tbody) return;
    const cls = isLoading ? 'empty skeleton-pulse' : 'empty';
    tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="' + cls + '">' + escapeHtml(message) + '</td></tr>';
  }

  function setSectionLoading(sectionId, loading) {
    const section = byId(sectionId);
    if (!section) return;
    if (loading) {
      section.classList.add('section-loading');
    } else {
      section.classList.remove('section-loading');
    }
  }

  function renderPreview(text, allowCopy) {
    const preview = byId('previewWhatsApp');
    const button = byId('btnCopyPreview');
    if (preview) preview.textContent = text;
    if (button) button.disabled = !allowCopy;
  }

  function setLogisticaButtonsEnabled(enabled) {
    const copyAll = byId('btnCopyAllWhatsApp');
    const copyPreview = byId('btnCopyPreview');
    if (copyAll) copyAll.disabled = !enabled;
    if (copyPreview && !enabled) copyPreview.disabled = true;
  }

  function renderTrendPlaceholder(message, isLoading) {
    const empty = byId('trendEmpty');
    const chart = byId('trendChart');
    const chip = byId('trendCurrencyChip');
    const caption = byId('trendCaption');

    if (chart) {
      chart.hidden = true;
      chart.innerHTML = '';
    }
    if (empty) {
      empty.hidden = false;
      empty.textContent = message;
      empty.classList.toggle('skeleton-pulse', !!isLoading);
    }
    if (chip) chip.textContent = currentCurrency || 'Sin moneda';
    if (caption) caption.textContent = message;
  }

  function getTrendSeries(snapshot, currency) {
    if (!currency) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = (snapshot.calendar || [])
      .map(function (point) {
        const parsedDate = parseDate(point.date);
        const byCurrency = point.byCurrency || {};
        const value = Number(byCurrency[currency] != null ? byCurrency[currency] : point[currency]) || 0;
        return {
          date: point.date,
          parsedDate: parsedDate,
          value: value,
        };
      })
      .filter(function (point) {
        return point.parsedDate;
      })
      .sort(function (left, right) {
        return left.parsedDate.getTime() - right.parsedDate.getTime();
      });

    const future = sorted.filter(function (point) {
      return point.parsedDate.getTime() >= today.getTime() && point.value > 0;
    });

    if (future.length) return future.slice(0, 8);
    return sorted.filter(function (point) { return point.value > 0; }).slice(0, 8);
  }

  function renderTrend(snapshot) {
    const chart = byId('trendChart');
    const empty = byId('trendEmpty');
    const chip = byId('trendCurrencyChip');
    const caption = byId('trendCaption');

    if (chip) chip.textContent = currentCurrency || 'Sin moneda';

    if (!currentCurrency) {
      renderTrendPlaceholder('Selecciona una moneda para ver la tendencia.');
      return;
    }

    const series = getTrendSeries(snapshot, currentCurrency);
    if (!series.length) {
      renderTrendPlaceholder('No hay vencimientos proximos para ' + currentCurrency + '.');
      return;
    }

    const width = 880;
    const height = 280;
    const margin = { top: 22, right: 18, bottom: 54, left: 44 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const slotWidth = chartWidth / series.length;
    const barWidth = Math.min(74, slotWidth * 0.58);
    const maxValue = Math.max.apply(null, series.map(function (point) { return point.value; }).concat([1]));
    const gridSteps = 4;

    const grid = [];
    for (let i = 0; i <= gridSteps; i += 1) {
      const ratio = i / gridSteps;
      const y = margin.top + chartHeight - ratio * chartHeight;
      const value = maxValue * ratio;
      grid.push(
        '<line class="trend-grid-line" x1="' + margin.left + '" y1="' + y + '" x2="' + (width - margin.right) + '" y2="' + y + '"></line>' +
        '<text class="trend-axis-label" x="' + (margin.left - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + escapeHtml(formatCompactNumber(value)) + '</text>'
      );
    }

    const bars = series.map(function (point, index) {
      const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
      const barHeight = Math.max((point.value / maxValue) * chartHeight, 6);
      const y = margin.top + chartHeight - barHeight;
      const valueLabel = point.value > 0 ? (
        '<text class="trend-value-label" x="' + (x + barWidth / 2) + '" y="' + (y - 8) + '" text-anchor="middle">' +
        escapeHtml(formatCompactNumber(point.value)) +
        '</text>'
      ) : '';

      return (
        '<rect class="trend-bar-bar-shadow" x="' + x + '" y="' + margin.top + '" width="' + barWidth + '" height="' + chartHeight + '" rx="10"></rect>' +
        '<rect class="trend-bar" x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" rx="10"></rect>' +
        valueLabel +
        '<text class="trend-label" x="' + (x + barWidth / 2) + '" y="' + (height - 18) + '" text-anchor="middle">' + escapeHtml(formatShortDate(point.date)) + '</text>'
      );
    }).join('');

    chart.innerHTML =
      '<line class="trend-axis" x1="' + margin.left + '" y1="' + (margin.top + chartHeight) + '" x2="' + (width - margin.right) + '" y2="' + (margin.top + chartHeight) + '"></line>' +
      grid.join('') +
      bars;
    chart.hidden = false;
    if (empty) empty.hidden = true;
    if (caption) {
      caption.textContent = series.length + ' fechas visibles para ' + currentCurrency + '.';
    }
  }

  function derivePaymentStatus(dateValue) {
    const parsed = parseDate(dateValue);
    if (!parsed) {
      return { label: 'Sin fecha', className: 'status-pill--muted' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = getEndOfWeek(today);

    if (parsed.getTime() < today.getTime()) {
      return { label: 'Vencido', className: 'status-pill--late' };
    }
    if (parsed.getTime() <= endOfWeek.getTime()) {
      return { label: 'Esta semana', className: 'status-pill--current' };
    }
    return { label: 'Proxima semana', className: 'status-pill--upcoming' };
  }

  function comparePayments(left, right) {
    const leftDate = parseDate(left.FECHA_VENCIMIENTO);
    const rightDate = parseDate(right.FECHA_VENCIMIENTO);
    if (leftDate && rightDate) return leftDate.getTime() - rightDate.getTime();
    if (leftDate) return -1;
    if (rightDate) return 1;
    return String(left.CLIENTE_NOMBRE || '').localeCompare(String(right.CLIENTE_NOMBRE || ''), 'es');
  }

  function applyBreakdownFilter(rows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = getEndOfWeek(today);
    if (breakdownFilter === 'esta_semana') {
      return rows.filter(function (row) {
        const d = parseDate(row.FECHA_VENCIMIENTO);
        return d && d.getTime() >= today.getTime() && d.getTime() <= endOfWeek.getTime();
      });
    }
    if (breakdownFilter === 'vencidos') {
      return rows.filter(function (row) {
        const d = parseDate(row.FECHA_VENCIMIENTO);
        return d && d.getTime() < today.getTime();
      });
    }
    return rows;
  }

  function renderBreakdown(snapshot) {
    const amountLabel = byId('breakdownAmountLabel');
    const description = byId('breakdownDescription');
    const filtersEl = byId('breakdownFilters');

    if (amountLabel) {
      amountLabel.textContent = currentCurrency ? 'Monto (' + currentCurrency + ')' : 'Monto';
    }

    if (!currentCurrency) {
      setTableMessage('tbodyBreakdown', 5, 'No hay moneda disponible para mostrar el detalle.');
      if (description) {
        description.textContent = 'Selecciona una moneda para inspeccionar el detalle.';
      }
      if (filtersEl) filtersEl.style.display = 'none';
      return;
    }

    const allRows = (snapshot.pendingPayments || [])
      .filter(function (row) {
        return normalizeCurrency(row.MONEDA) === currentCurrency;
      })
      .slice()
      .sort(comparePayments);

    if (filtersEl) {
      filtersEl.style.display = allRows.length ? 'flex' : 'none';
      Array.prototype.forEach.call(filtersEl.querySelectorAll('.filter-chip'), function (btn) {
        btn.classList.toggle('active', btn.dataset.filter === breakdownFilter);
      });
    }

    const rows = applyBreakdownFilter(allRows);

    if (description) {
      description.textContent = allRows.length
        ? (breakdownFilter === 'todos' ? allRows.length : rows.length) + ' pagos pendientes en ' + currentCurrency + ' (' + (breakdownFilter === 'esta_semana' ? 'esta semana' : breakdownFilter === 'vencidos' ? 'vencidos' : 'todos') + ').'
        : 'No hay pagos pendientes cargados para ' + currentCurrency + '.';
    }

    if (!allRows.length) {
      setTableMessage('tbodyBreakdown', 5, 'No hay pagos pendientes para ' + currentCurrency + '.');
      return;
    }

    if (!rows.length) {
      setTableMessage('tbodyBreakdown', 5, 'No hay pagos ' + (breakdownFilter === 'vencidos' ? 'vencidos' : 'esta semana') + ' para ' + currentCurrency + '.');
      return;
    }

    const tbody = byId('tbodyBreakdown');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (row) {
      const status = derivePaymentStatus(row.FECHA_VENCIMIENTO);
      return (
        '<tr>' +
          '<td>' + escapeHtml(row.CLIENTE_NOMBRE || '-') + '</td>' +
          '<td><code>' + escapeHtml(row.COTIZACION_ID || '-') + '</code></td>' +
          '<td>' + escapeHtml(formatMoney(row.MONTO, currentCurrency)) + '</td>' +
          '<td>' + escapeHtml(formatDate(row.FECHA_VENCIMIENTO)) + '</td>' +
          '<td><span class="status-pill ' + status.className + '">' + escapeHtml(status.label) + '</span></td>' +
        '</tr>'
      );
    }).join('');
  }

  function cellDisplay(row, header) {
    const val = row[header];
    if (val == null || val === '') return '-';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[\/\-]\d{1,2}/.test(s)) {
      const d = parseDate(s);
      return d ? formatDate(s) : s;
    }
    if (/^(MONTO|MONEDA|MONEDA_|monto|Importe)/i.test(header) && !Number.isNaN(Number(s.replace(/\./g, '').replace(',', '.')))) {
      return formatMoney(s, row.MONEDA || '$');
    }
    return s;
  }

  function renderCalendarioVencimientosSheet(headers, rows, message) {
    const thead = byId('theadCalendario');
    const tbody = byId('tbodyCalendario');
    const desc = byId('calendarioDescription');
    if (!thead || !tbody) return;

    if (message) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td colspan="10" class="empty">' + escapeHtml(message) + '</td></tr>';
      if (desc) desc.textContent = message;
      return;
    }

    const h = Array.isArray(headers) && headers.length ? headers : [];
    const r = Array.isArray(rows) ? rows : [];

    if (!h.length || !r.length) {
      thead.innerHTML = '';
      setTableMessage('tbodyCalendario', 10, 'No hay datos en la hoja Calendario de Vencimientos.');
      if (desc) desc.textContent = 'Datos de la hoja compartida. Solo lectura.';
      return;
    }

    thead.innerHTML = '<tr>' + h.map(function (header) {
      return '<th>' + escapeHtml(header) + '</th>';
    }).join('') + '</tr>';

    tbody.innerHTML = r.map(function (row) {
      return '<tr>' + h.map(function (header) {
        return '<td>' + escapeHtml(cellDisplay(row, header)) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    if (desc) desc.textContent = r.length + ' registro(s) de la hoja Calendario de Vencimientos. Solo lectura.';
  }

  function renderMetas(rows, message, isLoading) {
    if (message) {
      setTableMessage('tbodyMetas', 4, message, isLoading);
      return;
    }

    if (!rows || !rows.length) {
      setTableMessage('tbodyMetas', 4, 'No hay metas de ventas cargadas.');
      return;
    }

    const tbody = byId('tbodyMetas');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (row) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(row.PERIODO || '-') + '</td>' +
          '<td>' + escapeHtml(row.TIPO || '-') + '</td>' +
          '<td>' + escapeHtml(formatMoney(row.META_MONTO, row.MONEDA || '$')) + '</td>' +
          '<td>' + escapeHtml(row.NOTAS || '') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderAudit(rows, message, isLoading) {
    if (message) {
      setTableMessage('tbodyAudit', 8, message, isLoading);
      return;
    }

    const tbody = byId('tbodyAudit');
    if (!tbody) return;

    const filter = (byId('auditFilter') || {}).value || '';
    const query = filter.toLowerCase().trim();
    const filtered = query ? rows.filter(function (row) {
      const line = [
        row.TIMESTAMP,
        row.ACTION,
        row.ROW,
        row.OLD_VALUE,
        row.NEW_VALUE,
        row.REASON,
        row.USER,
        row.SHEET,
      ].join(' ').toLowerCase();
      return line.indexOf(query) !== -1;
    }) : rows;

    if (!filtered.length) {
      setTableMessage('tbodyAudit', 8, rows.length ? 'Ningun registro coincide con el filtro.' : 'No hay registros.');
      return;
    }

    tbody.innerHTML = filtered.map(function (row) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(formatDateTime(row.TIMESTAMP)) + '</td>' +
          '<td>' + escapeHtml(row.ACTION || '') + '</td>' +
          '<td>' + escapeHtml(String(row.ROW || '')) + '</td>' +
          '<td>' + escapeHtml(String(row.OLD_VALUE || '')) + '</td>' +
          '<td>' + escapeHtml(String(row.NEW_VALUE || '')) + '</td>' +
          '<td>' + escapeHtml(String(row.REASON || '')) + '</td>' +
          '<td>' + escapeHtml(String(row.USER || '')) + '</td>' +
          '<td>' + escapeHtml(String(row.SHEET || '')) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderVentas(rows, message, isLoading) {
    const tbody = byId('tbodyVentas');
    const select = byId('ventasProveedorSelect');
    if (!tbody) return;

    if (message) {
      setTableMessage('tbodyVentas', 8, message, isLoading);
      if (select) { select.innerHTML = '<option value="">Todos</option>'; select.disabled = true; }
      return;
    }

    const allRows = rows || [];
    const proveedores = [...new Set(allRows.map(function (r) { return r.PROVEEDOR || ''; }).filter(Boolean))].sort();

    if (select) {
      select.innerHTML = '<option value="">Todos</option>' + proveedores.map(function (p) {
        const sel = p === ventasProveedorFilter ? ' selected' : '';
        return '<option value="' + escapeHtml(p) + '"' + sel + '>' + escapeHtml(p) + '</option>';
      }).join('');
      select.disabled = false;
      select.value = ventasProveedorFilter;
    }

    const filtered = ventasProveedorFilter
      ? allRows.filter(function (r) { return (r.PROVEEDOR || '') === ventasProveedorFilter; })
      : allRows;

    if (!filtered.length) {
      setTableMessage('tbodyVentas', 8, allRows.length ? 'No hay ventas para el proveedor seleccionado.' : 'No hay ventas cargadas.');
      return;
    }

    tbody.innerHTML = filtered.map(function (row) {
      return (
        '<tr>' +
          '<td><code>' + escapeHtml(row.COTIZACION_ID || '-') + '</code></td>' +
          '<td>' + escapeHtml(row.CLIENTE_NOMBRE || '-') + '</td>' +
          '<td>' + escapeHtml(formatDate(row.FECHA_ENTREGA)) + '</td>' +
          '<td>' + escapeHtml(formatMoney(row.COSTO, 'UES')) + '</td>' +
          '<td>' + escapeHtml(formatMoney(row.GANANCIA, 'UES')) + '</td>' +
          '<td>' + escapeHtml(row.SALDO_CLIENTE || '-') + '</td>' +
          '<td>' + escapeHtml(row.FACTURADO || '-') + '</td>' +
          '<td>' + escapeHtml(row.PROVEEDOR || '-') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderKpiReport(payload, message, isLoading) {
    const totalEl = byId('kpiReportTotal');
    const estaSemanaEl = byId('kpiReportEstaSemana');
    const entregasEl = byId('kpiReportEntregas');
    const bajoStockEl = byId('kpiReportBajoStock');
    const metaEl = byId('kpiReportMeta');
    const realEl = byId('kpiReportReal');
    const pagosMesEl = byId('kpiReportPagosMes');
    const equilibrioEl = byId('kpiReportEquilibrio');

    const setVal = function (el, val) {
      if (el) el.textContent = val;
    };

    if (message) {
      setVal(totalEl, '-');
      setVal(estaSemanaEl, '-');
      setVal(entregasEl, '-');
      setVal(bajoStockEl, '-');
      setVal(metaEl, '-');
      setVal(realEl, '-');
      setVal(pagosMesEl, '-');
      if (equilibrioEl) {
        equilibrioEl.textContent = isLoading ? 'Cargando...' : message;
        equilibrioEl.className = 'status-pill status-pill--muted';
      }
      return;
    }

    if (!payload || !payload.ok) {
      setVal(totalEl, '-');
      setVal(estaSemanaEl, '-');
      setVal(entregasEl, '-');
      setVal(bajoStockEl, '-');
      setVal(metaEl, '-');
      setVal(realEl, '-');
      setVal(pagosMesEl, '-');
      if (equilibrioEl) {
        equilibrioEl.textContent = 'Sin datos';
        equilibrioEl.className = 'status-pill status-pill--muted';
      }
      return;
    }

    const moneda = payload.moneda || '$';
    setVal(totalEl, formatMoney(payload.totalPendiente, moneda));
    setVal(estaSemanaEl, formatMoney(payload.estaSemana, moneda));
    setVal(entregasEl, payload.entregasEstaSemana != null ? payload.entregasEstaSemana : '-');
    setVal(bajoStockEl, payload.bajoStock != null ? payload.bajoStock : '-');
    setVal(metaEl, payload.objetivoMensual != null ? formatMoney(payload.objetivoMensual, moneda) : '-');
    setVal(realEl, formatMoney(payload.realAcumulado || 0, moneda));
    setVal(pagosMesEl, formatMoney(payload.pagosEsteMes || 0, moneda));

    if (equilibrioEl) {
      equilibrioEl.textContent = payload.equilibrio || '-';
      equilibrioEl.className = 'status-pill';
      if (payload.equilibrio === 'En meta') equilibrioEl.classList.add('status-pill--upcoming');
      else if (payload.equilibrio === 'Cerca') equilibrioEl.classList.add('status-pill--current');
      else if (payload.equilibrio === 'Por debajo') equilibrioEl.classList.add('status-pill--late');
      else equilibrioEl.classList.add('status-pill--muted');
    }
  }

  function renderStock(rows, kpi, message, isLoading) {
    const tbody = byId('tbodyStock');
    const bajoEl = byId('stockKpiBajo');
    const totalEl = byId('stockKpiTotal');
    const valorEl = byId('stockKpiValor');
    if (!tbody) return;

    if (kpi) {
      if (bajoEl) bajoEl.textContent = kpi.bajoStock != null ? kpi.bajoStock : '-';
      if (totalEl) totalEl.textContent = kpi.totalProductos != null ? kpi.totalProductos : '-';
      if (valorEl) valorEl.textContent = kpi.valorInventario != null ? Number(kpi.valorInventario).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';
    }

    if (message) {
      setTableMessage('tbodyStock', 6, message, isLoading);
      return;
    }

    const data = rows || [];
    if (!data.length) {
      setTableMessage('tbodyStock', 6, 'No hay productos cargados.');
      return;
    }

    tbody.innerHTML = data.map(function (row) {
      return (
        '<tr>' +
          '<td><code>' + escapeHtml(row.CODIGO || '-') + '</code></td>' +
          '<td>' + escapeHtml(row.PRODUCTO || '-') + '</td>' +
          '<td>' + escapeHtml(Number(row.COSTO_USD || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })) + '</td>' +
          '<td>' + escapeHtml(row.MARGEN_PCT != null ? row.MARGEN_PCT : '-') + '</td>' +
          '<td>' + escapeHtml(row.STOCK != null ? row.STOCK : '-') + '</td>' +
          '<td>' + escapeHtml(row.PEDIDO_PENDIENTE != null ? row.PEDIDO_PENDIENTE : '-') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function exportStockCSV() {
    const headers = ['CODIGO', 'PRODUCTO', 'COSTO_USD', 'MARGEN_PCT', 'GANANCIA', 'VENTA_USD', 'STOCK', 'PEDIDO_PENDIENTE'];
    const rows = (stockData || []).map(function (row) {
      return headers.map(function (header) {
        const value = String(row[header] != null ? row[header] : '');
        return value.indexOf(',') !== -1 || value.indexOf('"') !== -1
          ? '"' + value.replace(/"/g, '""') + '"'
          : value;
      }).join(',');
    });
    const csv = [headers.join(','), rows.join('\n')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bmc-stock-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV descargado');
  }

  function exportAuditCSV() {
    const headers = ['TIMESTAMP', 'ACTION', 'ROW', 'OLD_VALUE', 'NEW_VALUE', 'REASON', 'USER', 'SHEET'];
    const rows = auditData.map(function (row) {
      return headers.map(function (header) {
        const value = String(row[header] != null ? row[header] : '');
        return value.indexOf(',') !== -1 || value.indexOf('"') !== -1
          ? '"' + value.replace(/"/g, '""') + '"'
          : value;
      }).join(',');
    });
    const csv = [headers.join(','), rows.join('\n')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bmc-audit-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV descargado');
  }

  function renderEntregas(rows, message, isLoading) {
    if (message) {
      setTableMessage('tbodyEntregas', 6, message, isLoading);
      setLogisticaButtonsEnabled(false);
      return;
    }

    if (!rows || !rows.length) {
      setTableMessage('tbodyEntregas', 6, 'No hay entregas para la semana actual.');
      setLogisticaButtonsEnabled(false);
      return;
    }

    const tbody = byId('tbodyEntregas');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (row) {
      return (
        '<tr data-id="' + escapeHtml(row.COTIZACION_ID || '') + '">' +
          '<td><code>' + escapeHtml(row.COTIZACION_ID || '-') + '</code></td>' +
          '<td>' + escapeHtml(row.CLIENTE_NOMBRE || '-') + '</td>' +
          '<td>' + escapeHtml(formatPhone(row.TELEFONO)) + '</td>' +
          '<td>' + escapeHtml(row.LINK_UBICACION ? 'Link' : (row.DIRECCION || row.ZONA || '-')) + '</td>' +
          '<td>' + escapeHtml(formatDate(row.FECHA_ENTREGA)) + '</td>' +
          '<td class="col-actions">' +
            '<button type="button" class="btn btn-sm btn-success btn-copy-whatsapp" data-id="' + escapeHtml(row.COTIZACION_ID || '') + '">WhatsApp</button> ' +
            '<button type="button" class="btn btn-sm btn-secondary btn-marcar-entregado" data-id="' + escapeHtml(row.COTIZACION_ID || '') + '">Marcar entregado</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    setLogisticaButtonsEnabled(true);

    Array.prototype.forEach.call(tbody.querySelectorAll('.btn-copy-whatsapp'), function (button) {
      button.addEventListener('click', function () {
        copyWhatsAppForId(button.dataset.id);
      });
    });

    Array.prototype.forEach.call(tbody.querySelectorAll('.btn-marcar-entregado'), function (button) {
      button.addEventListener('click', function () {
        marcarEntregado(button.dataset.id);
      });
    });
  }

  function renderFinancialUnavailable(message) {
    currentCurrency = '';
    updateCurrencySelector([]);
    setFinancialKpis(null, '');
    renderTrendPlaceholder(message);
    setTableMessage('tbodyBreakdown', 5, message);
    renderMetas([], 'Datos financieros no disponibles.');
  }

  function renderFinancialViews(snapshot) {
    const currencies = getCurrencyKeys(snapshot);
    if (!currencies.length) {
      currentCurrency = '';
      updateCurrencySelector([]);
      setFinancialKpis(null, '');
      renderTrendPlaceholder('No hay vencimientos cargados.');
      setTableMessage('tbodyBreakdown', 5, 'No hay pagos pendientes cargados.');
      renderMetas(snapshot.metas || []);
      return;
    }

    if (!currentCurrency || currencies.indexOf(currentCurrency) === -1) {
      currentCurrency = chooseDefaultCurrency(currencies);
    }

    updateCurrencySelector(currencies);
    setFinancialKpis(snapshot.byCurrency[currentCurrency], currentCurrency);
    renderTrend(snapshot);
    renderBreakdown(snapshot);
    renderMetas(snapshot.metas || []);
  }

  async function copyWhatsAppForId(id) {
    try {
      const text = await fetchCoordinacionLogistica([id]);
      await navigator.clipboard.writeText(text);
      showToast('Mensaje copiado al portapapeles');
    } catch (error) {
      showToast('Error: ' + (error.message || 'no se pudo copiar'), 'error');
    }
  }

  async function marcarEntregado(id) {
    const comentarios = window.prompt('Comentarios (opcional):') || '';
    try {
      const res = await fetch(API_BASE + '/api/marcar-entregado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: id, comentarios: comentarios }),
      });
      const json = await readJsonResponse(res, 'Error al marcar entrega');
      if (!json.ok) throw new Error(json.error || 'Error al marcar entrega');
      showToast('Marcado como entregado');
      load();
    } catch (error) {
      showToast('Error: ' + (error.message || 'no se pudo marcar'), 'error');
    }
  }

  function renderLoadingShell() {
    setStateBanner('loading', 'Cargando datos del dashboard...');
    setSectionLoading('kpiReport', true);
    setSectionLoading('finanzas', true);
    setSectionLoading('sectionTrend', true);
    setSectionLoading('sectionBreakdown', true);
    setSectionLoading('sectionEntregas', true);
    setSectionLoading('sectionAudit', true);
    setSectionLoading('calendario-vencimientos', true);
    renderKpiReport(null, 'Cargando...', true);
    setFinancialKpis(null, '');
    renderTrendPlaceholder('Cargando tendencia...', true);
    setTableMessage('tbodyBreakdown', 5, 'Cargando pagos pendientes...', true);
    var theadCal = byId('theadCalendario');
    if (theadCal) theadCal.innerHTML = '';
    setTableMessage('tbodyCalendario', 10, 'Cargando calendario...', true);
    renderMetas([], 'Cargando metas...', true);
    renderEntregas([], 'Cargando entregas...', true);
    renderPreview('Cargando vista previa...', false);
    renderAudit([], 'Cargando audit log...', true);
    const filters = byId('breakdownFilters');
    if (filters) filters.style.display = 'none';
  }

  async function load() {
    const refreshButton = byId('btnRefresh');
    if (refreshButton) refreshButton.disabled = true;

    renderLoadingShell();
    setTableMessage('tbodyVentas', 8, 'Cargando...', true);
    setTableMessage('tbodyStock', 6, 'Cargando...', true);

    const results = await Promise.allSettled([
      fetchKpiReport(),
      fetchKpiFinanciero(),
      fetchProximasEntregas(),
      fetchAudit(),
      fetchCalendarioVencimientos(),
      fetchVentas(),
      fetchStockEcommerce(),
      fetchStockKpi(),
    ]);

    const kpiReportResult = results[0];
    const kpiResult = results[1];
    const entregasResult = results[2];
    const auditResult = results[3];
    const calendarioResult = results[4];
    const ventasResult = results[5];
    const stockResult = results[6];
    const stockKpiResult = results[7];

    if (kpiReportResult.status === 'fulfilled' && kpiReportResult.value && kpiReportResult.value.ok) {
      renderKpiReport(kpiReportResult.value);
    } else {
      renderKpiReport(null, kpiReportResult.reason?.message || 'KPI Report no disponible');
    }

    let coreOk = false;
    let coreError = '';

    if (kpiResult.status === 'fulfilled') {
      financialSnapshot = normalizeFinancialSnapshot(kpiResult.value);
      renderFinancialViews(financialSnapshot);
      coreOk = true;
    } else {
      financialSnapshot = emptyFinancialSnapshot();
      coreError = kpiResult.reason && kpiResult.reason.message
        ? kpiResult.reason.message
        : 'Datos financieros no disponibles.';
      renderFinancialUnavailable(coreError);
    }

    if (entregasResult.status === 'fulfilled') {
      proximasEntregas = entregasResult.value || [];
      renderEntregas(proximasEntregas);
      if (proximasEntregas.length) {
        try {
          const text = await fetchCoordinacionLogistica(
            proximasEntregas.map(function (row) { return row.COTIZACION_ID; })
          );
          renderPreview(text, true);
        } catch (error) {
          renderPreview('No se pudo generar el mensaje de coordinacion.', false);
        }
      } else {
        renderPreview('No hay entregas esta semana para generar mensaje.', false);
      }
    } else {
      proximasEntregas = [];
      renderEntregas([], entregasResult.reason && entregasResult.reason.message
        ? entregasResult.reason.message
        : 'No se pudieron cargar las entregas.');
      renderPreview('No se pudo cargar la coordinacion logistica.', false);
    }

    if (auditResult.status === 'fulfilled') {
      auditData = auditResult.value || [];
      renderAudit(auditData);
    } else {
      auditData = [];
      renderAudit([], auditResult.reason && auditResult.reason.message
        ? auditResult.reason.message
        : 'No se pudo cargar el audit log.');
    }

    if (calendarioResult.status === 'fulfilled' && calendarioResult.value) {
      renderCalendarioVencimientosSheet(
        calendarioResult.value.headers,
        calendarioResult.value.data
      );
    } else {
      renderCalendarioVencimientosSheet(
        [],
        [],
        calendarioResult.reason && calendarioResult.reason.message
          ? calendarioResult.reason.message
          : 'Calendario de vencimientos no disponible (revisar hoja compartida con la cuenta de servicio).'
      );
    }

    if (ventasResult.status === 'fulfilled') {
      ventasData = ventasResult.value || [];
      renderVentas(ventasData);
    } else {
      ventasData = [];
      renderVentas([], ventasResult.reason && ventasResult.reason.message
        ? ventasResult.reason.message
        : 'No se pudieron cargar las ventas (configurar BMC_VENTAS_SHEET_ID).');
    }

    if (stockResult.status === 'fulfilled' && stockKpiResult.status === 'fulfilled') {
      stockData = stockResult.value?.data || stockResult.value || [];
      stockKpi = stockKpiResult.value || {};
      renderStock(stockData, stockKpi);
    } else {
      stockData = [];
      stockKpi = { bajoStock: 0, totalProductos: 0, valorInventario: 0 };
      const stockErr = stockResult.reason?.message || stockKpiResult.reason?.message || 'No se pudo cargar el stock (configurar BMC_STOCK_SHEET_ID).';
      renderStock([], null, stockErr);
    }

    if (coreOk) {
      if (hasFinancialData(financialSnapshot)) {
        clearStateBanner();
      } else {
        setStateBanner('empty', 'Sin datos financieros cargados para mostrar el overview.');
      }
      setLastRefresh(true);
    } else {
      setStateBanner('error', coreError);
      setLastRefresh(false);
    }

    setSectionLoading('kpiReport', false);
    setSectionLoading('finanzas', false);
    setSectionLoading('sectionTrend', false);
    setSectionLoading('sectionBreakdown', false);
    setSectionLoading('sectionEntregas', false);
    setSectionLoading('sectionAudit', false);
    setSectionLoading('calendario-vencimientos', false);

    buildNotifications(financialSnapshot, ventasData, stockKpi);

    if (refreshButton) refreshButton.disabled = false;
  }

  // ─── Notification panel ─────────────────────────────────────────────────

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function buildNotifications(financial, ventas, kpi) {
    const notifs = [];
    // Overdue payments
    const overdue = (financial.pendingPayments || []).filter(function (r) {
      const d = parseDate(r.FECHA_VENCIMIENTO);
      return d && d < new Date();
    });
    if (overdue.length) {
      notifs.push({ level: 'error', msg: overdue.length + ' pago' + (overdue.length > 1 ? 's' : '') + ' vencido' + (overdue.length > 1 ? 's' : ''), href: '#sectionBreakdown' });
    }
    // This-week payments
    if ((financial.byPeriod || {}).estaSemana > 0) {
      notifs.push({ level: 'warning', msg: 'Esta semana: ' + formatCurrency((financial.byPeriod || {}).estaSemana), href: '#sectionBreakdown' });
    }
    // Low stock
    if ((kpi.bajoStock || 0) > 0) {
      notifs.push({ level: 'warning', msg: kpi.bajoStock + ' producto' + (kpi.bajoStock > 1 ? 's' : '') + ' bajo stock', href: '#stock' });
    }
    // Unfactured sales
    const sinFacturar = (ventas || []).filter(function (r) { return !r.FACTURADO || r.FACTURADO === 'No'; });
    if (sinFacturar.length) {
      notifs.push({ level: 'info', msg: sinFacturar.length + ' venta' + (sinFacturar.length > 1 ? 's' : '') + ' sin facturar', href: '#ventas' });
    }
    renderNotifications(notifs);
  }

  function renderNotifications(notifs) {
    const badge = byId('notifBadge');
    const list = byId('notifList');
    if (!badge || !list) return;
    list.innerHTML = notifs.length
      ? notifs.map(function (n) {
          return '<li class="notif-item notif-item--' + n.level + '"><a href="' + escapeHtml(n.href) + '">' + escapeHtml(n.msg) + '</a></li>';
        }).join('')
      : '<li class="notif-item notif-item--empty">Sin alertas activas</li>';
    const alertCount = notifs.filter(function (n) { return n.level !== 'info'; }).length;
    badge.textContent = alertCount || '';
    badge.hidden = !alertCount;
  }

  const btnNotif = byId('btnNotifications');
  const notifDrawer = byId('notifDrawer');
  if (btnNotif && notifDrawer) {
    btnNotif.addEventListener('click', function () {
      notifDrawer.hidden = !notifDrawer.hidden;
    });
  }
  byId('btnCloseNotif') && byId('btnCloseNotif').addEventListener('click', function () {
    if (notifDrawer) notifDrawer.hidden = true;
  });

  byId('btnRefresh') && byId('btnRefresh').addEventListener('click', load);
  byId('btnRetry') && byId('btnRetry').addEventListener('click', load);

  const breakdownFiltersEl = byId('breakdownFilters');
  if (breakdownFiltersEl) {
    breakdownFiltersEl.addEventListener('click', function (e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      breakdownFilter = chip.dataset.filter || 'esta_semana';
      renderBreakdown(financialSnapshot);
    });
  }

  byId('btnCopyAllWhatsApp') && byId('btnCopyAllWhatsApp').addEventListener('click', async function () {
    try {
      const text = await fetchCoordinacionLogistica(
        proximasEntregas.map(function (row) { return row.COTIZACION_ID; })
      );
      await navigator.clipboard.writeText(text);
      showToast('Mensaje completo copiado al portapapeles');
    } catch (error) {
      showToast('Error: ' + (error.message || 'no se pudo copiar'), 'error');
    }
  });

  byId('btnCopyPreview') && byId('btnCopyPreview').addEventListener('click', async function () {
    const preview = byId('previewWhatsApp');
    if (!preview || !preview.textContent) return;
    try {
      await navigator.clipboard.writeText(preview.textContent);
      showToast('Texto copiado al portapapeles');
    } catch (error) {
      showToast('Error: ' + (error.message || 'no se pudo copiar'), 'error');
    }
  });

  byId('auditFilter') && byId('auditFilter').addEventListener('input', function () {
    renderAudit(auditData);
  });

  byId('btnExportAuditCSV') && byId('btnExportAuditCSV').addEventListener('click', exportAuditCSV);

  byId('currencySelect') && byId('currencySelect').addEventListener('change', function (event) {
    currentCurrency = event.target.value;
    renderFinancialViews(financialSnapshot);
  });

  byId('ventasProveedorSelect') && byId('ventasProveedorSelect').addEventListener('change', function (event) {
    ventasProveedorFilter = event.target.value || '';
    renderVentas(ventasData);
  });

  byId('btnExportStockCSV') && byId('btnExportStockCSV').addEventListener('click', exportStockCSV);

  // ─── Wolfboard module ──────────────────────────────────────────────────────

  let wolfboardData = [];
  let wfActiveRow = null;

  function renderWolfboardOriginStrip(counts) {
    const el = byId('wfOriginStrip');
    if (!el) return;
    if (!counts || !Object.keys(counts).length) {
      el.innerHTML = '<span class="wf-origin-empty">Sin pendientes o sin Origen en CRM para estas filas.</span>';
      return;
    }
    const keys = Object.keys(counts).sort();
    el.innerHTML = keys
      .map(function (k) {
        return (
          '<span class="wf-origin-pill" role="listitem" title="Origen ' +
          escapeHtml(k) +
          '">' +
          escapeHtml(k) +
          ' <strong>' +
          escapeHtml(String(counts[k])) +
          '</strong></span>'
        );
      })
      .join('');
  }

  function updateWolfboardApproveGate() {
    const iEl = byId('wfDetailI');
    const btn = byId('wfDetailAprobar');
    if (!btn || !iEl) return;
    const empty = !String(iEl.value || '').trim();
    btn.disabled = empty;
    btn.title = empty ? 'Completá la respuesta (I) antes de aprobar' : 'Marca aprobado en CRM (AI)';
  }

  function getWolfboardCanalFilter() {
    const sel = byId('wfCanalFilter');
    return sel && sel.value ? String(sel.value).trim() : '';
  }

  function wolfboardRowsForDisplay() {
    const canal = getWolfboardCanalFilter();
    if (!canal) return wolfboardData;
    return wolfboardData.filter(function (r) {
      const o = String(r.origen || '').toUpperCase();
      return o === canal.toUpperCase() || o.indexOf(canal.toUpperCase()) === 0;
    });
  }

  async function fetchWolfboardPendientes() {
    const res = await fetch(API_BASE + '/api/wolfboard/pendientes');
    return readJsonResponse(res, 'Error al cargar consultas pendientes');
  }

  function renderWolfboard(rows, errorMsg) {
    const tbody = byId('wfTbody');
    const summary = byId('wfSummary');
    if (!tbody) return;

    if (errorMsg) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + escapeHtml(errorMsg) + '</td></tr>';
      if (summary) summary.textContent = 'Sin datos';
      return;
    }

    const displayRows = rows || wolfboardRowsForDisplay();
    const canal = getWolfboardCanalFilter();

    if (!displayRows || displayRows.length === 0) {
      const emptyMsg = canal
        ? 'Ninguna fila con canal "' + escapeHtml(canal) + '" en pendientes.'
        : 'Sin consultas pendientes — todo enviado o sin datos configurados.';
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + emptyMsg + '</td></tr>';
      if (summary) summary.textContent = canal ? '0 (filtro)' : '0 pendientes';
      return;
    }

    if (summary) {
      const base = wolfboardData.length;
      const shown = displayRows.length;
      summary.textContent = canal
        ? shown + ' mostrada' + (shown === 1 ? '' : 's') + ' · ' + base + ' total'
        : shown + ' pendiente' + (shown === 1 ? '' : 's');
    }

    tbody.innerHTML = displayRows.map(function (row) {
      const consulta = escapeHtml((row.consulta || '').slice(0, 80)) + (row.consulta && row.consulta.length > 80 ? '…' : '');
      const respuesta = escapeHtml((row.respuesta || '').slice(0, 55)) + (row.respuesta && row.respuesta.length > 55 ? '…' : '');
      const linkCell = row.link
        ? '<a href="' + escapeHtml(row.link) + '" target="_blank" rel="noopener">Ver</a>'
        : '<span class="empty-cell">—</span>';
      const estadoPill = row.enviado
        ? '<span class="status-pill status-pill--ok">Enviado</span>'
        : '<span class="status-pill status-pill--warn">Pendiente</span>';
      const canalPill = row.origen
        ? '<span class="status-pill">' + escapeHtml(row.origen) + '</span>'
        : '<span class="empty-cell">—</span>';
      const ancla = row.sheetUrl
        ? ' <a href="' + escapeHtml(row.sheetUrl) + '" target="_blank" rel="noopener" title="Abrir fila en Sheets">↗</a>'
        : '';
      return (
        '<tr class="wf-data-row" data-row="' + escapeHtml(String(row.rowNum)) + '">' +
          '<td><code>' + escapeHtml(String(row.rowNum)) + '</code>' + ancla + '</td>' +
          '<td>' + consulta + '</td>' +
          '<td>' + (respuesta || '<span class="empty-cell">—</span>') + '</td>' +
          '<td>' + linkCell + '</td>' +
          '<td>' + estadoPill + '</td>' +
          '<td>' + canalPill + '</td>' +
          '<td><button type="button" class="btn btn-ghost btn-sm wf-detail-btn" data-row="' + escapeHtml(String(row.rowNum)) + '">Ver / Editar</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  async function loadWolfboard() {
    const tbody = byId('wfTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty">Cargando…</td></tr>';
    try {
      const json = await fetchWolfboardPendientes();
      wolfboardData = json.data || [];
      renderWolfboardOriginStrip(json.originCounts || {});
      renderWolfboard(null);
    } catch (err) {
      renderWolfboardOriginStrip({});
      renderWolfboard(null, err.message || 'Error al cargar Wolfboard');
    }
  }

  async function syncWolfboard() {
    const btn = byId('wfSyncBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
    try {
      const res = await fetch(API_BASE + '/api/wolfboard/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both' }),
      });
      const json = await readJsonResponse(res, 'Error al sincronizar');
      const dry = json.dryRun ? '[dry-run] ' : '';
      showToast(dry + 'Sync OK · Admin: ' + (json.updatedAdmin || 0) + ' · CRM: ' + (json.updatedCrm || 0) + ' · Omitidos: ' + (json.skipped || 0));
      if (json.warning) showToast(json.warning);
      await loadWolfboard();
    } catch (err) {
      showToast('Sync fallido: ' + (err.message || 'error'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sincronizar'; }
    }
  }

  function openWolfboardDetail(adminRow) {
    const row = wolfboardData.find(function (r) { return r.rowNum === Number(adminRow); });
    if (!row) return;
    wfActiveRow = row.rowNum;
    const panel = byId('wfDetailPanel');
    if (!panel) return;
    const titleEl = byId('wfDetailTitle');
    const hEl = byId('wfDetailH');
    const iEl = byId('wfDetailI');
    const jEl = byId('wfDetailJ');
    const feedbackEl = byId('wfDetailFeedback');
    if (titleEl) titleEl.textContent = 'Fila ' + row.rowNum + (row.consulta ? ' — ' + row.consulta.slice(0, 50) : '');
    if (hEl) hEl.textContent = row.consulta || '(sin consulta)';
    const origenEl = byId('wfDetailOrigen');
    if (origenEl) origenEl.textContent = row.origen || '—';
    if (iEl) iEl.value = row.respuesta || '';
    if (jEl) jEl.value = row.link || '';
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'wf-feedback'; }
    updateWolfboardApproveGate();
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function saveWolfboardRow() {
    if (!wfActiveRow) return;
    const iEl = byId('wfDetailI');
    const jEl = byId('wfDetailJ');
    const feedbackEl = byId('wfDetailFeedback');
    const saveBtn = byId('wfDetailSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'wf-feedback'; }
    try {
      const res = await fetch(API_BASE + '/api/wolfboard/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminRow: wfActiveRow,
          respuesta: iEl ? iEl.value : undefined,
          link: jEl ? jEl.value : undefined,
        }),
      });
      const json = await readJsonResponse(res, 'Error al guardar');
      const dry = json.dryRun ? '[dry-run] ' : '';
      const msg = dry + 'Guardado · Admin fila ' + json.adminRow + (json.crmRow ? ' · CRM fila ' + json.crmRow : '');
      if (feedbackEl) { feedbackEl.textContent = msg; feedbackEl.className = 'wf-feedback wf-feedback--ok'; }
      showToast(msg);
      if (json.warning) {
        if (feedbackEl) {
          feedbackEl.textContent = msg + ' — ' + json.warning;
          feedbackEl.className = 'wf-feedback wf-feedback--warn';
        }
        showToast(json.warning);
      }
      await loadWolfboard();
    } catch (err) {
      const errMsg = 'Error: ' + (err.message || 'fallo al guardar');
      if (feedbackEl) { feedbackEl.textContent = errMsg; feedbackEl.className = 'wf-feedback wf-feedback--error'; }
      showToast(errMsg, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar en CRM'; }
    }
  }

  async function markWolfboardEnviado() {
    if (!wfActiveRow) return;
    if (!confirm('¿Mover fila ' + wfActiveRow + ' a la pestaña Enviados del CRM? Se marca K=TRUE en Admin, se archiva la fila y se elimina del Administrador. Operación difícil de deshacer.')) return;
    const feedbackEl = byId('wfDetailFeedback');
    const envBtn = byId('wfDetailEnviado');
    if (envBtn) { envBtn.disabled = true; envBtn.textContent = 'Procesando…'; }
    try {
      const res = await fetch(API_BASE + '/api/wolfboard/enviados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminRow: wfActiveRow, force: true }),
      });
      const json = await readJsonResponse(res, 'Error al marcar enviado');
      showToast('Fila ' + json.adminRow + ' movida a Enviados' + (json.dryRun ? ' [dry-run]' : ''));
      const panel = byId('wfDetailPanel');
      if (panel) panel.hidden = true;
      wfActiveRow = null;
      await loadWolfboard();
    } catch (err) {
      const errMsg = 'Error: ' + (err.message || '');
      if (feedbackEl) { feedbackEl.textContent = errMsg; feedbackEl.className = 'wf-feedback wf-feedback--error'; }
      showToast(errMsg, 'error');
    } finally {
      if (envBtn) { envBtn.disabled = false; envBtn.textContent = 'Marcar enviado (K→Enviados)'; }
    }
  }

  async function approveWolfboardRow() {
    if (!wfActiveRow) return;
    const iEl = byId('wfDetailI');
    if (!iEl || !String(iEl.value || '').trim()) {
      showToast('Completá la respuesta (I) antes de aprobar', 'error');
      return;
    }
    const feedbackEl = byId('wfDetailFeedback');
    const btn = byId('wfDetailAprobar');
    if (btn) { btn.disabled = true; btn.textContent = 'Aprobando…'; }
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'wf-feedback'; }
    try {
      const res = await fetch(API_BASE + '/api/wolfboard/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminRow: wfActiveRow, aprobado: true }),
      });
      const json = await readJsonResponse(res, 'Error al aprobar');
      const dry = json.dryRun ? '[dry-run] ' : '';
      const msg = dry + 'Aprobado · CRM fila ' + (json.crmRow || '?');
      if (feedbackEl) {
        feedbackEl.textContent = json.warning ? msg + ' — ' + json.warning : msg;
        feedbackEl.className = 'wf-feedback ' + (json.warning ? 'wf-feedback--warn' : 'wf-feedback--ok');
      }
      showToast(msg);
      if (json.warning) showToast(json.warning);
    } catch (err) {
      const errMsg = 'Error: ' + (err.message || 'fallo al aprobar');
      if (feedbackEl) { feedbackEl.textContent = errMsg; feedbackEl.className = 'wf-feedback wf-feedback--error'; }
      showToast(errMsg, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Aprobar respuesta'; }
    }
  }

  // Event listeners
  byId('wfSyncBtn') && byId('wfSyncBtn').addEventListener('click', syncWolfboard);
  byId('wfCanalFilter') &&
    byId('wfCanalFilter').addEventListener('change', function () {
      renderWolfboard(null);
    });
  byId('wfDetailClose') && byId('wfDetailClose').addEventListener('click', function () {
    const p = byId('wfDetailPanel');
    if (p) p.hidden = true;
    wfActiveRow = null;
  });
  byId('wfDetailSave') && byId('wfDetailSave').addEventListener('click', saveWolfboardRow);
  byId('wfDetailAprobar') && byId('wfDetailAprobar').addEventListener('click', approveWolfboardRow);
  byId('wfDetailEnviado') && byId('wfDetailEnviado').addEventListener('click', markWolfboardEnviado);

  const wfTableEl = byId('wfTable');
  if (wfTableEl) {
    wfTableEl.addEventListener('click', function (e) {
      const btn = e.target.closest('.wf-detail-btn');
      if (btn) {
        openWolfboardDetail(btn.dataset.row);
        return;
      }
      const tr = e.target.closest('tr.wf-data-row');
      if (tr && tr.dataset.row) openWolfboardDetail(tr.dataset.row);
    });
  }

  byId('wfDetailI') &&
    byId('wfDetailI').addEventListener('input', function () {
      updateWolfboardApproveGate();
    });

  // Auto-sync + load when section scrolls into view
  const wfSection = document.getElementById('wolfboard');
  if (wfSection && typeof IntersectionObserver !== 'undefined') {
    const wfObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { wfObserver.disconnect(); syncWolfboard(); }
    }, { threshold: 0.1 });
    wfObserver.observe(wfSection);
  } else if (wfSection) {
    syncWolfboard();
  }

  // ─── End Wolfboard ─────────────────────────────────────────────────────────

  renderInvoquePanel();
  load();
})();
