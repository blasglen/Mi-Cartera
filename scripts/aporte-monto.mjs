// Monto del aporte de cada mes: crece un % fijo por mes (compuesto) desde una base.
// Regla de Blas (07/11/2026): base US$250 en nov-2026, +1,5% por mes; 40% a SPY.
export function montoDelMes(config, mesKey) {
  const r = config.reglas || {};
  const base = r.aporte_base_usd ?? r.aporte_mensual_usd ?? 250;
  const [by, bm] = String(r.aporte_base_mes || mesKey).split("-").map(Number);
  const [y, m] = mesKey.split("-").map(Number);
  const meses = Math.max(0, (y - by) * 12 + (m - bm));
  const total = Math.round(base * Math.pow(1 + (r.crecimiento_mensual_pct ?? 0) / 100, meses) * 100) / 100;
  const spy = Math.round(total * (r.spy_pct ?? 40)) / 100;
  return { total, spy, libre: Math.round((total - spy) * 100) / 100, meses };
}
