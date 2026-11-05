// VIGÍA — primer bot de la Mesa de Inversiones.
//
// Lee public/data/signals.json (recién calculado con precios en vivo), busca
// eventos técnicos en la cartera de Balanz y en los candidatos, y los manda al
// grupo de Telegram. Sin IA: son reglas fijas.
//
// Eventos: soporte / resistencia de 3 meses (cerca o roto), RSI extremo,
// cruce de la media de 200, cruce dorado / de la muerte (50 vs 200) y
// movimientos fuertes del día. Cada evento se avisa una sola vez por día.
// Además manda un resumen de apertura una vez por día.
//
// Uso:
//   node scripts/vigia.mjs          -> manda a Telegram (TG_VIGIA + TG_CHAT_ID)
//   node scripts/vigia.mjs --dry    -> solo imprime, no manda ni guarda estado
//   --test                          -> además ignora que el precio no sea "en vivo"
// Sin TG_VIGIA / TG_CHAT_ID funciona como --dry.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const STATE_FILE = path.join(DATA, "vigia-state.json");
const CONFIG = JSON.parse(await fs.readFile(path.join(ROOT, "scripts", "vigia-config.json"), "utf8"));
const U = CONFIG.umbrales;

const TOKEN = process.env.TG_VIGIA;
const CHAT = process.env.TG_CHAT_ID;
const DRY = process.argv.includes("--dry") || !TOKEN || !CHAT;
const TEST = process.argv.includes("--test");

