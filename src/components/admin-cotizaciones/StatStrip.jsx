function Stat({ label, value, variant }) {
  const cls = `adminCot__stat${variant ? ` adminCot__stat--${variant}` : ""}`;
  return (
    <div className={cls}>
      <span className="adminCot__stat-label">{label}</span>
      <span className="adminCot__stat-value">{value}</span>
    </div>
  );
}

export default function StatStrip({ stats }) {
  const { pendientes, aprobadas, conError, edadAlta } = stats;
  return (
    <section className="adminCot__stats" aria-label="Indicadores">
      <Stat label="Pendientes" value={pendientes} />
      <Stat label="Aprobadas" value={aprobadas} variant="success" />
      <Stat label="Con error ⚠" value={conError} variant={conError > 0 ? "warn" : undefined} />
      <Stat label="≥14 días sin enviar" value={edadAlta} variant={edadAlta > 0 ? "error" : undefined} />
    </section>
  );
}
