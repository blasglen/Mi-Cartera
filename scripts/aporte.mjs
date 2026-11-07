// APORTE — el plan del aporte mensual de US$ 250.
//
// Durante el mes te dice qué día conviene comprar:
//   • US$ 100 a SPY (regla fija)
//   • US$ 150 al mejor candidato técnico (sin Argentina y respetando el tope)
//
// Cómo decide: puntaje 0-100 según cuánto cayó desde el máximo del mes, qué
// tan abajo está de su media de 20 ruedas y el RSI. La vara baja a medida que
// se termina el mes, así nunca te quedás sin comprar: las últimas 2 ruedas es
// "comprá sí o sí".
//
// Mensajes (bot VIGÍA):
//   - primer día hábil del mes: arranque del plan
//   - todos los días a las 11:45: estado del aporte (comprar hoy / esperar)
//   - durante el día: aviso si aparece un buen momento (una vez por día)
//   - botones "✅ Ya compré": se leen en la corrida siguiente (≤15 min)
//   - al completar: comparación de tu precio contra el promedio del mes
//
// Uso: node scripts/aporte.mjs [--dry] [--test]

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const CFG_FILE = path.join(ROOT, "scripts", "vigia-config.json");
const STATE_FILE = path.join(DATA, "aporte-state.json");
const CONFIG = JSON.parse(await fs.readFile(CFG_FILE, "utf8"));
const R = CONFIG.reglas || {};
import { montoDelMes } from "./aporte-monto.mjs";
const MONTOS = montoDelMes(CONFIG, new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7));
const MONTO_SPY = MONTOS.spy;
const MONTO_LIBRE = MONTOS.libre;

const env = process.env;
const TOKEN = env.TG_VIGIA, CHAT = env.TG_CHAT_ID;
const DRY = process.argv.includes("--dry") || !TOKEN || !CHAT;
const TEST = process.argv.includes("--test");

