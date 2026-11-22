// IOL para Mi-Cartera — Cloudflare Worker (plan gratuito).
//
// Puente entre la app (GitHub Pages) y la API nueva de IOL
// (api.iolinversiones.com). Tu usuario y clave de IOL quedan guardados acá
// como secrets: NUNCA viajan al navegador.
//
// Solo LEE: precios, tenencias y saldos. No tiene ningún endpoint para operar.
// Solo atiende a usuarios logueados en la app (token de Firebase) cuyo mail
// esté en EMAILS_PERMITIDOS.
//
// Variables del Worker (Settings > Variables and Secrets):
//   IOL_USERNAME        (Secret) tu usuario de IOL
//   IOL_PASSWORD        (Secret) tu clave de IOL
//   EMAILS_PERMITIDOS   (Text)   mails de la app que pueden usarlo, separados por coma
//   BINANCE_API_KEY     (Secret) clave de API de Binance, SOLO LECTURA (opcional)
//   BINANCE_API_SECRET  (Secret) secreto de esa clave (opcional)
//
// Endpoints:
//   GET /quotes?symbols=SPY,GGAL,AL30   -> precios en vivo (pesos, como data912)
//   GET /positions                      -> tenencias y saldos de tu cuenta IOL
//   GET /binance                        -> saldos de Binance (spot + Funding + Earn) en USD
//   GET /                               -> "IOL en línea" (prueba)

const IOL_API = "https://api.iolinversiones.com";
const FIREBASE_PROJECT = "mi-cartera-a4944";
const ORIGENES = ["https://blasglen.github.io", "http://localhost:5173", "http://localhost:4173"];
const UA = "Mozilla/5.0 (compatible; MiCartera-IOL/1.0)";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

    if (url.pathname === "/") return new Response("IOL en línea ✅", { headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });

    // --- quién pide ---
    const user = await verificarFirebase(request.headers.get("Authorization"));
    const permitidos = String(env.EMAILS_PERMITIDOS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (!user) return json({ error: "sin sesión" }, 401);
    if (!permitidos.includes(String(user.email || "").toLowerCase())) return json({ error: "usuario no permitido" }, 403);

    try {
      if (url.pathname === "/quotes") {
        const symbols = [...new Set(String(url.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9.]{1,12}$/.test(s)))].slice(0, 80);
        if (!symbols.length) return json({ error: "faltan symbols" }, 400);
        const token = await iolToken(env);
        const prices = {};
        for (let i = 0; i < symbols.length; i += 6) {
          const lote = symbols.slice(i, i + 6);
          const res = await Promise.all(lote.map((s) => cotizacion(token, s)));
          if (res.includes("STOP")) break;
          lote.forEach((s, k) => { if (res[k] && res[k] !== "STOP") prices[s] = res[k]; });
        }
        return json({ updatedAt: new Date().toISOString(), fuente: "IOL", prices });
      }

      if (url.pathname === "/binance") {
        return json(await binanceSaldos(env));
      }

      if (url.pathname === "/positions") {
        const token = await iolToken(env);
        const [ar, us, balAr, balUs] = await Promise.all([
          iolGet(token, "/broker/accounts/AR/positions?valuation_currency=MEP"),
          iolGet(token, "/broker/accounts/US/positions"),
          iolGet(token, "/broker/accounts/AR/balances"),
          iolGet(token, "/broker/accounts/US/balances"),
        ]);
        return json({ updatedAt: new Date().toISOString(), positions: { AR: ar, US: us }, balances: { AR: balAr, US: balUs } });
      }
    } catch (e) {
      return json({ error: e.message || "error con IOL" }, 502);
    }
    return json({ error: "no existe" }, 404);
  },
};

// ---------- IOL ----------
let tokenCache = null; // { token, vence } -- vive mientras el Worker siga "caliente"

async function iolToken(env) {
  if (tokenCache && tokenCache.vence > Date.now() + 60_000) return tokenCache.token;
  if (!env.IOL_USERNAME || !env.IOL_PASSWORD) throw new Error("faltan IOL_USERNAME / IOL_PASSWORD en el Worker");
  const r = await fetch(`${IOL_API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ grant_type: "password", username: env.IOL_USERNAME, password: env.IOL_PASSWORD }),
  });
  if (!r.ok) throw new Error(`login IOL falló (${r.status})`);
  const d = (await r.json())?.data;
  if (!d?.access_token) throw new Error("login IOL sin token");
  tokenCache = { token: d.access_token, vence: Date.now() + (d.expires_in || 900) * 1000 };
  return d.access_token;
}

async function iolGet(token, ruta) {
  const r = await fetch(IOL_API + ruta, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": UA } });
  if (r.status === 401) tokenCache = null;
  const body = await r.json().catch(() => null);
  if (!r.ok) return { error: body?.error?.message || `status ${r.status}` };
  return body?.data ?? null;
}

async function cotizacion(token, sym) {
  for (const term of ["T1", "T0"]) {
    const r = await fetch(`${IOL_API}/broker/market-data/${encodeURIComponent(sym)}/quote?market=BCBA&term=${term}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": UA },
    }).catch(() => null);
    if (!r) continue;
    if (r.status === 429) return "STOP";
    if (r.status === 401) tokenCache = null;
    if (!r.ok) continue;
    const d = (await r.json().catch(() => null))?.data;
    const px = d?.prices?.current;
    if (typeof px === "number" && px > 0) {
      return {
        price: px,
        pct: d.change?.percent ?? null,
        prevClose: d.prices.previous_close ?? null,
        high: d.prices.high ?? null,
        low: d.prices.low ?? null,
        volume: d.volume?.amount ?? null,
        currency: d.currency || "ARS",
        at: d.last_updated || null,
      };
    }
  }
  return null;
}

