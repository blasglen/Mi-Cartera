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

// Lo que aprendió REGISTRO (public/data/aprendizaje.json): eventos apagados,
// confiables y su % de acierto histórico
let APRENDIZAJE = { eventos: {} };
try { APRENDIZAJE = JSON.parse(await fs.readFile(path.join(DATA, "aprendizaje.json"), "utf8")); } catch {}
const estadoEv = (id) => APRENDIZAJE.eventos?.[id]?.estado || "aprendiendo";
const pesoEv = (e) => (estadoEv(e.id) === "confiable" ? 2 : 1);
const historialEv = (id) => { const x = APRENDIZAJE.eventos?.[id]; return x && x.n >= 10 ? ` <i>(📊 acertó ${x.acierto_pct}% en ${x.n})</i>` : ""; };

// Chat privado de Blas (lo guarda aporte.mjs cuando le da /start a @BlasVigiaBot)
let PRIVADO = null;
let APORTE = {};
try { APORTE = JSON.parse(await fs.readFile(path.join(DATA, "aporte-state.json"), "utf8")); PRIVADO = APORTE.privado || null; } catch {}
// Lo ya comprado en el aporte de este mes no vuelve a avisar compra por privado
const mesActual = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
const compradoEsteMes = (sym) => APORTE.mes === mesActual && ((sym === "SPY" && APORTE.spy) || (APORTE.libre?.ticker && APORTE.libre.ticker.split("+").includes(sym)));
async function sendTo(chat, text) {
  if (DRY) { console.log("\n----- (privado, no enviado) -----\n" + text.replace(/<[^>]+>/g, "")); return 1; }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }) });
  return (await r.json().catch(() => ({}))).ok;
}

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
function eventos(t, sym) {
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
  // Stop contra tu precio promedio de compra (solo lo que tenés)
  const ppc = CONFIG.ppc?.[sym];
  if (ppc && (CONFIG.tenencias || {})[sym]) {
    const caida = (px / ppc - 1) * 100;
    const niveles = [...(U.stop_ppc_pct || [20, 30])].sort((a, b) => b - a); // el más profundo primero
    const nivel = niveles.find((n) => caida <= -n);
    if (nivel) out.push({ id: `stop_ppc_${nivel}`, emoji: "🛑", tipo: "alerta", texto: `Está ${num(-caida, 0)}% abajo de tu precio promedio de compra (US$ ${num(ppc)}): pasó tu stop de −${nivel}%` });
  }
  // Nuevo mínimo de 6 meses
  if (t.rango_6m?.min && px <= t.rango_6m.min * 1.001 && (t.var_1d_pct ?? 0) < 0 && (CONFIG.tenencias || {})[sym])
    out.push({ id: "minimo_6m", emoji: "📉", tipo: "alerta", texto: `Nuevo mínimo de 6 meses (${usd(px)})` });
  // Movimiento fuerte del día
  if (t.var_1d_pct != null && Math.abs(t.var_1d_pct) >= U.movimiento_fuerte_pct)
    out.push({ id: t.var_1d_pct > 0 ? "sube_fuerte" : "cae_fuerte", emoji: "⚡", tipo: "info", texto: `Movimiento fuerte hoy: ${pctTxt(t.var_1d_pct)}` });
  return out;
}

// Veredicto directo: COMPRA / VENTA / VENTA PARCIAL / MANTENER / ESPERAR,
// con niveles concretos. Son reglas técnicas: Blas decide.
function pesoEnCartera(sym, sig) {
  const ten = CONFIG.tenencias || {};
  let total = 0;
  for (const [s, n] of Object.entries(ten)) total += (sig.tickers[s]?.precio || 0) * n;
  const v = (sig.tickers[sym]?.precio || 0) * (ten[sym] || 0);
  return total ? (v / total) * 100 : null;
}

