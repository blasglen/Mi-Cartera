// LA MESA — etapa 2. Después de cada corrida de VIGÍA, toma sus avisos nuevos
// y arma la conversación en el grupo de Telegram, cada bot con su identidad y
// respondiendo al mensaje anterior:
//
//   🔭 VIGÍA (aviso técnico)
//    ↳ 📰 RADAR    — qué noticia explica el movimiento (Google News RSS + IA)
//       ↳ 🧠 ANALISTA — tesis, zona de entrada, stop y escenarios (IA)
//          ↳ 🛡️ CONTROL  — chequeo contra tus reglas (sin IA: cuentas fijas)
//
// IA gratis: Gemini (GEMINI_KEY). Si se queda sin cupo y hay GROQ_KEY, usa Groq.
// Telegram no deja que un bot lea a otro: por eso este script "hace hablar" a
// los cuatro desde un solo lugar.
//
// Uso:
//   node scripts/mesa.mjs               -> debate los avisos nuevos de VIGÍA
//   node scripts/mesa.mjs --demo AMD    -> arma la conversación completa para AMD (prueba)
//   --dry                               -> no manda nada, imprime

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const STATE_FILE = path.join(DATA, "vigia-state.json");
const CONFIG = JSON.parse(await fs.readFile(path.join(ROOT, "scripts", "vigia-config.json"), "utf8"));

const env = process.env;
const CHAT = env.TG_CHAT_ID;
const TOKENS = { VIGIA: env.TG_VIGIA, RADAR: env.TG_RADAR, ANALISTA: env.TG_ANALISTA, CONTROL: env.TG_CONTROL };
const DRY = process.argv.includes("--dry") || !CHAT || !TOKENS.RADAR;
const demoIdx = process.argv.indexOf("--demo");
const DEMO = demoIdx > -1 ? (process.argv[demoIdx + 1] || "").toUpperCase() : null;

// ---------- utilidades ----------
const num = (x, d = 2) => (x == null ? "s/d" : x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const usd = (x) => `US$ ${num(x)}`;
const pctTxt = (x) => (x == null ? "s/d" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${num(Math.abs(x), 1)}%`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(bot, text, replyTo) {
  if (DRY) { console.log(`\n----- ${bot} ${replyTo ? `(responde a ${replyTo})` : ""} -----\n` + text.replace(/<[^>]+>/g, "")); return 1; }
  const body = { chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (replyTo) body.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
  const res = await fetch(`https://api.telegram.org/bot${TOKENS[bot]}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) { console.log(`Telegram (${bot}) error: ${res.status} ${j.description || ""}`); return null; }
  await sleep(1200); // que se lea como conversación y no pegarle al límite de Telegram
  return j.result.message_id;
}

// ---------- IA gratis ----------
async function gemini(prompt) {
  if (!env.GEMINI_KEY) return null;
  for (const model of CONFIG.ia.modelos_gemini) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1200 } }),
      });
      const j = await res.json().catch(() => ({}));
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
      if (text) return text;
      console.log(`Gemini ${model}: ${res.status} ${j.error?.message?.slice(0, 160) || "sin texto"}`);
    } catch (e) { console.log(`Gemini ${model}: ${e.message}`); }
  }
  return null;
}

async function groq(prompt) {
  if (!env.GROQ_KEY) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_KEY}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.4, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await res.json();
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

const ia = async (prompt) => (await gemini(prompt)) || (await groq(prompt));

// ---------- RADAR: noticias ----------
const ARG = new Set(CONFIG.argentina || []);
async function noticias(sym) {
  const nombre = CONFIG.nombres?.[sym] || sym;
  const local = ARG.has(sym);
  const q = encodeURIComponent(local ? `${nombre} acciones when:3d` : `${nombre} stock when:3d`);
  const loc = local ? "hl=es-419&gl=AR&ceid=AR:es-419" : "hl=en-US&gl=US&ceid=US:en";
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&${loc}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => {
      const g = (tag) => (m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || "";
      const clean = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      return { titulo: clean(g("title")), fuente: clean(g("source")), fecha: clean(g("pubDate")).slice(5, 16) };
    });
    return items.filter((i) => i.titulo);
  } catch (e) { console.log(`RSS ${sym}: ${e.message}`); return []; }
}

// ---------- CONTROL: reglas (sin IA) ----------
function pesos(sig) {
  const ten = CONFIG.tenencias || {};
  const val = {};
  for (const [s, n] of Object.entries(ten)) { const px = sig.tickers[s]?.precio; if (px) val[s] = px * n; }
  const total = Object.values(val).reduce((a, b) => a + b, 0);
  const pct = Object.fromEntries(Object.entries(val).map(([s, v]) => [s, (v / total) * 100]));
  const tec = (CONFIG.tecnologia || []).reduce((a, s) => a + (pct[s] || 0), 0);
  const arg = [...ARG].reduce((a, s) => a + (pct[s] || 0), 0);
  return { total, pct, tec, arg };
}

