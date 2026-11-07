// REGISTRO — el "boletín de notas" de la Mesa.
//
// En cada corrida (después de VIGÍA y la Mesa):
//  1. Copia a public/data/registro.json las señales nuevas del log de VIGÍA
//     (el log solo guarda las últimas 500; el registro guarda todo).
//  2. Anota el precio del día (en US$ MEP) de cada ticker con señal + SPY.
//     Se pisa en cada corrida, así que queda el último del día (≈ cierre).
//  3. Calcula cómo le fue a cada señal a 1, 5 y 20 ruedas.
//  4. Los viernes desde las 18:30 (una vez por semana) manda el resumen al
//     grupo con el bot CONTROL. Con --resumen lo manda ya (prueba).
//
// Acierto: COMPRA si después sube; VENTA / VENTA PARCIAL / ESPERAR / NO COMPRAR
// si después baja. MANTENER no se califica.

import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.join(process.cwd(), "public", "data");
const FILE = path.join(DATA, "registro.json");
const PLAZOS = [1, 5, 20];
const env = process.env;
const FORZAR = process.argv.includes("--resumen");
const DRY = process.argv.includes("--dry") || !env.TG_CONTROL || !env.TG_CHAT_ID;

const nowAr = () => new Date(Date.now() - 3 * 3600e3);
const hoy = () => nowAr().toISOString().slice(0, 10);
const num = (x, d = 1) => (x == null ? "s/d" : x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (x) => (x == null ? "s/d" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${num(Math.abs(x))}%`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Para señales viejas sin veredicto guardado
function veredictoDe(e) {
  if (e.veredicto) return e.veredicto;
  const ev = e.eventos || [];
  if (ev.some((x) => ["rompe_soporte_3m", "cruza_abajo_sma200", "cruce_muerte", "minimo_6m"].includes(x) || x.startsWith("stop_ppc_"))) return e.enCartera ? "SEÑAL DE VENTA" : "NO COMPRAR";
  if (ev.some((x) => ["en_soporte_3m", "rsi_sobrevendido", "cruza_arriba_sma200", "cruce_dorado"].includes(x))) return "SEÑAL DE COMPRA";
  return "MANTENER";
}
const direccion = (v) => (/COMPRA/.test(v) && !/NO COMPRAR/.test(v) ? 1 : /VENTA|ESPERAR|NO COMPRAR/.test(v) ? -1 : 0);

async function main() {
  const sig = JSON.parse(await fs.readFile(path.join(DATA, "signals.json"), "utf8"));
  let state = {};
  try { state = JSON.parse(await fs.readFile(path.join(DATA, "vigia-state.json"), "utf8")); } catch {}
  let reg = { senales: [], precios: {}, ultimoResumen: null };
  try { reg = { ...reg, ...JSON.parse(await fs.readFile(FILE, "utf8")) }; } catch {}

  // 1) señales nuevas
  const ya = new Set(reg.senales.map((s) => `${s.ts}|${s.ticker}`));
  let nuevas = 0;
  for (const e of state.log || []) {
    const k = `${e.ts}|${e.ticker}`;
    const existente = reg.senales.find((s) => `${s.ts}|${s.ticker}` === k);
    if (existente) { if (e.analista && !existente.analista) existente.analista = e.analista; continue; }
    if (ya.has(k) || !e.precio) continue;
    const fecha = new Date(new Date(e.ts).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
    reg.senales.push({ ts: e.ts, fecha, ticker: e.ticker, enCartera: e.enCartera, veredicto: veredictoDe(e), analista: e.analista || null, eventos: e.eventos, precio: e.precio });
    nuevas++;
  }

  // 2) precio del día (solo si es precio de hoy)
  const tickers = new Set([...reg.senales.map((s) => s.ticker), "SPY"]);
  const d = hoy();
  const dia = reg.precios[d] || {};
  for (const t of tickers) { const x = sig.tickers[t]; if (x?.precio && x.fuente === "en vivo") dia[t] = x.precio; }
  if (Object.keys(dia).length) reg.precios[d] = dia;

  // 3) resultados
  const fechas = Object.keys(reg.precios).sort();
  for (const s of reg.senales) {
    const despues = fechas.filter((f) => f > s.fecha);
    s.resultado = s.resultado || {};
    const spy0 = (reg.precios[s.fecha] || {}).SPY;
    for (const n of PLAZOS) {
      if (s.resultado[n]) continue;
      const f = despues[n - 1];
      const px = f && reg.precios[f][s.ticker];
      if (!px) continue;
      const ret = (px / s.precio - 1) * 100;
      const spy1 = reg.precios[f].SPY;
      const dir = direccion(s.veredicto);
      s.resultado[n] = { fecha: f, ret: Math.round(ret * 100) / 100, spy: spy0 && spy1 ? Math.round((spy1 / spy0 - 1) * 10000) / 100 : null, acierto: dir === 0 ? null : dir * ret > 0 };
    }
  }

  // 4) resumen semanal
  const n = nowAr();
  const esViernesCierre = n.getUTCDay() === 5 && n.toISOString().slice(11, 16) >= "18:30";
  if (FORZAR || (esViernesCierre && reg.ultimoResumen !== d)) {
    const texto = resumen(reg);
    if (DRY) console.log("\n----- REGISTRO (no enviado) -----\n" + texto.replace(/<[^>]+>/g, ""));
    else {
      const r = await fetch(`https://api.telegram.org/bot${env.TG_CONTROL}/sendMessage`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: texto, parse_mode: "HTML" }),
      });
      if ((await r.json()).ok && !FORZAR) reg.ultimoResumen = d;
    }
  }

  reg.resumen = estadisticas(reg); // para que ANALISTA lo pueda leer
  console.log(`REGISTRO: ${reg.senales.length} señales (${nuevas} nuevas) · ${fechas.length} días de precios`);
  if (!process.argv.includes("--dry")) await fs.writeFile(FILE, JSON.stringify(reg, null, 1));
}