const nowAr = () => new Date(Date.now() - 3 * 3600e3);
const hoy = () => nowAr().toISOString().slice(0, 10);
const hora = () => nowAr().toISOString().slice(11, 16);
const num = (x, d = 2) => (x == null ? "s/d" : x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const usd = (x) => `US$ ${num(x)}`;
const pct = (x) => (x == null ? "s/d" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${num(Math.abs(x), 1)}%`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- Telegram ----------
async function tg(method, body) {
  if (DRY && method !== "getUpdates") { if (body.text) console.log(`\n----- ${method} (no enviado) -----\n${body.text.replace(/<[^>]+>/g, "")}${body.reply_markup ? `\n[botones: ${body.reply_markup.inline_keyboard.flat().map((b) => b.text).join(" | ")}]` : ""}`); return { ok: true, result: { message_id: 1 } }; }
  if (!TOKEN) return { ok: false };
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}
const send = (text, botones, chat = CHAT) => tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(botones ? { reply_markup: { inline_keyboard: [botones] } } : {}) });
// Alerta al privado de Blas (si alguna vez le dio /start a @BlasVigiaBot)
let PRIVADO = null;
const alertaPrivada = (text, botones) => (PRIVADO && CONFIG.privado?.aporte !== false ? send(text, botones, PRIVADO) : null);

// ---------- calendario ----------
// Ruedas hábiles que quedan en el mes contando hoy (lun-vie; no descuenta feriados)
function ruedasRestantes(fecha) {
  const d = new Date(fecha + "T12:00:00Z");
  const mes = d.getUTCMonth();
  let n = 0;
  for (const x = new Date(d); x.getUTCMonth() === mes; x.setUTCDate(x.getUTCDate() + 1)) if (x.getUTCDay() % 6 !== 0) n++;
  return n;
}
function vara(restan) {
  if (restan <= 2) return 0; // comprá sí o sí
  if (restan <= 5) return 40;
  if (restan <= 10) return 55;
  return 65;
}

// ---------- puntajes ----------
function puntajeSpy(t) {
  const caida = (t.precio / (t.resistencia_1m || t.precio) - 1) * 100; // ≤ 0
  const vsMedia = t.sma20 ? (t.precio / t.sma20 - 1) * 100 : 0;
  const pCaida = clamp(-caida * 10, 0, 40);
  const pMedia = clamp(20 - vsMedia * 10, 0, 30);
  const pRsi = t.rsi14 != null ? clamp((60 - t.rsi14) * 1.5, 0, 30) : 10;
  const motivos = [];
  if (caida <= -2) motivos.push(`cayó ${num(-caida, 1)}% desde el máximo del mes`);
  if (vsMedia < 0) motivos.push(`está ${num(-vsMedia, 1)}% abajo de su media de 20 ruedas`);
  else if (vsMedia > 1.5) motivos.push(`está ${num(vsMedia, 1)}% arriba de su media de 20 ruedas`);
  if (t.rsi14 != null) motivos.push(`RSI ${num(t.rsi14, 0)}${t.rsi14 <= 35 ? " (sobrevendido)" : t.rsi14 >= 65 ? " (caro)" : ""}`);
  return { puntaje: Math.round(pCaida + pMedia + pRsi), motivos };
}

function pesos(sig) {
  const ten = CONFIG.tenencias || {};
  let total = 0;
  const val = {};
  for (const [s, n] of Object.entries(ten)) { const px = sig.tickers[s]?.precio; if (px) { val[s] = px * n; total += px * n; } }
  return Object.fromEntries(Object.entries(val).map(([s, v]) => [s, (v / total) * 100]));
}

// ---------- los US$ 150: UN elegido por mes ----------
// Puntaje técnico de cada candidato válido (sin Argentina, sin lo que está
// cerca del tope, sin CEDEARs que cuesten más que el monto).
function puntuarTodos(sig) {
  const A = CONFIG.aporte || {};
  const arg = new Set(CONFIG.argentina || []);
  const peso = pesos(sig);
  const ten = CONFIG.tenencias || {};
  const tope = R.tope_posicion_pct ?? 12;
  const out = {};
  const lista = [...new Set([...(CONFIG.cartera || []), ...(CONFIG.candidatos || [])])]
    .filter((s) => s !== "SPY" && !arg.has(s) && sig.tickers[s] && sig.tickers[s].precio <= MONTO_LIBRE && !((peso[s] || 0) >= tope - 1));
  for (const s of lista) {
    const t = sig.tickers[s], p = t.previo || {};
    if (!p.soporte_3m || !p.resistencia_3m || t.rsi14 == null || p.resistencia_3m <= p.soporte_3m) continue;
    const tiene = !!ten[s];
    if (A.prioridad === "solo_lo_que_tengo" && !tiene) continue;
    const pos = clamp((t.precio - p.soporte_3m) / (p.resistencia_3m - p.soporte_3m), 0, 1);
    let sc = (1 - pos) * 50 + (70 - clamp(t.rsi14, 20, 70));
    if (t.sma200 && t.precio < t.sma200 * 0.9) sc -= 25;
    const rompio = t.precio < p.soporte_3m * 0.97; // tesis rota: perdió el soporte con claridad
    if (rompio) sc -= 20;
    const bono = tiene && A.prioridad !== "lo_que_mejor_este" ? (A.bono_base ?? 10) + clamp((tope - (peso[s] || 0)) * 1.5, 0, (A.bono_max ?? 25) - (A.bono_base ?? 10)) : 0;
    out[s] = {
      ticker: s, puntaje: Math.round(sc), orden: sc + bono, t, tiene, peso: peso[s] || 0, rompio, soporte: p.soporte_3m,
      motivos: [`${pos <= 0.15 ? "apoyado en" : "a " + num(pos * 100, 0) + "% del rango desde"} su soporte de 3 meses (${usd(p.soporte_3m)})`, `RSI ${num(t.rsi14, 0)}`],
    };
  }
  return out;
}

// Elige el del mes: el mejor por orden (prioriza lo que ya tenés y pesa poco).
// 75/75 solo si los dos mejores son fuertes y ambos entran en US$ 75.
function elegirDelMes(todos, minimo = 0) {
  const A = CONFIG.aporte || {};
  const lista = Object.values(todos).filter((x) => !x.rompio && x.puntaje >= minimo).sort((a, b) => b.orden - a.orden);
  const uno = lista[0];
  if (!uno) return null;
  const fuerte = A.umbral_fuerte ?? 85;
  const dos = uno.t.precio <= MONTO_LIBRE / 2 ? lista.slice(1).find((x) => x.t.precio <= MONTO_LIBRE / 2) : null;
  const partes = A.libre_modo !== "una" && dos && uno.puntaje >= fuerte && dos.puntaje >= fuerte ? [uno.ticker, dos.ticker] : [uno.ticker];
  return { ticker: partes.join("+"), partes, nombre: partes.length > 1 ? `${partes.join(" + ")} (US$ ${num(MONTO_LIBRE / 2)} c/u)` : partes[0] };
}

// Estado del elegido hoy (puntaje = el más bajo de sus partes)
function evaluarElegido(el, todos) {
  const xs = el.partes.map((p) => todos[p]);
  if (xs.some((x) => !x)) return { valido: false, motivo: "ya no entra en tus reglas (tope o precio)" };
  const roto = xs.find((x) => x.rompio);
  if (roto) return { valido: false, motivo: `${roto.ticker} perdió su soporte de 3 meses (${usd(roto.soporte)})` };
  const puntaje = Math.min(...xs.map((x) => x.puntaje));
  const detalle = xs.map((x) => `${esc(x.ticker)} ${usd(x.t.precio)} · ${esc(x.motivos.join(" · "))}${x.tiene ? ` · ya lo tenés (${num(x.peso, 1)}%)` : " · posición nueva"}`).join("\n   ");
  const hasta = xs.map((x) => `${esc(x.ticker)} hasta ${usd(x.t.precio * 1.01)}`).join(" · ");
  return { valido: true, puntaje, detalle, hasta, xs };
}

// ---------- main ----------
async function main() {
  const sig = JSON.parse(await fs.readFile(path.join(DATA, "signals.json"), "utf8"));
  let reg = {};
  try { reg = JSON.parse(await fs.readFile(path.join(DATA, "registro.json"), "utf8")); } catch {}
  const d = hoy(), mesKey = d.slice(0, 7);
  const dow = nowAr().getUTCDay();
  const nombreMes = MESES[Number(d.slice(5, 7)) - 1];

  let st = { mes: null, spy: null, libre: null, resumenDia: null, offset: 0 };
  try { st = { ...st, ...JSON.parse(await fs.readFile(STATE_FILE, "utf8")) }; } catch {}
  const mesNuevo = st.mes !== mesKey;
  if (mesNuevo) { st.mes = mesKey; st.spy = null; st.libre = null; st.cerrado = false; st.elegido = null; st.verde = {}; st.ultimoAviso = {}; st.resumenDia = null; }
  PRIVADO = st.privado || null;

  // 1) botones "Ya compré" (y comando /compre spy|libre TICKER)
  const up = await tg("getUpdates", { offset: st.offset || 0, timeout: 0, allowed_updates: ["callback_query", "message"] });
  let cambioConfig = false;
  for (const u of up.result || []) {
    st.offset = u.update_id + 1;
    let que = null, ticker = null;
    const chatOk = (id) => String(id) === String(CHAT) || (PRIVADO && String(id) === String(PRIVADO));
    // Si el grupo de alertas se convierte en supergrupo, Telegram le cambia el ID
    if (u.message?.migrate_to_chat_id && PRIVADO && String(u.message.chat.id) === String(PRIVADO)) {
      st.privado = PRIVADO = u.message.migrate_to_chat_id;
      continue;
    }
    // /start en privado o en otro grupo (el "grupo de alertas" con VIGÍA y ANALISTA):
    // desde ahora las alertas importantes van ahí
    const chat = u.message?.chat;
    if (chat && /^\/start/.test(u.message.text || "") && String(chat.id) !== String(CHAT)) {
      st.privado = PRIVADO = chat.id;
      const enGrupo = chat.type !== "private";
      await send(`👋 Listo. ${enGrupo ? "Este es tu grupo de alertas" : "Te voy a escribir por acá"}: <b>solo lo importante</b>:\n• buen día para comprar SPY o los US$ 150 del mes\n• último aviso del mes para no saltearte el aporte\n• señales FUERTES de compra o venta${enGrupo ? "\n\nRespondé cualquier alerta y ANALISTA te contesta acá." : ""}\n\nEl detalle completo sigue en el grupo grande; podés silenciarlo.`, null, PRIVADO);
      continue;
    }
    if (u.callback_query && chatOk(u.callback_query.message?.chat?.id)) {
      [que, ticker] = String(u.callback_query.data || "").split(":");
      tg("answerCallbackQuery", { callback_query_id: u.callback_query.id, text: "Anotado ✅" }).catch(() => {});
      tg("editMessageReplyMarkup", { chat_id: u.callback_query.message.chat.id, message_id: u.callback_query.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    } else if (u.message?.text && chatOk(u.message.chat.id)) {
      const m = u.message.text.match(/^\/compre(?:@\w+)?\s+(spy|libre|[\w+]+)\s*([\w+]+)?/i);
      if (m) { que = m[1].toLowerCase() === "spy" ? "spy" : "libre"; ticker = (m[2] || (que === "libre" && m[1].toLowerCase() !== "libre" ? m[1] : "")).toUpperCase() || null; }
    }
    if (!que) continue;
    if (que === "spy" && !st.spy) {
      const px = sig.tickers.SPY?.precio;
      st.spy = { fecha: d, precio: px };
      cambioConfig = sumarTenencia("SPY", MONTO_SPY, px) || cambioConfig;
      await send(`✅ <b>Anotado: SPY de ${nombreMes} comprado</b> (≈ ${usd(px)}).\n${compararConMes(reg, "SPY", px, mesKey)}`);
    } else if (que === "libre" && !st.libre) {
      const tk = ticker || st.sugeridoLibre || null;
      const partes = tk ? tk.split("+") : [];
      const px = partes.length === 1 ? sig.tickers[tk]?.precio : null;
      st.libre = { fecha: d, ticker: tk, precio: px };
      for (const pt of partes) { const p1 = sig.tickers[pt]?.precio; if (p1) cambioConfig = sumarTenencia(pt, MONTO_LIBRE / partes.length, p1) || cambioConfig; }
      await send(`✅ <b>Anotado: US$ ${num(MONTO_LIBRE)} de ${nombreMes}${tk ? ` en ${esc(tk)}` : ""}</b>${px ? ` (≈ ${usd(px)})` : ""}.${tk ? "\n<i>Si compraste otra cosa, mandá /compre libre TICKER.</i>" : ""}`);
    }
  }
  if (st.spy && st.libre && !st.cerrado) {
    st.cerrado = true;
    await send(`🎯 <b>Aporte de ${nombreMes} completo.</b> No te aviso más hasta el mes que viene.`);
  }

  // Plan de aportes (este mes + 12) para que ANALISTA lo lea sin tocar su código
  st.plan = Array.from({ length: 13 }, (_, i) => {
    const dt = new Date(Date.UTC(Number(mesKey.slice(0, 4)), Number(mesKey.slice(5, 7)) - 1 + i, 1));
    const mk = dt.toISOString().slice(0, 7);
    const m = montoDelMes(CONFIG, mk);
    return { mes: mk, total: m.total, spy: m.spy, libre: m.libre };
  });
  st.regla = `Aporte base US$ ${R.aporte_base_usd} en ${R.aporte_base_mes}, +${R.crecimiento_mensual_pct}% por mes compuesto; ${R.spy_pct}% a SPY, el resto solo ante una oportunidad excelente.`;
  if (dow === 0 || dow === 6) return guardar(st, cambioConfig);
  const restan = ruedasRestantes(d);
  const minVara = vara(restan);
  const ahora = hora();
  const yaEsHora = ahora >= (CONFIG.resumen_apertura_ar || "11:45") || TEST;
  st.verde = st.verde || {};
  st.ultimoAviso = st.ultimoAviso || {};

  // SPY
  const spyT = sig.tickers.SPY;
  const spy = spyT ? puntajeSpy(spyT) : null;

  // US$ 150: NO se elige de antemano. Se mira todo en silencio y se avisa solo
  // cuando aparece una oportunidad EXCELENTE (puntaje >= umbral_excelente).
  // Ahí queda fijado ese nombre (no te ofrece alternativas). Si su tesis se rompe
  // antes de que compres, se anula y se vuelve a buscar. Con 5 ruedas o menos
  // baja la vara para no saltearte el mes; en las 2 últimas, el mejor disponible.
  const A = CONFIG.aporte || {};
  const excelente = A.umbral_excelente ?? 85;
  const umbralLibre = restan <= 2 ? 0 : restan <= 5 ? (A.umbral_fin_de_mes ?? 65) : excelente;
  const todos = puntuarTodos(sig);
  let ev = null;
  if (!st.libre && yaEsHora) {
    if (st.elegido) {
      ev = evaluarElegido(st.elegido, todos);
      if (!ev.valido) {
        const txt = `❌ <b>Anulo la señal de ${esc(st.elegido.nombre)}</b> para los US$ ${num(MONTO_LIBRE)}: ${esc(ev.motivo)}.\nSi no compraste, no compres. Sigo buscando otra oportunidad excelente.`;
        await send(txt); await alertaPrivada(txt);
        st.elegido = null; st.verde.libre = false; ev = null;
      }
    }
    if (!st.elegido) {
      const nuevo = elegirDelMes(todos, umbralLibre);
      if (nuevo) { st.elegido = { ...nuevo, desde: d }; ev = evaluarElegido(st.elegido, todos); }
    } else if (st.elegido.partes.length === 1 && ev?.valido && A.libre_modo !== "una") {
      // ¿Apareció una SEGUNDA oportunidad excelente mientras esperás? → repartir 75/75
      const primero = todos[st.elegido.partes[0]];
      const segundo = primero && primero.t.precio <= MONTO_LIBRE / 2
        ? Object.values(todos).filter((x) => x.ticker !== primero.ticker && !x.rompio && x.puntaje >= excelente && x.t.precio <= MONTO_LIBRE / 2).sort((a, b) => b.orden - a.orden)[0]
        : null;
      if (segundo) {
        st.elegido = { ticker: `${primero.ticker}+${segundo.ticker}`, partes: [primero.ticker, segundo.ticker], nombre: `${primero.ticker} + ${segundo.ticker} (US$ ${num(MONTO_LIBRE / 2)} c/u)`, desde: st.elegido.desde, sumado: d };
        ev = evaluarElegido(st.elegido, todos);
        const txt = `🟢🟢 <b>SEGUNDA OPORTUNIDAD EXCELENTE · ${esc(segundo.ticker)}</b>\nSi todavía no compraste ${esc(primero.ticker)}, repartí los US$ ${num(MONTO_LIBRE)}:\n• US$ ${num(MONTO_LIBRE / 2)} → ${esc(primero.ticker)} hasta ${usd(primero.t.precio * 1.01)}\n• US$ ${num(MONTO_LIBRE / 2)} → ${esc(segundo.ticker)} hasta ${usd(segundo.t.precio * 1.01)}\n<i>${esc(segundo.ticker)}: ${esc(segundo.motivos.join(" · "))}</i>`;
        const botones = [
          { text: `✅ Compré ${primero.ticker}+${segundo.ticker}`, callback_data: `libre:${primero.ticker}+${segundo.ticker}` },
          { text: `✅ Ya había comprado ${primero.ticker}`, callback_data: `libre:${primero.ticker}` },
        ];
        await send(txt, botones); await alertaPrivada(txt, botones);
      }
    }
  }
  const btnSpy = [{ text: `✅ Ya compré SPY`, callback_data: "spy" }];
  const btnLibre = st.elegido ? [{ text: `✅ Ya compré ${st.elegido.partes.join("+")}`, callback_data: `libre:${st.elegido.ticker}` }] : null;
  if (st.elegido) st.sugeridoLibre = st.elegido.ticker;

  // ¿Es el día? Con histéresis: se prende al pasar la vara y se apaga recién 10 puntos abajo
  const esDia = (parte, puntaje, vara_) => {
    if (vara_ === 0) return true;
    if (puntaje >= vara_) return true;
    if (st.verde[parte] && puntaje >= vara_ - 10) return true;
    return false;
  };
  const diaSpy = !st.spy && spy ? esDia("spy", spy.puntaje, minVara) : false;
  const diaLibre = !st.libre && ev?.valido ? esDia("libre", ev.puntaje, umbralLibre) : false;

  // 2) arranque de mes (grupo grande)
  if (mesNuevo && !st.spy) {
    await send(`📅 <b>${restan >= 18 ? `Arranca ${nombreMes}` : `${nombreMes[0].toUpperCase()}${nombreMes.slice(1)}`}: plan del aporte de US$ ${num(MONTOS.total)}${MONTOS.meses ? ` (+1,5% por mes desde nov-2026)` : ""}</b>\n• US$ ${num(MONTO_SPY)} a SPY\n• US$ ${num(MONTO_LIBRE)}: te aviso solo cuando aparezca una oportunidad EXCELENTE (un solo nombre)\nHay ${restan} ruedas. Te aviso <b>solo el día</b> de comprar cada parte; a fin de mes te apuro para que no se pase.`);
  }

  // 3) estado diario 11:45 (solo grupo grande: un renglón por parte, sin alternativas)
  if (!st.cerrado && st.resumenDia !== d && yaEsHora) {
    const lSpy = st.spy ? "✅ SPY: comprado." : minVara === 0 ? `🔔 <b>SPY: COMPRÁ HOY O MAÑANA</b> · ${usd(spyT.precio)}` : diaSpy ? `🟢 <b>SPY: HOY ES EL DÍA</b> (${spy.puntaje}/100) · ${usd(spyT.precio)}` : `⏳ SPY: esperar (${spy.puntaje}/100, necesito ${minVara})`;
    const lLib = st.libre ? `✅ US$ ${num(MONTO_LIBRE)}: comprado.` : diaLibre ? `🟢 <b>US$ ${num(MONTO_LIBRE)} → ${esc(st.elegido.nombre)}: ${umbralLibre === 0 ? "COMPRÁ HOY O MAÑANA" : "HOY ES EL DÍA"}</b> (${ev.puntaje}/100)` : st.elegido ? `⏳ US$ ${num(MONTO_LIBRE)} → ${esc(st.elegido.nombre)}: señal dada, esperando que vuelva a zona (${ev?.puntaje ?? "s/d"}/100)` : `⏳ US$ ${num(MONTO_LIBRE)}: buscando una oportunidad ${umbralLibre >= excelente ? "excelente" : "buena"} (necesito ${umbralLibre}/100)`;
    const r = await send(`💵 <b>Aporte de ${nombreMes} · quedan ${restan} ruedas</b>\n${lSpy}\n${lLib}`);
    if (r.ok) st.resumenDia = d;
  }

  // 4) "HOY ES EL DÍA": un mensaje claro cuando la condición EMPIEZA (y el último
  //    aviso del mes, una vez por día). Va al grupo grande y al de alertas.
  if (yaEsHora && !st.cerrado) {
    if (!st.spy && spy) {
      const ultimo = minVara === 0;
      if (diaSpy && (ultimo ? st.ultimoAviso.spy !== d : !st.verde.spy)) {
        const txt = `${ultimo ? "🔔" : "🟢"} <b>${ultimo ? "ÚLTIMO AVISO" : "HOY ES EL DÍA"} · US$ ${num(MONTO_SPY)} → SPY</b>\nComprá hasta ${usd(spyT.precio * 1.01)} (ahora ${usd(spyT.precio)})\n<i>${esc(spy.motivos.join(" · "))}</i>`;
        const r = await send(txt, btnSpy);
        if (r.ok) { await alertaPrivada(txt, btnSpy); if (ultimo) st.ultimoAviso.spy = d; }
      }
      st.verde.spy = diaSpy;
    }
    if (!st.libre && ev?.valido) {
      const ultimo = umbralLibre === 0;
      if (diaLibre && (ultimo ? st.ultimoAviso.libre !== d : !st.verde.libre)) {
        const titulo = ultimo ? "ÚLTIMO AVISO DEL MES" : ev.puntaje >= excelente ? "OPORTUNIDAD EXCELENTE" : "BUENA OPORTUNIDAD (se termina el mes)";
        const txt = `${ultimo ? "🔔" : "🟢"} <b>${titulo} · US$ ${num(MONTO_LIBRE)} → ${esc(st.elegido.nombre)}</b>\nComprá ${ev.hasta}\n<i>${ev.xs.map((x) => `${esc(x.ticker)}: ${esc(x.motivos.join(" · "))}`).join("\n")}</i>`;
        const r = await send(txt, btnLibre);
        if (r.ok) { await alertaPrivada(txt, btnLibre); if (ultimo) st.ultimoAviso.libre = d; }
      }
      st.verde.libre = diaLibre;
    }
  }
  delete st.avisos;

  console.log(`APORTE ${mesKey}: SPY ${st.spy ? "comprado" : spy?.puntaje}${diaSpy ? " (DÍA)" : ""}, libre ${st.libre ? "comprado" : `${st.elegido?.ticker} ${ev?.puntaje}`}${diaLibre ? " (DÍA)" : ""}, vara ${minVara}, restan ${restan}`);
  return guardar(st, cambioConfig);
}

// Suma nominales aproximados a la tenencia (para que CONTROL calcule bien los pesos)
function sumarTenencia(ticker, monto, precio) {
  if (!precio) return false;
  const n = Math.floor(monto / precio);
  if (n <= 0) return false;
  CONFIG.tenencias = CONFIG.tenencias || {};
  CONFIG.tenencias[ticker] = (CONFIG.tenencias[ticker] || 0) + n;
  if (!(CONFIG.cartera || []).includes(ticker)) CONFIG.cartera.push(ticker);
  return true;
}

function compararConMes(reg, ticker, px, mesKey) {
  const precios = Object.entries(reg.precios || {}).filter(([f]) => f.startsWith(mesKey)).map(([, p]) => p[ticker]).filter(Boolean);
  if (precios.length < 3 || !px) return "";
  const prom = precios.reduce((a, b) => a + b, 0) / precios.length;
  const dif = (px / prom - 1) * 100;
  return dif < 0 ? `Pagaste ${pct(dif)} vs el promedio del mes hasta hoy (${usd(prom)}). 👌` : `Pagaste ${pct(dif)} vs el promedio del mes hasta hoy (${usd(prom)}).`;
}

async function guardar(st, cambioConfig) {
  if (DRY && !process.argv.includes("--save")) return;
  await fs.writeFile(STATE_FILE, JSON.stringify(st, null, 1));
  if (cambioConfig) await fs.writeFile(CFG_FILE, JSON.stringify(CONFIG, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