function control(sym, tipoAviso, sig) {
  const R = CONFIG.reglas;
  const { total, pct, tec, arg } = pesos(sig);
  const libre = R.aporte_mensual_usd - R.aporte_spy_usd;
  const peso = pct[sym];
  const lines = [`🛡️ <b>CONTROL · ${esc(sym)}</b>`];
  const ok = [], no = [];

  if (tipoAviso === "venta") {
    if (peso != null) ok.push(`Pesa ${num(peso, 1)}% de tu cartera (${usd(peso * total / 100)}).`);
    if (ARG.has(sym)) ok.push("Es Argentina: reducir va en línea con tu objetivo de bajar exposición al país.");
    if (peso > R.tope_posicion_pct) ok.push(`Está arriba de tu tope de ${R.tope_posicion_pct}%: una venta parcial te ordena.`);
    lines.push(...ok.map((t) => `✅ ${esc(t)}`));
    lines.push(`ℹ️ Si vendés, recordá que tu horizonte es +5 años: una señal técnica sola no cambia una buena tesis.`);
  } else {
    if (ARG.has(sym)) no.push("Es Argentina: tu regla es cero aportes nuevos al país.");
    if (sym === "SPY") ok.push(`SPY es tu regla fija: US$ ${R.aporte_spy_usd} de cada aporte van acá.`);
    if (peso != null && peso >= R.tope_posicion_pct) no.push(`Ya pesa ${num(peso, 1)}%, arriba de tu tope de ${R.tope_posicion_pct}%.`);
    else if (peso != null && peso >= R.tope_posicion_pct - 2) no.push(`Ya pesa ${num(peso, 1)}%: con un aporte grande pasás el tope de ${R.tope_posicion_pct}%.`);
    else if (peso != null) ok.push(`Pesa ${num(peso, 1)}%: hay lugar hasta el tope de ${R.tope_posicion_pct}%.`);
    else ok.push("No lo tenés: sumaría diversificación.");
    if ((CONFIG.tecnologia || []).includes(sym) && tec >= R.tope_tecnologia_pct) no.push(`Tecnología ya es ${num(tec, 0)}% de la cartera (tu tope: ${R.tope_tecnologia_pct}%).`);
    else if ((CONFIG.tecnologia || []).includes(sym)) ok.push(`Tecnología es ${num(tec, 0)}% de la cartera: encaja con tu estilo de crecimiento.`);
    if (sym !== "SPY") ok.push(`Monto máximo: US$ ${libre} (los otros US$ ${R.aporte_spy_usd} del aporte van a SPY).`);
    lines.push(...ok.map((t) => `✅ ${esc(t)}`), ...no.map((t) => `⛔ ${esc(t)}`));
    lines.push(no.length ? "<b>Veredicto: no pasa tus reglas.</b>" : "<b>Veredicto: pasa tus reglas.</b>");
  }
  lines.push(`<i>Argentina hoy: ${num(arg, 1)}% de la cartera. Vos decidís.</i>`);
  return lines.join("\n");
}

// ---------- el debate ----------
function tipoDe(eventos) {
  const venta = ["rompe_soporte_3m", "cruza_abajo_sma200", "cruce_muerte", "en_resistencia_3m", "rsi_sobrecomprado"];
  return eventos.some((e) => venta.includes(e)) ? "venta" : "compra";
}