function veredicto(sym, t, evs, enCartera, sig) {
  const has = (tipo) => evs.some((e) => e.tipo === tipo);
  const p = t.previo || {};
  const sop = p.soporte_3m, res = p.resistencia_3m;
  const nCompra = evs.filter((e) => e.tipo === "compra").reduce((a, e) => a + pesoEv(e), 0);
  const tope = CONFIG.reglas?.tope_posicion_pct ?? 12;
  const peso = enCartera ? pesoEnCartera(sym, sig) : null;
  const esArg = (CONFIG.argentina || []).includes(sym);

  if (has("alerta")) {
    const stop = evs.find((e) => e.id.startsWith("stop_ppc_"));
    let nivel = sop && t.precio < sop ? `Perdió ${usd(sop)}. Recomprar recién si recupera ese nivel.` : stop ? "Cortá la pérdida o definí ya hasta dónde la bancás." : "Perdió un nivel clave.";
    if (enCartera && esArg) nivel += " Además va en línea con tu objetivo de bajar Argentina.";
    return enCartera
      ? { emoji: "🔴", titulo: "SEÑAL DE VENTA", fuerza: evs.filter((e) => e.tipo === "alerta").reduce((a, e) => a + pesoEv(e), 0) >= 2 ? "fuerte" : "moderada", plan: nivel }
      : { emoji: "⛔", titulo: "NO COMPRAR", fuerza: null, plan: `Viene cayendo. ${nivel}` };
  }
  if (has("compra")) {
    const base = sop && t.precio >= sop * 0.99 ? sop : t.precio;
    const plan = `Entrada: ${usd(base)} – ${usd(base * 1.02)} · Stop: ${usd(Math.min(base, t.precio) * 0.96)}${res ? ` · Objetivo: ${usd(res)}` : ""}`;
    if (enCartera && esArg) return { emoji: "⚪", titulo: "MANTENER", fuerza: null, plan: "Buen punto técnico, pero tu regla es no sumar Argentina." };
    return { emoji: "🟢", titulo: "SEÑAL DE COMPRA", fuerza: nCompra >= 2 ? "fuerte" : "moderada", plan };
  }
  if (has("ruptura"))
    return enCartera
      ? { emoji: "⚪", titulo: "MANTENER", fuerza: null, plan: `Rompió máximos: dejala correr. Stop de protección: ${usd(res * 0.97)}.` }
      : { emoji: "🟡", titulo: "ESPERAR", fuerza: null, plan: `Rompió máximos. Comprar si retrocede a ${usd(res)} – ${usd(res * 1.02)}.` };
  if (has("caro")) {
    if (enCartera && ((peso != null && peso > tope) || (t.rsi14 != null && t.rsi14 >= 75)))
      return { emoji: "🟠", titulo: "SEÑAL DE VENTA PARCIAL", fuerza: null, plan: `Tomar ganancia en ${usd(t.precio)}${peso != null ? ` (pesa ${num(peso, 1)}%, tope ${tope}%)` : ""}.` };
    return enCartera
      ? { emoji: "⚪", titulo: "MANTENER", fuerza: null, plan: "Está caro: no sumar ahora." }
      : { emoji: "🟡", titulo: "ESPERAR", fuerza: null, plan: sop ? `Caro. Mejor zona: cerca de ${usd(sop)}.` : "Caro: esperar retroceso." };
  }
  return { emoji: "⚪", titulo: "MANTENER", fuerza: null, plan: "Movimiento fuerte sin señal clara." };
}

