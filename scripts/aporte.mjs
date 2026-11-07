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
const MONTO_SPY = R.aporte_spy_usd ?? 100;
const MONTO_LIBRE = (R.aporte_mensual_usd ?? 250) - MONTO_SPY;

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
const alertaPrivada = (text, botones) => (PRIVADO && CONFIG.privado?.aporte !== false ? send(`🚨 <b>ALERTA</b>\n${text}`, botones, PRIVADO) : null);

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

// Candidato(s) para los US$ 150. Una posición por mes; dos de US$ 75 solo si
// hay dos oportunidades fuertes a la vez. Prioriza lo que ya tenés y pesa
// poco: un nombre nuevo tiene que tener una señal claramente mejor.
function mejorLibre(sig) {
  const A = CONFIG.aporte || {};
  const arg = new Set(CONFIG.argentina || []);
  const peso = pesos(sig);
  const ten = CONFIG.tenencias || {};
  const tope = R.tope_posicion_pct ?? 12;
  const lista = [...new Set([...(CONFIG.cartera || []), ...(CONFIG.candidatos || [])])]
    // que al menos 1 CEDEAR entre en los US$ 150
    .filter((s) => s !== "SPY" && !arg.has(s) && sig.tickers[s] && sig.tickers[s].precio <= MONTO_LIBRE && !((peso[s] || 0) >= tope - 1));
  const puntuados = [];
  for (const s of lista) {
    const t = sig.tickers[s], p = t.previo || {};
    if (!p.soporte_3m || !p.resistencia_3m || t.rsi14 == null || p.resistencia_3m <= p.soporte_3m) continue;
    const pos = clamp((t.precio - p.soporte_3m) / (p.resistencia_3m - p.soporte_3m), 0, 1);
    let sc = (1 - pos) * 50 + (70 - clamp(t.rsi14, 20, 70));
    if (t.sma200 && t.precio < t.sma200 * 0.9) sc -= 25;
    if (t.precio < p.soporte_3m * 0.99) sc -= 20;
    const tiene = !!ten[s];
    const bono = tiene && A.prioridad !== "lo_que_mejor_este" ? (A.bono_base ?? 10) + clamp((tope - (peso[s] || 0)) * 1.5, 0, (A.bono_max ?? 25) - (A.bono_base ?? 10)) : 0;
    if (A.prioridad === "solo_lo_que_tengo" && !tiene) continue;
    puntuados.push({
      ticker: s, puntaje: Math.round(sc), orden: sc + bono, t, tiene, peso: peso[s] || 0,
      motivos: [`${pos <= 0.15 ? "apoyado en" : "a " + num(pos * 100, 0) + "% del rango desde"} su soporte de 3 meses (${usd(p.soporte_3m)})`, `RSI ${num(t.rsi14, 0)}`],
    });
  }
  puntuados.sort((a, b) => b.orden - a.orden);
  const uno = puntuados[0];
  // para partir en 75/75, el segundo también tiene que entrar en US$ 75 (y el primero)
  const dos = uno && uno.t.precio <= MONTO_LIBRE / 2 ? puntuados.slice(1).find((x) => x.t.precio <= MONTO_LIBRE / 2) : null;
  if (!uno) return null;
  const fuerte = A.umbral_fuerte ?? 85;
  const detalle = (x) => `${esc(x.ticker)} ${usd(x.t.precio)} · ${esc(x.motivos.join(" · "))}${x.tiene ? ` · ya lo tenés (${num(x.peso, 1)}%)` : " · posición nueva"}`;
  if (A.libre_modo !== "una" && dos && uno.puntaje >= fuerte && dos.puntaje >= fuerte) {
    return { ticker: `${uno.ticker}+${dos.ticker}`, nombre: `${uno.ticker} + ${dos.ticker} (US$ ${MONTO_LIBRE / 2} c/u)`, puntaje: Math.min(uno.puntaje, dos.puntaje), texto: `${detalle(uno)}\n   ${detalle(dos)}`, partes: [uno.ticker, dos.ticker] };
  }
  return { ticker: uno.ticker, nombre: uno.ticker, puntaje: uno.puntaje, texto: detalle(uno), partes: [uno.ticker] };
}