async function debate(sym, entrada, sig, replyTo) {
  const t = sig.tickers[sym];
  const nombre = CONFIG.nombres?.[sym] || sym;
  const enCartera = (CONFIG.cartera || []).includes(sym);
  const tipo = tipoDe(entrada.eventos);
  const datos = `${sym} (${nombre}), precio ${usd(t.precio)} en dólares MEP (CEDEAR/acción en BYMA). Hoy ${pctTxt(t.var_1d_pct)}, semana ${pctTxt(t.var_1s_pct)}, 1 mes ${pctTxt(t.var_1m_pct)}, 12 meses ${pctTxt(t.var_12m_pct)}. Tendencia: ${t.tendencia}. SMA20 ${t.sma20}, SMA50 ${t.sma50}, SMA200 ${t.sma200}. RSI14 ${t.rsi14}. Soporte 3m (sin hoy) ${t.previo?.soporte_3m}, resistencia 3m ${t.previo?.resistencia_3m}. Rango 6m ${t.rango_6m?.min}-${t.rango_6m?.max}. Señales de VIGÍA: ${entrada.eventos.join(", ")}.`;

  // RADAR
  const news = await noticias(sym);
  const titulares = news.map((n) => `- ${n.titulo} (${n.fuente}, ${n.fecha})`).join("\n") || "(sin titulares)";
  let radar = news.length
    ? await ia(`Sos RADAR, el bot de noticias de una mesa de inversiones de un inversor argentino. Escribí en castellano rioplatense, claro y corto.
Datos: ${datos}
Titulares de los últimos 3 días:
${titulares}

En máximo 3 líneas: qué explica el movimiento según estos titulares. Distinguí "confirmado" de "probable". Si los titulares no explican nada, decilo. No inventes datos que no estén en los titulares. Sin markdown, sin asteriscos.`)
    : null;
  if (!radar) radar = news.length ? `Titulares recientes:\n${news.slice(0, 3).map((n) => `• ${n.titulo} (${n.fuente})`).join("\n")}` : "No encontré noticias de los últimos 3 días que expliquen el movimiento: puede ser arrastre del sector o del mercado.";
  const fuentes = [...new Set(news.slice(0, 4).map((n) => n.fuente).filter(Boolean))].join(", ");
  const idRadar = await send("RADAR", `📰 <b>RADAR · ${esc(sym)}</b>\n${esc(radar)}${fuentes ? `\n<i>Fuentes: ${esc(fuentes)}</i>` : ""}`, replyTo);

  // ANALISTA
  const perfil = `Perfil del inversor: largo plazo (+5 años), estilo crecimiento (tecnología, acepta volatilidad), aporta US$ ${CONFIG.reglas.aporte_mensual_usd} por mes en una sola compra (US$ ${CONFIG.reglas.aporte_spy_usd} fijos a SPY, el resto a elección), quiere bajar exposición a Argentina, compraría más si la cartera cae 25%. ${enCartera ? `YA TIENE ${sym} en cartera.` : `NO tiene ${sym}; es candidato.`}`;
  let analista = await ia(`Sos ANALISTA, el bot que arma la tesis en una mesa de inversiones. Castellano rioplatense, directo, sin markdown ni asteriscos.
${perfil}
Datos técnicos: ${datos}
Lo que dijo RADAR: ${radar}

Respondé en este formato exacto, cada punto en 1-2 líneas:
Lectura: (qué está pasando, combinando técnico y noticia)
${tipo === "venta" && enCartera ? "Qué haría con lo que tiene: (mantener / reducir parcial / salir, y por qué)" : "Zona de entrada: (precio o rango en US$ y por qué)"}
Stop: (nivel en US$ donde la tesis se invalida)
Escenario a favor: (...)
Escenario en contra: (...)
Confianza: baja / media / alta
No uses frases de asesor financiero ni disclaimers largos; él decide.`);
  if (!analista) analista = "Hoy no pude pensar: la IA gratuita no respondió (cupo agotado o error). Vuelvo en la próxima corrida.";
  const idAnalista = await send("ANALISTA", `🧠 <b>ANALISTA · ${esc(sym)}</b>\n${esc(analista)}`, idRadar || replyTo);

  // CONTROL
  await send("CONTROL", control(sym, tipo, sig), idAnalista || idRadar || replyTo);
}

// ---------- main ----------
async function main() {
  const sig = JSON.parse(await fs.readFile(path.join(DATA, "signals.json"), "utf8"));
  if (!env.GEMINI_KEY) console.log("Sin GEMINI_KEY: RADAR va a mostrar solo titulares y ANALISTA no va a poder opinar.");

  if (DEMO) {
    if (!sig.tickers[DEMO]) { console.log(`${DEMO} no está en signals.json`); return; }
    const t = sig.tickers[DEMO];
    const id = await send("VIGIA", `🔭 <b>${esc(DEMO)}</b> · prueba de la Mesa\n${usd(t.precio)} (${pctTxt(t.var_1d_pct)} hoy · ${pctTxt(t.var_1s_pct)} en la semana)\nTendencia: ${esc(t.tendencia)} · RSI ${num(t.rsi14, 0)}\n<i>Le paso la posta a RADAR, ANALISTA y CONTROL.</i>`);
    const ev = [];
    if (t.rsi14 <= 35) ev.push("rsi_sobrevendido");
    if (t.previo?.soporte_3m && t.precio < t.previo.soporte_3m * 0.99) ev.push("rompe_soporte_3m");
    if (!ev.length) ev.push("demo");
    await debate(DEMO, { eventos: ev }, sig, id);
    return;
  }

  let state;
  try { state = JSON.parse(await fs.readFile(STATE_FILE, "utf8")); } catch { console.log("Sin vigia-state.json: nada que debatir."); return; }
  const hoy = state.fecha;
  const pendientes = (state.log || [])
    .filter((e) => e.message_id && !e.debatido && e.ts?.slice(0, 10) >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10))
    // primero lo que ya tenés, después candidatos
    .sort((a, b) => Number(b.enCartera) - Number(a.enCartera));
  const max = CONFIG.ia.max_debates_por_corrida;
  let n = 0;
  for (const e of pendientes) {
    if (n >= max) { e.debatido = "salteado (límite por corrida)"; continue; }
    if (!sig.tickers[e.ticker]) continue;
    await debate(e.ticker, e, sig, e.message_id);
    e.debatido = true;
    n++;
  }
  console.log(`MESA: ${n} debate(s) ${DRY ? "(modo prueba)" : ""} · fecha ${hoy}`);
  if (!DRY) await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
