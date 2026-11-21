// Genera public/data/history.min.json: el mismo contenido que history.json
// (~19 MB) en un formato compacto (~10 veces más chico) para que la app
// cargue rápido. Por ticker: primera fecha, saltos en días entre puntos y
// precios redondeados a 6 cifras significativas.
//   { v: 1, updatedAt, coverage, cedearsViaIol,
//     h: { TICKER: { d0: "2015-01-02", dd: [1,3,1,...], p: [123.45, ...] } } }
import fs from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "data");
const src = JSON.parse(await fs.readFile(path.join(DIR, "history.json"), "utf8"));
const DAY = 86400000;
const round = (x) => Number(x.toPrecision(6));
const h = {};
for (const [sym, serie] of Object.entries(src.history || {})) {
  const pts = (serie || []).filter((p) => p && p.date && p.price > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!pts.length) continue;
  const dd = [], p = [];
  let prev = null;
  for (const pt of pts) {
    const t = Date.parse(pt.date + "T00:00:00Z");
    if (prev != null) dd.push(Math.round((t - prev) / DAY));
    prev = t;
    p.push(round(pt.price));
  }
  h[sym] = { d0: pts[0].date, dd, p };
}
const out = { v: 1, updatedAt: src.updatedAt || null, coverage: src.coverage || null, cedearsViaIol: src.cedearsViaIol || [], h };
const txt = JSON.stringify(out);
await fs.writeFile(path.join(DIR, "history.min.json"), txt);
console.log(`history.min.json: ${Object.keys(h).length} tickers, ${(txt.length / 1e6).toFixed(2)} MB`);