// ---------- Firebase: verificar el token de la app ----------
let jwksCache = null; // { keys, vence }

async function verificarFirebase(header) {
  try {
    const m = /^Bearer\s+(.+)$/.exec(header || "");
    if (!m) return null;
    const [h64, p64, s64] = m[1].split(".");
    const head = JSON.parse(b64urlText(h64));
    const pay = JSON.parse(b64urlText(p64));
    const ahora = Math.floor(Date.now() / 1000);
    if (head.alg !== "RS256") return null;
    if (pay.aud !== FIREBASE_PROJECT || pay.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT}`) return null;
    if (!(pay.exp > ahora) || !(pay.iat <= ahora + 60) || !pay.sub) return null;
    if (!jwksCache || jwksCache.vence < Date.now()) {
      const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
      jwksCache = { keys: (await r.json()).keys || [], vence: Date.now() + 3600_000 };
    }
    const jwk = jwksCache.keys.find((k) => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(s64), new TextEncoder().encode(`${h64}.${p64}`));
    return ok ? { uid: pay.sub, email: pay.email || null } : null;
  } catch {
    return null;
  }
}

function b64urlBytes(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function b64urlText(s) { return new TextDecoder().decode(b64urlBytes(s)); }

// ---------- Binance (solo lectura) ----------
// Usa una clave de API con permiso "Enable Reading" únicamente. Junta los
// saldos de Spot, Funding y Simple Earn, y los valúa en USD con el precio
// contra USDT.
const BINANCE = "https://api.binance.com";
const ESTABLES = new Set(["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USDP", "DAI"]);

async function binanceFirmado(env, ruta, params = {}, method = "GET") {
  const qs = new URLSearchParams({ ...params, recvWindow: "10000", timestamp: String(Date.now()) }).toString();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.BINANCE_API_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(qs)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const r = await fetch(`${BINANCE}${ruta}?${qs}&signature=${firma}`, { method, headers: { "X-MBX-APIKEY": env.BINANCE_API_KEY, "User-Agent": UA } });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Binance ${ruta}: ${body?.msg || r.status}`);
  return body;
}

async function binanceSaldos(env) {
  if (!env.BINANCE_API_KEY || !env.BINANCE_API_SECRET) throw new Error("faltan BINANCE_API_KEY / BINANCE_API_SECRET en el Worker");
  const totales = {}; // asset -> { spot, funding, earn }
  const sumar = (asset, donde, n) => {
    const a = String(asset || "").replace(/^LD(?=[A-Z0-9]{2,})/, ""); // LDBTC = BTC en Earn flexible (formato viejo)
    const x = Number(n);
    if (!a || !(x > 0)) return;
    totales[a] = totales[a] || { spot: 0, funding: 0, earn: 0 };
    totales[a][donde] += x;
  };
  const avisos = [];

  const cuenta = await binanceFirmado(env, "/api/v3/account", { omitZeroBalances: "true" });
  for (const b of cuenta.balances || []) sumar(b.asset, String(b.asset).startsWith("LD") ? "earn" : "spot", Number(b.free) + Number(b.locked));

  try {
    const fund = await binanceFirmado(env, "/sapi/v1/asset/get-funding-asset", {}, "POST");
    for (const b of fund || []) sumar(b.asset, "funding", Number(b.free) + Number(b.locked) + Number(b.freeze || 0));
  } catch (e) { avisos.push(`Funding: ${e.message}`); }

  for (const tipo of ["flexible", "locked"]) {
    try {
      const earn = await binanceFirmado(env, `/sapi/v1/simple-earn/${tipo}/position`, { size: "100" });
      for (const r of earn?.rows || []) sumar(r.asset, "earn", r.totalAmount ?? r.amount);
    } catch (e) { avisos.push(`Earn ${tipo}: ${e.message}`); }
  }

  // Precios en USD (contra USDT)
  const precios = {};
  const tick = await fetch(`${BINANCE}/api/v3/ticker/price`, { headers: { "User-Agent": UA } }).then((r) => r.json()).catch(() => []);
  for (const t of Array.isArray(tick) ? tick : []) if (t.symbol.endsWith("USDT")) precios[t.symbol.slice(0, -4)] = Number(t.price);

  const activos = Object.entries(totales).map(([asset, t]) => {
    const cantidad = t.spot + t.funding + t.earn;
    const precioUsd = ESTABLES.has(asset) ? 1 : precios[asset] ?? null;
    return { asset, cantidad, precioUsd, valorUsd: precioUsd != null ? cantidad * precioUsd : null, detalle: t };
  }).filter((a) => a.valorUsd == null || a.valorUsd >= 0.5) // saca el "polvo" de centavos
    .sort((a, b) => (b.valorUsd || 0) - (a.valorUsd || 0));

  return { updatedAt: new Date().toISOString(), fuente: "Binance", totalUsd: activos.reduce((s, a) => s + (a.valorUsd || 0), 0), activos, avisos };
}
