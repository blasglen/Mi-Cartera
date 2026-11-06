// ANALISTA en vivo — Cloudflare Worker (plan gratuito).
//
// Telegram le avisa a este Worker cada vez que escribís en el grupo (webhook
// del bot ANALISTA). El Worker busca los datos del momento en tu repo de GitHub
// (signals.json, tu cartera y los avisos de VIGÍA), las noticias de los
// tickers que nombres, le pregunta a la IA gratis (Gemini, Groq de respaldo) y
// te contesta como ANALISTA respondiendo a tu mensaje.
//
// Variables del Worker (Settings > Variables and Secrets, todas tipo "Secret"):
//   TG_ANALISTA   token del bot ANALISTA
//   TG_CHAT_ID    ID del grupo (-5505685389)
//   GEMINI_KEY    clave de Google AI Studio
//   GROQ_KEY      (opcional) clave de Groq, respaldo
//   CLAVE_SETUP   una palabra secreta inventada por vos (para activar el webhook)
//
// Activar: abrir en el navegador  https://<tu-worker>.workers.dev/setup?clave=<CLAVE_SETUP>

const REPO_RAW = "https://raw.githubusercontent.com/blasglen/Mi-Cartera/main";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/setup") {
      if (!env.CLAVE_SETUP || url.searchParams.get("clave") !== env.CLAVE_SETUP) return new Response("Clave incorrecta", { status: 403 });
      const r = await tg(env, "setWebhook", {
        url: `${url.origin}/telegram`,
        secret_token: await secretoWebhook(env),
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      const me = await tg(env, "getMe", {});
      return new Response(r.ok ? `✅ Listo: @${me.result?.username} ya escucha el grupo.` : `❌ Error: ${JSON.stringify(r)}`, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (url.pathname === "/telegram" && request.method === "POST") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== (await secretoWebhook(env))) return new Response("no", { status: 403 });
      const update = await request.json().catch(() => null);
      // Contestamos 200 enseguida y pensamos en segundo plano
      if (update?.message) ctx.waitUntil(responder(update.message, env).catch((e) => console.log("error", e.message)));
      return new Response("ok");
    }

    return new Response("ANALISTA en línea 🧠", { headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};

// ---------- Telegram ----------
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_ANALISTA}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

// Secreto del webhook derivado del token (sin tener que cargar otra variable)
async function secretoWebhook(env) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mesa:" + env.TG_ANALISTA));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- datos ----------
async function json(path) {
  const r = await fetch(`${REPO_RAW}/${path}`, { cf: { cacheTtl: 120 } });
  return r.ok ? r.json() : null;
}

async function noticias(sym, nombre, local) {
  const q = encodeURIComponent(local ? `${nombre} acciones when:3d` : `${nombre} stock when:3d`);
  const loc = local ? "hl=es-419&gl=AR&ceid=AR:es-419" : "hl=en-US&gl=US&ceid=US:en";
  try {
    const xml = await (await fetch(`https://news.google.com/rss/search?q=${q}&${loc}`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
    return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>/g)]
      .slice(0, 5)
      .map((m) => `- ${m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")} (${m[2]})`);
  } catch { return []; }
}

const ALIAS = {
  galicia: "GGAL", macro: "BMA", ypf: "YPFD", mercadolibre: "MELI", "mercado libre": "MELI", meli: "MELI",
  microsoft: "MSFT", nvidia: "NVDA", apple: "AAPL", tesla: "TSLA", amazon: "AMZN", google: "GOOGL",
  alphabet: "GOOGL", micron: "MU", broadcom: "AVGO", lilly: "LLY", pfizer: "PFE", alibaba: "BABA",
  netflix: "NFLX", uber: "UBER", oracle: "ORCL", salesforce: "CRM", adobe: "ADBE", snowflake: "SNOW",
  airbnb: "ABNB", visa: "V", mastercard: "MA", costco: "COST", tsmc: "TSM", taiwan: "TSM",
  "central puerto": "CEPU", bbva: "BBAR", "s&p": "SPY", nasdaq: "QQQ", "vista energy": "VIST",
  "palo alto": "PANW", facebook: "META", amd: "AMD", spy: "SPY",
};

function tickersEn(texto, sig, cfg) {
  const out = new Set();
  const vigilados = new Set([...(cfg.cartera || []), ...(cfg.candidatos || [])]);
  // Tickers escritos en mayúscula (AMD, GGAL, META...)
  for (const w of texto.match(/\b[A-Z]{1,5}\d?\b/g) || []) if (sig.tickers[w] && w.length >= 2 || vigilados.has(w)) out.add(w);
  // En minúscula, solo los de tu lista y de 3+ letras (para no confundir "de" con Deere)
  for (const w of texto.toLowerCase().match(/\b[a-z]{3,5}\b/g) || []) if (vigilados.has(w.toUpperCase())) out.add(w.toUpperCase());
  const lower = texto.toLowerCase();
  for (const [alias, s] of Object.entries(ALIAS)) if (new RegExp(`(^|[^a-z])${alias.replace(/[&]/g, "\\$&")}([^a-z]|$)`).test(lower)) out.add(s);
  return [...out].filter((s) => sig.tickers[s]).slice(0, 5);
}

const fmt = (t) => `precio US$ ${t.precio} (MEP) · hoy ${t.var_1d_pct}% · semana ${t.var_1s_pct}% · 1m ${t.var_1m_pct}% · 12m ${t.var_12m_pct}% · ${t.tendencia} · SMA20 ${t.sma20} SMA50 ${t.sma50} SMA200 ${t.sma200} · RSI ${t.rsi14} (${t.rsi_lectura}) · soporte 3m ${t.previo?.soporte_3m ?? t.soporte_3m} · resistencia 3m ${t.previo?.resistencia_3m ?? t.resistencia_3m} · rango 6m ${t.rango_6m?.min}-${t.rango_6m?.max}`;

function resumenCartera(sig, cfg) {
  const ten = cfg.tenencias || {};
  const filas = [];
  let total = 0;
  for (const [s, n] of Object.entries(ten)) { const px = sig.tickers[s]?.precio; if (px) { filas.push([s, n, px * n, sig.tickers[s]]); total += px * n; } }
  filas.sort((a, b) => b[2] - a[2]);
  return `Total aprox. US$ ${Math.round(total)}.\n` + filas.map(([s, n, v, t]) => `${s}: ${n} nominales, US$ ${Math.round(v)} (${((v / total) * 100).toFixed(1)}%), hoy ${t.var_1d_pct}%, RSI ${t.rsi14}, ${t.tendencia}`).join("\n");
}

// ---------- IA gratis ----------
async function ia(prompt, env, cfg) {
  const modelos = cfg?.ia?.modelos_gemini || ["gemini-flash-lite-latest", "gemini-flash-latest"];
  if (env.GEMINI_KEY) for (const m of modelos) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 1500 } }),
      });
      const j = await r.json();
      const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
      if (t) return t;
    } catch {}
  }
  if (env.GROQ_KEY) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_KEY}` },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.5, messages: [{ role: "user", content: prompt }] }),
      });
      const t = (await r.json()).choices?.[0]?.message?.content?.trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

// ---------- la respuesta ----------
async function responder(msg, env) {
  if (String(msg.chat?.id) !== String(env.TG_CHAT_ID)) return; // solo tu grupo
  if (msg.from?.is_bot) return;
  const texto = (msg.text || msg.caption || "").trim();
  if (!texto || texto.startsWith("/start")) return;

  await tg(env, "sendChatAction", { chat_id: msg.chat.id, action: "typing" });

  const [sig, cfg, estado] = await Promise.all([json("public/data/signals.json"), json("scripts/vigia-config.json"), json("public/data/vigia-state.json")]);
  if (!sig || !cfg) {
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: "No pude leer los datos del repo. Probá en un rato.", reply_parameters: { message_id: msg.message_id } });
    return;
  }

  const citado = msg.reply_to_message?.text || "";
  const syms = tickersEn(texto + " " + citado, sig, cfg);
  const arg = new Set(cfg.argentina || []);
  const news = await Promise.all(syms.slice(0, 3).map((s) => noticias(s, cfg.nombres?.[s] || s, arg.has(s))));
  const bloqueTickers = syms.map((s, i) => `${s} (${cfg.nombres?.[s] || s})${(cfg.tenencias || {})[s] ? " [EN CARTERA]" : ""}: ${fmt(sig.tickers[s])}${news[i]?.length ? `\nTitulares 3 días:\n${news[i].join("\n")}` : ""}`).join("\n\n");
  const avisos = (estado?.log || []).slice(-8).map((e) => `${e.ts.slice(0, 16)} ${e.ticker}: ${e.eventos.join(", ")} a US$ ${e.precio}`).join("\n");
  const R = cfg.reglas || {};

  const prompt = `Sos ANALISTA, el bot de análisis de la "Mesa de Inversiones" de Blas, un contador argentino que invierte desde Balanz en CEDEARs y acciones. Hablás en castellano rioplatense, directo y claro, como un colega que sabe. Respuestas cortas para leer en el celular (máximo ~12 líneas salvo que pida detalle). Sin markdown ni asteriscos; podés usar viñetas con "•" y emojis con moderación.