// ---------- utilidades ----------
const nowAr = () => new Date(Date.now() - 3 * 3600e3); // Argentina = UTC-3 fijo
const fechaAr = () => nowAr().toISOString().slice(0, 10);
const horaAr = () => nowAr().toISOString().slice(11, 16);
const num = (x, d = 2) => (x == null ? "s/d" : x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const usd = (x) => `US$ ${num(x)}`;
const pctTxt = (x) => (x == null ? "s/d" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${num(Math.abs(x), 1)}%`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

async function send(text) {
  if (DRY) { console.log("\n----- (no enviado) -----\n" + text.replace(/<[^>]+>/g, "")); return null; }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) { console.log(`Telegram error: ${res.status} ${j.description || ""}`); return false; }
  return j.result.message_id;
}

// ---------- detección de eventos ----------
// Cada evento: { id, emoji, texto, tipo: "compra" | "alerta" | "caro" | "info" }
function eventos(t) {
  const out = [];
  const p = t.previo || {};
  const px = t.precio;
  if (px == null) return out;
  const c = U.cerca_nivel_pct / 100, r = U.ruptura_pct / 100;

  // Soporte de 3 meses
  if (p.soporte_3m) {
    if (px < p.soporte_3m * (1 - r))
      out.push({ id: "rompe_soporte_3m", emoji: "🔴", tipo: "alerta", texto: `Rompió el soporte de 3 meses (${usd(p.soporte_3m)})` });
    else if (px <= p.soporte_3m * (1 + c))
      out.push({ id: "en_soporte_3m", emoji: "🟢", tipo: "compra", texto: `Está apoyado en el soporte de 3 meses (${usd(p.soporte_3m)})` });
  }
  // Resistencia de 3 meses
  if (p.resistencia_3m) {
    if (px > p.resistencia_3m * (1 + r))
      out.push({ id: "rompe_resistencia_3m", emoji: "🚀", tipo: "ruptura", texto: `Rompió la resistencia de 3 meses (${usd(p.resistencia_3m)}): nuevo máximo` });
    else if (px >= p.resistencia_3m * (1 - c))
      out.push({ id: "en_resistencia_3m", emoji: "🟡", tipo: "caro", texto: `Está contra la resistencia de 3 meses (${usd(p.resistencia_3m)})` });
  }
  // RSI
  if (t.rsi14 != null) {
    if (t.rsi14 <= U.rsi_sobrevendido)
      out.push({ id: "rsi_sobrevendido", emoji: "🟢", tipo: "compra", texto: `RSI ${num(t.rsi14, 0)}: sobrevendido (cayó mucho y rápido)` });
    else if (t.rsi14 >= U.rsi_sobrecomprado)
      out.push({ id: "rsi_sobrecomprado", emoji: "🟠", tipo: "caro", texto: `RSI ${num(t.rsi14, 0)}: sobrecomprado (subió mucho y rápido)` });
  }
  // Cruce de la media de 200 ruedas
  if (p.cierre && p.sma200 && t.sma200) {
    if (p.cierre < p.sma200 && px > t.sma200)
      out.push({ id: "cruza_arriba_sma200", emoji: "🟢", tipo: "compra", texto: `Cruzó para arriba la media de 200 ruedas (${usd(t.sma200)})` });
    else if (p.cierre > p.sma200 && px < t.sma200)
      out.push({ id: "cruza_abajo_sma200", emoji: "🔴", tipo: "alerta", texto: `Perdió la media de 200 ruedas (${usd(t.sma200)}): la tendencia larga se debilita` });
  }
  // Cruce dorado / de la muerte
  if (p.sma50 && p.sma200 && t.sma50 && t.sma200) {
    if (p.sma50 <= p.sma200 && t.sma50 > t.sma200)
      out.push({ id: "cruce_dorado", emoji: "🌟", tipo: "compra", texto: "Cruce dorado: la media de 50 pasó arriba de la de 200" });
    else if (p.sma50 >= p.sma200 && t.sma50 < t.sma200)
      out.push({ id: "cruce_muerte", emoji: "⚫", tipo: "alerta", texto: "Cruce de la muerte: la media de 50 pasó abajo de la de 200" });
  }
  // Movimiento fuerte del día
  if (t.var_1d_pct != null && Math.abs(t.var_1d_pct) >= U.movimiento_fuerte_pct)
    out.push({ id: t.var_1d_pct > 0 ? "sube_fuerte" : "cae_fuerte", emoji: "⚡", tipo: "info", texto: `Movimiento fuerte hoy: ${pctTxt(t.var_1d_pct)}` });
  return out;
}

function lectura(evs, enCartera) {
  const has = (tipo) => evs.some((e) => e.tipo === tipo);
  if (has("alerta"))
    return enCartera
      ? "🔴 Perdió un nivel clave. Revisá si seguís convencido de la tesis o si es momento de poner un stop."
      : "🔴 Viene débil. Mejor esperar a que se estabilice antes de pensar en comprar.";
  if (has("compra"))
    return enCartera
      ? "🟢 Posible punto para sumar en el próximo aporte (si no pasa tu tope de concentración)."
      : "🟢 Posible punto de entrada para el aporte. Falta confirmar con noticias y fundamentos.";
  if (has("ruptura"))
    return enCartera
      ? "🚀 Tendencia fuerte: buena señal para lo que ya tenés. Para sumar más, suele convenir esperar un retroceso hacia la vieja resistencia."
      : "🚀 Tendencia fuerte, pero comprar en máximos sale caro. Si te interesa, esperá un retroceso hacia la vieja resistencia.";
  if (has("caro"))
    return enCartera
      ? "🟡 Caro en el corto plazo. Si ya pesa mucho en tu cartera, podría ser momento de tomar ganancia parcial."
      : "🟡 Caro en el corto plazo: mejor esperar un retroceso.";
  return "⚡ Movimiento fuera de lo normal: hay que ver qué noticia lo explica.";
}

function mensajeAlerta(sym, t, evs, enCartera) {
  const lines = [
    `🔭 <b>${esc(sym)}</b> · ${enCartera ? "📁 en cartera" : "👀 candidato"}`,
    `${usd(t.precio)} (${pctTxt(t.var_1d_pct)} hoy · ${pctTxt(t.var_1s_pct)} en la semana)`,
    "",
    ...evs.map((e) => `${e.emoji} ${esc(e.texto)}`),
    "",
    `Tendencia: ${esc(t.tendencia)}`,
    `Medias: 20 ${usd(t.sma20)} · 50 ${usd(t.sma50)} · 200 ${usd(t.sma200)}`,
    "",
    `<i>${esc(lectura(evs, enCartera))}</i>`,
  ];
  return lines.join("\n");
}

// Semáforo corto para el resumen de apertura
function semaforo(t) {
  const p = t.previo || {};
  const cercaSoporte = p.soporte_3m && t.precio <= p.soporte_3m * 1.03;
  if (t.rsi14 != null && t.rsi14 >= U.rsi_sobrecomprado) return "🟡";
  if (cercaSoporte || (t.rsi14 != null && t.rsi14 <= 35)) return t.sma200 && t.precio < t.sma200 * 0.9 ? "🔴" : "🟢";
  if (t.sma50 && t.sma200 && t.precio < t.sma50 && t.precio < t.sma200) return "🔴";
  return "⚪";
}

// Puntaje para "mejor punto para el aporte hoy": cerca del soporte, RSI bajo,
// pero sin haber perdido la tendencia de largo plazo.
function puntajeAporte(t) {
  const p = t.previo || {};
  if (!p.soporte_3m || !p.resistencia_3m || t.rsi14 == null) return null;
  const rango = p.resistencia_3m - p.soporte_3m;
  if (rango <= 0) return null;
  const posRango = (t.precio - p.soporte_3m) / rango; // 0 = en soporte, 1 = en resistencia
  let s = (1 - Math.min(Math.max(posRango, 0), 1)) * 50 + (70 - Math.min(Math.max(t.rsi14, 20), 70)) ;
  if (t.sma200 && t.precio < t.sma200 * 0.9) s -= 25; // muy abajo de la 200: cuchillo cayendo
  if (t.precio < p.soporte_3m * (1 - U.ruptura_pct / 100)) s -= 20; // rompió soporte
  return s;
}

function mensajeApertura(sig, cartera, candidatos) {
  const d = nowAr();
  const fecha = `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  const lines = [`🔔 <b>Apertura · ${fecha}</b>`, `Dólar MEP $ ${num(sig.fx?.mep, 0)} · CCL $ ${num(sig.fx?.ccl, 0)}`, "", "<b>Tu cartera</b>"];
  for (const sym of cartera) {
    const t = sig.tickers[sym];
    if (!t) continue;
    lines.push(`${semaforo(t)} <b>${esc(sym)}</b> ${usd(t.precio)} · ${pctTxt(t.var_1d_pct)} · RSI ${num(t.rsi14, 0)}`);
  }
  const ranking = candidatos
    .concat(cartera.filter((s) => !CONFIG.argentina?.includes(s)))
    .filter((s, i, a) => a.indexOf(s) === i && sig.tickers[s])
    .map((s) => ({ s, p: puntajeAporte(sig.tickers[s]) }))
    .filter((x) => x.p != null)
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  if (ranking.length) {
    lines.push("", "<b>Mejor punto técnico para el aporte hoy</b>");
    for (const { s } of ranking) {
      const t = sig.tickers[s];
      lines.push(`• <b>${esc(s)}</b> ${usd(t.precio)} · soporte ${usd(t.previo.soporte_3m)} · RSI ${num(t.rsi14, 0)}${cartera.includes(s) ? " (ya lo tenés)" : ""}`);
    }
  }
  lines.push("", "🟢 cerca de soporte / sobrevendido · 🟡 caro · 🔴 bajista · ⚪ sin señal", "<i>Lectura técnica, no recomendación. Vos decidís.</i>");
  return lines.join("\n");
}

// ---------- main ----------
async function main() {
  const sig = JSON.parse(await fs.readFile(path.join(DATA, "signals.json"), "utf8"));
  if (sig.moneda !== "USD") console.log("ATENCIÓN: signals.json está en PESOS (falló el MEP histórico). Los montos van a decir US$ pero son $.");

  // activos: "TICKER:evento" -> fecha en que se avisó. Mientras la condición
  // siga, no se repite; cuando deja de cumplirse (en un día posterior) se
  // borra y queda "armada" para volver a avisar.
  let state = null;
  try { state = JSON.parse(await fs.readFile(STATE_FILE, "utf8")); } catch {}
  const primeraVez = !state;
  state = { fecha: null, apertura: false, activos: {}, log: [], ...(state || {}) };
  const hoy = fechaAr();
  if (state.fecha !== hoy) { state.fecha = hoy; state.apertura = false; }
  if (primeraVez) console.log("Primera corrida: registro lo que ya está pasando sin avisar (el resumen de apertura lo muestra).");

  const cartera = CONFIG.cartera;
  const candidatos = CONFIG.candidatos.filter((s) => !cartera.includes(s));
  const vigilados = [...cartera, ...candidatos];
  const faltan = vigilados.filter((s) => !sig.tickers[s]);
  if (faltan.length) console.log(`No están en signals.json (se saltean): ${faltan.join(", ")}`);

  let enviados = 0;

  // 1) Resumen de apertura, una vez por día
  if (!state.apertura && (horaAr() >= CONFIG.resumen_apertura_ar || TEST)) {
    const id = await send(mensajeApertura(sig, cartera, candidatos));
    if (id !== false) { state.apertura = true; enviados++; }
  }

  // 2) Alertas por ticker
  for (const sym of vigilados) {
    const t = sig.tickers[sym];
    if (!t) continue;
    if (t.fuente !== "en vivo" && !TEST) continue; // fuera de horario o sin precio de hoy
    const enCartera = cartera.includes(sym);
    let evs = eventos(t);
    // Menos ruido: de los candidatos solo interesan las señales de compra y las
    // rupturas. "Caro" y "alerta" importan solo para lo que ya tenés.
    if (!enCartera && !evs.some((e) => e.tipo === "compra" || e.tipo === "ruptura")) evs = [];
    // Un movimiento fuerte solo, sin otra señal, no alcanza para avisar
    if (evs.length && evs.every((e) => e.tipo === "info")) evs = [];
    // Re-armar condiciones que dejaron de cumplirse
    const ahora = new Set(eventos(t).map((e) => `${sym}:${e.id}`));
    for (const k of Object.keys(state.activos))
      if (k.startsWith(`${sym}:`) && !ahora.has(k) && state.activos[k] !== hoy) delete state.activos[k];
    const nuevos = evs.filter((e) => !state.activos[`${sym}:${e.id}`]);
    if (!nuevos.length) continue;
    if (primeraVez && !TEST) { for (const e of nuevos) state.activos[`${sym}:${e.id}`] = hoy; continue; }
    const id = await send(mensajeAlerta(sym, t, nuevos, enCartera));
    if (id === false) continue;
    enviados++;
    for (const e of nuevos) state.activos[`${sym}:${e.id}`] = hoy;
    // El log queda para los próximos bots (ANALISTA responde a message_id; REGISTRO mide resultados)
    state.log.push({ ts: new Date().toISOString(), ticker: sym, enCartera, eventos: nuevos.map((e) => e.id), precio: t.precio, rsi14: t.rsi14, message_id: id });
  }
  state.log = state.log.slice(-500);

  console.log(`VIGÍA: ${enviados} mensaje(s) ${DRY ? "(modo prueba, sin enviar)" : "enviados"}`);
  if (!DRY || process.argv.includes("--save")) await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
