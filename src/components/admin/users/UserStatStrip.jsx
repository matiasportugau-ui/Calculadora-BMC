function Stat({ label, value, variant }) {
  const cls = `adminCot__stat${variant ? ` adminCot__stat--${variant}` : ""}`;
  return (
    <div className={cls}>
      <span className="adminCot__stat-label">{label}</span>
      <span className="adminCot__stat-value">{value}</span>
    </div>
  );
}

export default function UserStatStrip({ stats }) {
  const { total, active30, admins, suspended } = stats;
  return (
    <section className="adminCot__stats" aria-label="Indicadores de usuarios">
      <Stat label="Total" value={total} />
      <Stat label="Activos (30 días)" value={active30} variant="success" />
      <Stat label="Admins" value={admins} />
      <Stat label="Suspendidos" value={suspended} variant={suspended > 0 ? "warn" : undefined} />
    </section>
  );
}
