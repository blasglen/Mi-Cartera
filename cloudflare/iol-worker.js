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
//
// Endpoints:
//   GET /quotes?symbols=SPY,GGAL,AL30   -> precios en vivo (pesos, como data912)
//   GET /positions                      -> tenencias y saldos de tu cuenta IOL
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
