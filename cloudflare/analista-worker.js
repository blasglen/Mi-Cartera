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
  if (msg.from?.is_bot) return;
  const texto = (msg.text || msg.caption || "").trim();
  if (!texto || texto.startsWith("/")) return; // comandos (/start, /compre) son para VIGÍA
  // Solo tu grupo grande o tu grupo de alertas (lo registra VIGÍA en aporte-state.json)
  const ap = await json("public/data/aporte-state.json");
  const permitido = String(msg.chat?.id) === String(env.TG_CHAT_ID) || (ap?.privado != null && String(msg.chat?.id) === String(ap.privado));
  if (!permitido) return;

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
  const avisos = (estado?.log || []).slice(-8).map((e) => `${e.ts.slice(0, 16)} ${e.ticker}: ${e.veredicto || e.eventos.join(", ")} a US$ ${e.precio}`).join("\n");
  // Lo último que dijo la Mesa (grupo grande) sobre cada ticker mencionado
  const hora = (ts) => new Date(new Date(ts).getTime() - 3 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  const dichoMesa = syms.map((sy) => {
    const e = [...(estado?.log || [])].reverse().find((x) => x.ticker === sy);
    if (!e) return null;
    return `${sy} (${hora(e.ts)} hs AR): VIGÍA dijo ${e.veredicto || e.eventos.join(", ")}${e.analista ? `; ANALISTA (vos mismo, en el grupo grande) dijo ${e.analista}` : ""}${e.analistaTexto ? ` — "${e.analistaTexto}"` : ""}${e.radarTexto ? `\n  RADAR: ${e.radarTexto}` : ""}`;
  }).filter(Boolean).join("\n");
  const R0 = cfg.reglas || {};
  const mesKey = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
  const [by, bm] = String(R0.aporte_base_mes || mesKey).split("-").map(Number), [yy, mm] = mesKey.split("-").map(Number);
  const totalMes = Math.round((R0.aporte_base_usd ?? 250) * Math.pow(1 + (R0.crecimiento_mensual_pct ?? 0) / 100, Math.max(0, (yy - by) * 12 + (mm - bm))) * 100) / 100;
  const R = { ...R0, aporte_mensual_usd: totalMes, aporte_spy_usd: Math.round(totalMes * (R0.spy_pct ?? 40)) / 100 };

  // Las instrucciones viven en GitHub (cloudflare/analista-instrucciones.md): se pueden
  // ajustar sin volver a pegar este código en Cloudflare.
  let plantilla = null;
  try { const r = await fetch(`${REPO_RAW}/cloudflare/analista-instrucciones.md`, { cf: { cacheTtl: 60 } }); if (r.ok) plantilla = await r.text(); } catch {}
  if (!plantilla) plantilla = "Sos ANALISTA, el analista de inversiones de Blas. Castellano rioplatense, directo, corto, sin markdown. Empezá con VEREDICTO TICKER: SEÑAL DE COMPRA / SEÑAL DE VENTA / VENTA PARCIAL / MANTENER / ESPERAR.\n\nCARTERA:\n{{CARTERA}}\n\nTICKERS:\n{{TICKERS}}\n\nLO QUE DIJO LA MESA:\n{{MESA}}\n\nMENSAJE: {{MENSAJE}}";
  const valores = {
    APORTE_MES: R.aporte_mensual_usd, APORTE_SPY: R.aporte_spy_usd, TOPE: R.tope_posicion_pct,
    REGLA: ap?.regla || "crece 1,5% por mes",
    PLAN: (ap?.plan || []).map((p) => `${p.mes}: ${p.total} / ${p.spy} / ${p.libre}`).join(" · ") || "s/d",
    ESTADO_APORTE: `SPY ${ap?.spy ? `comprado (${ap.spy.fecha})` : "pendiente"}; libre ${ap?.libre ? `comprado${ap.libre.ticker ? " en " + ap.libre.ticker : ""}` : ap?.elegido ? `señal activa en ${ap.elegido.nombre}` : "pendiente, esperando oportunidad excelente"}.`,
    CARTERA: resumenCartera(sig, cfg),
    FX: `MEP ${sig.fx?.mep} · CCL ${sig.fx?.ccl}. Datos actualizados: ${sig.updatedAt} (${sig.modo}).`,
    AVISOS: avisos || "(ninguno)",
    TICKERS: bloqueTickers || "(no nombró tickers)",
    MESA: dichoMesa || "(la Mesa no dijo nada todavía sobre estos tickers)",
    CITADO: citado ? `"""${citado.slice(0, 1500)}"""` : "(ninguno)",
    MENSAJE: texto,
  };
  const prompt = plantilla.replace(/\{\{(\w+)\}\}/g, (_, k) => (valores[k] ?? ""));

  const respuesta = (await ia(prompt, env, cfg)) || "Me quedé sin cupo de IA gratis por ahora 😅. Probá en unos minutos.";
  const partes = respuesta.match(/[\s\S]{1,3900}(?=\n|$)/g) || [respuesta];
  for (const [i, p] of partes.entries())
    await tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      text: (i === 0 ? `🧠 <b>ANALISTA</b>\n` : "") + esc(p).replace(/^(VEREDICTO[^\n]*)/gm, "<b>$1</b>"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });
}