// ---------- main ----------
async function main() {
  const sig = JSON.parse(await fs.readFile(path.join(DATA, "signals.json"), "utf8"));
  let reg = {};
  try { reg = JSON.parse(await fs.readFile(path.join(DATA, "registro.json"), "utf8")); } catch {}
  const d = hoy(), mesKey = d.slice(0, 7);
  const dow = nowAr().getUTCDay();
  const nombreMes = MESES[Number(d.slice(5, 7)) - 1];

  let st = { mes: null, spy: null, libre: null, avisos: {}, resumenDia: null, offset: 0 };
  try { st = { ...st, ...JSON.parse(await fs.readFile(STATE_FILE, "utf8")) }; } catch {}
  const mesNuevo = st.mes !== mesKey;
  if (mesNuevo) { st.mes = mesKey; st.spy = null; st.libre = null; st.avisos = {}; st.cerrado = false; }
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
      await send(`✅ <b>Anotado: US$ ${MONTO_LIBRE} de ${nombreMes}${tk ? ` en ${esc(tk)}` : ""}</b>${px ? ` (≈ ${usd(px)})` : ""}.${tk ? "\n<i>Si compraste otra cosa, mandá /compre libre TICKER.</i>" : ""}`);
    }
  }
  if (st.spy && st.libre && !st.cerrado) {
    st.cerrado = true;
    await send(`🎯 <b>Aporte de ${nombreMes} completo.</b> No te aviso más hasta el mes que viene.`);
  }

  if (dow === 0 || dow === 6) return guardar(st, cambioConfig);
  const restan = ruedasRestantes(d);
  const minVara = vara(restan);
  const ahora = hora();

  const spyT = sig.tickers.SPY;
  const spy = spyT ? puntajeSpy(spyT) : null;
  const libre = mejorLibre(sig);
  if (libre) st.sugeridoLibre = libre.ticker;

  const btnSpy = [{ text: `✅ Ya compré SPY`, callback_data: "spy" }];
  const btnLibre = libre ? [{ text: `✅ Ya compré los ${MONTO_LIBRE}`, callback_data: `libre:${libre.ticker}` }] : null;

  const lineaSpy = () => {
    if (st.spy) return `✅ SPY: comprado el ${st.spy.fecha.slice(8)}/${st.spy.fecha.slice(5, 7)}.`;
    const ok = spy.puntaje >= minVara;
    const head = minVara === 0 ? "🔔 <b>SPY: COMPRÁ HOY O MAÑANA</b> (se termina el mes)" : ok ? `🟢 <b>SPY: BUEN DÍA PARA COMPRAR</b> (${spy.puntaje}/100)` : `⏳ <b>SPY: ESPERAR</b> (${spy.puntaje}/100, necesito ${minVara})`;
    return `${head}\n   ${usd(spyT.precio)} · ${esc(spy.motivos.join(" · "))}`;
  };
  const lineaLibre = () => {
    if (st.libre) return `✅ US$ ${MONTO_LIBRE}: comprado${st.libre.ticker ? ` (${esc(st.libre.ticker)})` : ""}.`;
    if (!libre) return `• US$ ${MONTO_LIBRE}: sin candidato claro hoy.`;
    const ok = libre.puntaje >= minVara;
    const head = minVara === 0 ? `🔔 <b>US$ ${MONTO_LIBRE}: COMPRÁ ${esc(libre.nombre)} HOY O MAÑANA</b>` : ok ? `🟢 <b>US$ ${MONTO_LIBRE}: BUEN DÍA PARA ${esc(libre.nombre)}</b> (${libre.puntaje}/100)` : `⏳ <b>US$ ${MONTO_LIBRE}: ESPERAR</b> (mejor hoy: ${esc(libre.nombre)}, ${libre.puntaje}/100)`;
    return `${head}\n   ${libre.texto}`;
  };

  // 2) arranque de mes
  if (mesNuevo && !st.spy) {
    await send(`📅 <b>${restan >= 18 ? `Arranca ${nombreMes}` : `${nombreMes[0].toUpperCase()}${nombreMes.slice(1)}`}: plan del aporte de US$ ${MONTO_SPY + MONTO_LIBRE}</b>\n• US$ ${MONTO_SPY} a SPY\n• US$ ${MONTO_LIBRE} a elección\nHay ${restan} ruedas. Te aviso el mejor día para cada parte; los primeros días soy exigente y a fin de mes te apuro para que no se pase.`);
  }

  // 3) estado diario a las 11:45
  if (!st.cerrado && st.resumenDia !== d && (ahora >= (CONFIG.resumen_apertura_ar || "11:45") || TEST)) {
    const botones = [...(!st.spy ? btnSpy : []), ...(!st.libre && btnLibre ? btnLibre : [])];
    const r = await send(`💵 <b>Aporte de ${nombreMes} · quedan ${restan} ruedas</b>\n\n${lineaSpy()}\n\n${lineaLibre()}`, botones.length ? botones : null);
    if (r.ok) {
      st.resumenDia = d;
      // al privado solo si hoy hay algo para comprar (o se termina el mes)
      const verdeSpy = !st.spy && spy && spy.puntaje >= minVara;
      const verdeLibre = !st.libre && libre && libre.puntaje >= minVara;
      if (verdeSpy || verdeLibre) {
        const partes = [verdeSpy ? lineaSpy() : null, verdeLibre ? lineaLibre() : null].filter(Boolean);
        await alertaPrivada(`${minVara === 0 ? "Último aviso del mes" : "Hoy es buen día para el aporte"} de ${nombreMes}:\n\n${partes.join("\n\n")}`, [...(verdeSpy ? btnSpy : []), ...(verdeLibre && btnLibre ? btnLibre : [])]);
      }
    }
  }

  // 4) aviso en el día si aparece un buen momento (una vez por día y por parte,
  //    solo después del resumen; si el resumen ya dijo "comprar", no se repite)
  st.avisos[d] = st.avisos[d] || {};
  const av = st.avisos[d];
  if (st.resumenDia === d && !av.marcado) {
    av.marcado = true;
    if (spy && spy.puntaje >= minVara) av.spy = true;
    if (libre && libre.puntaje >= minVara) av.libre = true;
  }
  if (st.resumenDia === d && minVara > 0) {
    if (!st.spy && spy && spy.puntaje >= minVara && !av.spy) {
      const r = await send(`🟢 <b>Buen momento para tu SPY de ${nombreMes}</b>\n${usd(spyT.precio)} · ${esc(spy.motivos.join(" · "))}\nPuntaje ${spy.puntaje}/100 · quedan ${restan} ruedas`, btnSpy);
      if (r.ok) { av.spy = true; await alertaPrivada(`Buen momento para tu SPY de ${nombreMes}: ${usd(spyT.precio)} (${spy.puntaje}/100).\n${esc(spy.motivos.join(" · "))}`, btnSpy); }
    }
    if (!st.libre && libre && libre.puntaje >= minVara && !av.libre) {
      const r = await send(`🟢 <b>Buen momento para los US$ ${MONTO_LIBRE}: ${esc(libre.nombre)}</b>\n${libre.texto}\nPuntaje ${libre.puntaje}/100 · quedan ${restan} ruedas`, btnLibre);
      if (r.ok) { av.libre = true; await alertaPrivada(`Buen momento para los US$ ${MONTO_LIBRE}: <b>${esc(libre.nombre)}</b> (${libre.puntaje}/100)\n${libre.texto}`, btnLibre); }
    }
  }
  // limpiar avisos viejos
  for (const k of Object.keys(st.avisos)) if (k < d) delete st.avisos[k];

  console.log(`APORTE ${mesKey}: SPY ${st.spy ? "comprado" : spy?.puntaje}, libre ${st.libre ? "comprado" : `${libre?.ticker} ${libre?.puntaje}`}, vara ${minVara}, restan ${restan}`);
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