function grupo(lista, n) {
  const cal = lista.filter((s) => s.resultado?.[n]?.acierto != null);
  if (!cal.length) return null;
  const ok = cal.filter((s) => s.resultado[n].acierto).length;
  const dirRet = cal.map((s) => direccion(s.veredicto) * s.resultado[n].ret);
  const vsSpy = cal.filter((s) => s.resultado[n].spy != null).map((s) => s.resultado[n].ret - s.resultado[n].spy);
  return {
    total: cal.length, ok, pct: Math.round((ok / cal.length) * 100),
    promedio: dirRet.reduce((a, b) => a + b, 0) / cal.length,
    vsSpy: vsSpy.length ? vsSpy.reduce((a, b) => a + b, 0) / vsSpy.length : null,
  };
}

function estadisticas(reg) {
  const S = reg.senales;
  const porVeredicto = {};
  for (const v of [...new Set(S.map((s) => s.veredicto))]) porVeredicto[v] = Object.fromEntries(PLAZOS.map((n) => [n, grupo(S.filter((s) => s.veredicto === v), n)]));
  const porCombo = {};
  for (const c of [...new Set(S.map((s) => [...s.eventos].sort().join("+")))]) {
    const g = grupo(S.filter((s) => [...s.eventos].sort().join("+") === c), 5);
    if (g) porCombo[c] = g;
  }
  const contra = S.filter((s) => s.analista && s.analista !== s.veredicto && s.resultado?.[5]);
  const analistaContra = contra.length ? { total: contra.length, ok: contra.filter((s) => {
    const r = s.resultado[5].ret;
    const dA = direccion(s.analista);
    // MANTENER contra VIGÍA acierta si el precio NO fue para donde decía VIGÍA
    return dA !== 0 ? dA * r > 0 : direccion(s.veredicto) * r <= 0;
  }).length } : null;
  return { actualizado: new Date().toISOString(), senales: S.length, porVeredicto, porCombo, analistaContra };
}

const NOMBRES = {
  en_soporte_3m: "soporte", rompe_soporte_3m: "rompe soporte", en_resistencia_3m: "resistencia", rompe_resistencia_3m: "rompe máximos",
  rsi_sobrevendido: "RSI bajo", rsi_sobrecomprado: "RSI alto", cruza_arriba_sma200: "cruza 200↑", cruza_abajo_sma200: "pierde 200",
  cruce_dorado: "cruce dorado", cruce_muerte: "cruce muerte", sube_fuerte: "suba fuerte", cae_fuerte: "caída fuerte", stop_ppc_20: "stop −20%", stop_ppc_30: "stop −30%", minimo_6m: "mínimo 6m",
};

function resumen(reg) {
  const st = estadisticas(reg);
  const L = [`📊 <b>REGISTRO · ¿aciertan las señales?</b>`, `${st.senales} señales anotadas desde ${reg.senales[0]?.fecha || "hoy"}.`, ""];
  const filas = Object.entries(st.porVeredicto).filter(([v]) => v !== "MANTENER");
  let hay = false;
  for (const [v, g] of filas) {
    const emoji = /COMPRA/.test(v) && !/NO/.test(v) ? "🟢" : /VENTA/.test(v) ? "🔴" : "🟡";
    const partes = PLAZOS.map((n) => (g[n] ? `${n}d: ${g[n].ok}/${g[n].total} (${g[n].pct}%)` : null)).filter(Boolean);
    if (!partes.length) continue;
    hay = true;
    const g5 = g[5] || g[1];
    L.push(`${emoji} <b>${esc(v)}</b>`, `   ${partes.join(" · ")}`, `   resultado medio ${pct(g5.promedio)}${g5.vsSpy != null && /COMPRA/.test(v) ? ` · vs SPY ${pct(g5.vsSpy)}` : ""}`);
  }
  if (!hay) L.push("Todavía no hay señales con resultado: necesito que pasen al menos 1-5 ruedas.");
  const combos = Object.entries(st.porCombo).filter(([, g]) => g.total >= 3).sort((a, b) => b[1].pct - a[1].pct);
  if (combos.length >= 2) {
    const nom = (c) => c.split("+").map((x) => NOMBRES[x] || x).join(" + ");
    const [mc, mg] = combos[0], [pc, pg] = combos.at(-1);
    L.push("", `🏆 Mejor (5 días): ${esc(nom(mc))} — ${mg.ok}/${mg.total}`, `🗑️ Peor (5 días): ${esc(nom(pc))} — ${pg.ok}/${pg.total}`);
  }
  if (st.analistaContra) L.push(`🧠 ANALISTA cuando contradijo a VIGÍA: acertó ${st.analistaContra.ok}/${st.analistaContra.total}`);
  L.push("", "<i>Acierto = el precio fue para donde dijo la señal. Con menos de 20 señales por tipo, los % son orientativos.</i>");
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