function mensajeAlerta(sym, t, evs, enCartera, sig) {
  const v = veredicto(sym, t, evs, enCartera, sig);
  return [
    `${v.emoji} <b>${v.titulo} · ${esc(sym)}</b>${v.fuerza ? ` (${v.fuerza})` : ""}`,
    `${usd(t.precio)} · ${pctTxt(t.var_1d_pct)} hoy · ${enCartera ? "📁 en cartera" : "👀 candidato"}`,
    `<b>${esc(v.plan)}</b>`,
    "",
    ...evs.map((e) => `${e.emoji} ${esc(e.texto)}${historialEv(e.id)}`),
  ].join("\n");
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
    const evs = eventos(t, sym);
    const v = evs.length ? veredicto(sym, t, evs, true, sig) : { emoji: "⚪", titulo: "MANTENER" };
    const corto = v.titulo.replace("SEÑAL DE ", "");
    lines.push(`${v.emoji} <b>${corto}</b> · ${esc(sym)} ${usd(t.precio)} · ${pctTxt(t.var_1d_pct)}`);
  }
  lines.push("", "<i>Señales técnicas por reglas fijas. Vos decidís.</i>");
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
    let evs = eventos(t, sym);
    // Menos ruido: de los candidatos solo interesan las señales de compra y las
    // rupturas. "Caro" y "alerta" importan solo para lo que ya tenés.
    if (!enCartera && !evs.some((e) => e.tipo === "compra" || e.tipo === "ruptura")) evs = [];
    // Un movimiento fuerte solo, sin otra señal, no alcanza para avisar
    if (evs.length && evs.every((e) => e.tipo === "info")) evs = [];
    // Re-armar condiciones que dejaron de cumplirse
    const ahora = new Set(eventos(t, sym).map((e) => `${sym}:${e.id}`));
    for (const k of Object.keys(state.activos))
      if (k.startsWith(`${sym}:`) && !ahora.has(k) && state.activos[k] !== hoy) delete state.activos[k];
    const nuevosTodos = evs.filter((e) => !state.activos[`${sym}:${e.id}`]);
    // Eventos que REGISTRO apagó por mal historial: no se avisan, pero se anotan
    // "en sombra" para seguir midiéndolos (y prenderlos de nuevo si mejoran)
    const sombra = nuevosTodos.filter((e) => estadoEv(e.id) === "apagada");
    let nuevos = nuevosTodos.filter((e) => estadoEv(e.id) !== "apagada");
    if (nuevos.length && nuevos.every((e) => e.tipo === "info")) nuevos = [];
    if (sombra.length && !primeraVez) {
      for (const e of sombra) state.activos[`${sym}:${e.id}`] = hoy;
      state.log.push({ ts: new Date().toISOString(), ticker: sym, enCartera, sombra: true, eventos: sombra.map((e) => e.id), precio: t.precio, rsi14: t.rsi14, message_id: null });
    }
    if (!nuevos.length) continue;
    if (primeraVez && !TEST) { for (const e of nuevos) state.activos[`${sym}:${e.id}`] = hoy; continue; }
    const id = await send(mensajeAlerta(sym, t, nuevos, enCartera, sig));
    const v = veredicto(sym, t, nuevos, enCartera, sig);
    // Qué va al privado (vigia-config.json > privado):
    //   cartera: "fuertes" | "todas" | "nada" · candidatos: "compra_fuerte" | "compra" | "nada"
    const P = CONFIG.privado || { cartera: "fuertes", candidatos: "compra_fuerte" };
    const accion = /COMPRA|VENTA/.test(v.titulo) && v.titulo !== "NO COMPRAR";
    const alPrivado = enCartera
      ? accion && (P.cartera === "todas" || (P.cartera === "fuertes" && v.fuerza === "fuerte") || (P.cartera === "ventas_todas_compras_fuertes" && (/VENTA/.test(v.titulo) || v.fuerza === "fuerte")))
      : /SEÑAL DE COMPRA/.test(v.titulo) && (P.candidatos === "compra" || (P.candidatos === "compra_fuerte" && v.fuerza === "fuerte"));
    if (id && PRIVADO && alPrivado && !(/COMPRA/.test(v.titulo) && compradoEsteMes(sym)))
      await sendTo(PRIVADO, `${v.emoji} <b>${v.titulo}${v.fuerza === "fuerte" ? " FUERTE" : ""} · ${esc(sym)}</b>\n${usd(t.precio)} · ${pctTxt(t.var_1d_pct)} hoy\n<b>${esc(v.plan)}</b>\n${nuevos.map((e) => `${e.emoji} ${esc(e.texto)}`).join("\n")}\n<i>Debate completo en el grupo grande. Respondé acá para hablar con ANALISTA.</i>`);
    if (id === false) continue;
    enviados++;
    for (const e of nuevos) state.activos[`${sym}:${e.id}`] = hoy;
    // El log queda para los próximos bots (ANALISTA responde a message_id; REGISTRO mide resultados)
    state.log.push({ ts: new Date().toISOString(), ticker: sym, enCartera, veredicto: veredicto(sym, t, nuevos, enCartera, sig).titulo, eventos: nuevos.map((e) => e.id), precio: t.precio, rsi14: t.rsi14, message_id: id });
  }
  state.log = state.log.slice(-500);

  console.log(`VIGÍA: ${enviados} mensaje(s) ${DRY ? "(modo prueba, sin enviar)" : "enviados"}`);
  if (!DRY || process.argv.includes("--save")) await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