PERFIL Y REGLAS DE BLAS
- Largo plazo (+5 años), estilo crecimiento (tecnología, acepta volatilidad). Compraría más si la cartera cae 25%.
- Aporta US$ ${R.aporte_mensual_usd} por mes en una sola compra: US$ ${R.aporte_spy_usd} fijos a SPY y el resto a elección.
- Cero aportes nuevos a Argentina (quiere bajar exposición). Tope ${R.tope_posicion_pct}% por posición. Todo en dólares MEP como Balanz.
- Quiere también señales de venta cuando correspondan. Él decide y ejecuta: vos das lectura, escenarios, niveles y riesgos, sin disclaimers largos.
- Sin cripto.

SU CARTERA AHORA (precios en vivo aprox.)
${resumenCartera(sig, cfg)}

DÓLAR: MEP ${sig.fx?.mep} · CCL ${sig.fx?.ccl}. Datos actualizados: ${sig.updatedAt} (${sig.modo}).

ÚLTIMOS AVISOS DE VIGÍA
${avisos || "(ninguno)"}

${bloqueTickers ? `DATOS DE LOS TICKERS QUE MENCIONA\n${bloqueTickers}` : ""}

${citado ? `ESTÁ RESPONDIENDO A ESTE MENSAJE DEL GRUPO:\n"""${citado.slice(0, 1500)}"""\n` : ""}
MENSAJE DE BLAS: """${texto}"""

Respondé usando SOLO estos datos para precios y niveles (no inventes cifras). Si te pregunta algo que los datos no cubren (fundamentos detallados, balances), decí lo que sabés en general y aclaralo. Si pregunta por un ticker que no está en los datos, decí que no lo tenés en la lista de VIGÍA.`;

  const respuesta = (await ia(prompt, env, cfg)) || "Me quedé sin cupo de IA gratis por ahora 😅. Probá en unos minutos.";
  const partes = respuesta.match(/[\s\S]{1,3900}(?=\n|$)/g) || [respuesta];
  for (const [i, p] of partes.entries())
    await tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      text: i === 0 ? `🧠 <b>ANALISTA</b>\n${esc(p)}` : esc(p),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });
}
