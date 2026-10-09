// Genera public/data/signals.json: los indicadores de "lectura de gráfico"
// ya calculados para cada ticker del histórico (medias, RSI, rango, soportes,
// variaciones). Es un archivo chico pensado para que Claude (o la app) lo lea
// rápido sin bajar history.json entero.
//
// Corre:
//  - cada hora con el mercado abierto (workflow signals.yml), pidiendo el
//    precio en vivo a data912 / CoinGecko para que la última vela sea la de hoy;
//  - al final de la actualización diaria (update-prices.yml).
// No modifica history.json ni live.json.

import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether",
  NEXO: "nexo", POL: "polygon-ecosystem-token", DOT: "polkadot", DOGE: "dogecoin",
  RENDER: "render-token", AVAX: "avalanche-2", LINK: "chainlink", BNB: "binancecoin",
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) { console.log(`  [${res.status}] ${url}`); return null; }
    return await res.json();
  } catch (err) {
    console.log(`  [error] ${err.message} -- ${url}`);
    return null;
  }
}

function extractSymbol(o) { return o.symbol || o.ticker || o.simbolo || o.especie || null; }
function extractPrice(o) {
  for (const k of ["c", "close", "last", "px", "price"]) if (typeof o[k] === "number" && o[k] > 0) return o[k];
  if (typeof o.px_bid === "number" && typeof o.px_ask === "number") return (o.px_bid + o.px_ask) / 2;
  return null;
}

async function fetchLive() {
  const prices = {};
  for (const p of ["arg_stocks", "arg_bonds", "arg_cedears"]) {
    const data = await fetchJson(`https://data912.com/live/${p}`);
    if (Array.isArray(data)) for (const it of data) {
      const s = extractSymbol(it), px = extractPrice(it);
      if (s && px) prices[s] = px;
    }
    await sleep(500);
  }
  return prices;
}

async function fetchFx() {
  const data = await fetchJson("https://dolarapi.com/v1/dolares");
  if (!Array.isArray(data)) return null;
  const by = Object.fromEntries(data.map((d) => [d.casa, d.venta]));
  return { oficial: by.oficial ?? null, mep: by.bolsa ?? null, ccl: by.contadoconliqui ?? null, blue: by.blue ?? null };
}

// Historial diario del dólar MEP (bolsa), para pasar todo a dólares igual que
// Balanz (precio en pesos / MEP del día).
async function fetchMepHistory() {
  const data = await fetchJson("https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa");
  if (!Array.isArray(data)) return [];
  return data
    .map((d) => ({ date: String(d.fecha).slice(0, 10), mep: d.venta ?? d.compra }))
    .filter((d) => d.mep > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function mepAt(mepHist, date) {
  // último MEP con fecha <= date (búsqueda binaria)
  let lo = 0, hi = mepHist.length - 1, ans = null;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (mepHist[m].date <= date) { ans = mepHist[m].mep; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}

async function fetchCryptoUsd() {
  const ids = Object.values(CRYPTO_IDS).join(",");
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  const out = {};
  if (data) for (const [sym, id] of Object.entries(CRYPTO_IDS)) {
    const usd = data[id]?.usd;
    if (usd) out[sym] = usd;
  }
  return out;
}

// ---------- indicadores ----------
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const sma = (c, n) => (c.length >= n ? c.slice(-n).reduce((a, b) => a + b, 0) / n : null);
const pct = (a, b) => (a != null && b ? (a / b - 1) * 100 : null);

function rsi(c, n = 14) {
  if (c.length < n * 3) return null;
  // RSI de Wilder
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}

function ago(series, days) {
  // precio de cierre más cercano a "hace N días corridos"
  const target = new Date(series.at(-1).date);
  target.setDate(target.getDate() - days);
  const t = target.toISOString().slice(0, 10);
  for (let i = series.length - 1; i >= 0; i--) if (series[i].date <= t) return series[i].price;
  return null;
}

function trendLabel(px, s20, s50, s200) {
  if (s50 == null) return "sin datos suficientes";
  const above = [s20, s50, s200].filter((s) => s != null && px > s).length;
  const total = [s20, s50, s200].filter((s) => s != null).length;
  if (above === total) return "alcista (arriba de todas las medias)";
  if (above === 0) return "bajista (abajo de todas las medias)";
  if (px < s20 && px > s50 && (s200 == null || px > s200)) return "alcista con retroceso de corto plazo";
  if (px > s20 && px < s50 && s200 != null && px < s200) return "bajista con rebote de corto plazo";
  if (s200 != null && px > s200 && px < s50) return "corrección dentro de tendencia alcista";
  if (s200 != null && px < s200 && px > s50) return "rebote dentro de tendencia bajista";
  return "mixta / lateral";
}

function rsiLabel(v) {
  if (v == null) return null;
  if (v >= 70) return "sobrecomprado";
  if (v <= 30) return "sobrevendido";
  return "neutral";
}

// Ajusta splits / cambios de ratio de CEDEAR: data912 no los ajusta, así que
// un salto de un día mayor a x2,5 (o menor a /2,5) se toma como cambio de
// escala y se reescala todo lo anterior. Solo afecta este cálculo, no
// history.json.
function adjustSplits(series) {
  const out = series.map((p) => ({ ...p }));
  let factor = 1;
  const adj = [];
  for (let i = out.length - 1; i > 0; i--) {
    const r = series[i].price / series[i - 1].price; // sobre precios crudos
    if (r > 2.5 || r < 0.4) { factor *= r; adj.push({ fecha: out[i].date, factor: r2(1 / r) }); }
    out[i - 1].price *= factor;
  }
  return { series: out, ajustes: adj.reverse() };
}

function analyze(rawSeries, livePx) {
  const { series: clean, ajustes } = adjustSplits(rawSeries);
  if (clean.length < 30) return null;
  let closes = clean.map((p) => p.price);
  const lastHist = closes.at(-1);
  let usedLive = false;
  if (livePx) {
    // Los bonos vienen en el panel en vivo por 100 VN y en el histórico por 1.
    let px = livePx;
    const ratio = px / lastHist;
    if (ratio > 50 && ratio < 200) px = px / 100;
    if (px / lastHist > 0.6 && px / lastHist < 1.6) { closes = [...closes, px]; usedLive = true; }
  }
  const px = closes.at(-1);
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const r = rsi(closes.slice(-300));
  const w6 = closes.slice(-126), w1 = closes.slice(-21), w3 = closes.slice(-63);
  const max6 = Math.max(...w6), min6 = Math.min(...w6);
  return {
    precio: r2(px),
    fuente: usedLive ? "en vivo" : `cierre ${clean.at(-1).date}`,
    tendencia: trendLabel(px, s20, s50, s200),
    sma20: r2(s20), sma50: r2(s50), sma200: r2(s200),
    rsi14: r2(r), rsi_lectura: rsiLabel(r),
    var_1d_pct: r2(pct(px, closes.at(-2))),
    var_1m_pct: r2(pct(px, ago(clean, 30))),
    var_3m_pct: r2(pct(px, ago(clean, 91))),
    var_12m_pct: r2(pct(px, ago(clean, 365))),
    rango_6m: { min: r2(min6), max: r2(max6) },
    dist_max_6m_pct: r2(pct(px, max6)),
    soporte_1m: r2(Math.min(...w1)), resistencia_1m: r2(Math.max(...w1)),
    soporte_3m: r2(Math.min(...w3)), resistencia_3m: r2(Math.max(...w3)),
    ...(ajustes.length ? { ajustes_split: ajustes } : {}),
  };
}

async function main() {
  const live = process.argv.includes("--live");
  const hist = JSON.parse(await fs.readFile(path.join(DATA_DIR, "history.json"), "utf8")).history;

  // fx.json (de la corrida diaria) tiene el MEP con el que se pasó a pesos el
  // histórico de cripto -- se usa para volver a dólares exactos.
  let fxFile = null;
  try { fxFile = JSON.parse(await fs.readFile(path.join(DATA_DIR, "fx.json"), "utf8")).fx; } catch {}
  const cryptoMep = fxFile?.mep?.value ?? null;

  let fx = fxFile ? Object.fromEntries(Object.entries(fxFile).map(([k, v]) => [k, v?.value ?? v])) : null;
  let liveArs = {}, cryptoUsd = {};
  if (live) {
    fx = (await fetchFx()) || fx;
    liveArs = await fetchLive();
    cryptoUsd = await fetchCryptoUsd();
    console.log(`Precios en vivo: ${Object.keys(liveArs).length} + ${Object.keys(cryptoUsd).length} cripto`);
  }
  const mepHist = await fetchMepHistory();
  const usd = mepHist.length > 0;
  console.log(usd ? `MEP histórico: ${mepHist.length} días (hasta ${mepHist.at(-1).date})` : "SIN MEP histórico -- queda en pesos");
  const liveMep = fx?.mep ?? (usd ? mepHist.at(-1).mep : null);

  const tickers = {};
  for (const [sym, raw] of Object.entries(hist)) {
    // con ~600 ruedas alcanza para SMA200, RSI y variación de 12 meses
    let series = (raw || []).filter((p) => p && p.price > 0).slice(-600);
    const isCrypto = CRYPTO_IDS[sym] != null;
    let livePx = null;
    if (usd) {
      if (isCrypto) {
        if (!cryptoMep) continue;
        series = series.map((p) => ({ date: p.date, price: p.price / cryptoMep }));
        livePx = cryptoUsd[sym] ?? null;
      } else {
        series = series.map((p) => { const m = mepAt(mepHist, p.date); return m ? { date: p.date, price: p.price / m } : null; }).filter(Boolean);
        livePx = liveArs[sym] && liveMep ? liveArs[sym] / liveMep : null;
      }
    } else {
      livePx = isCrypto ? (cryptoUsd[sym] && liveMep ? cryptoUsd[sym] * liveMep : null) : liveArs[sym] ?? null;
    }
    const a = analyze(series, livePx);
    if (a) tickers[sym] = a;
  }

  const out = {
    updatedAt: new Date().toISOString(),
    modo: live ? "en vivo (horario de mercado)" : "cierre diario",
    moneda: usd ? "USD" : "ARS",
    nota: usd
      ? "Precios en DÓLARES MEP: precio BYMA en pesos / dólar MEP de cada día (mismo criterio que Balanz). Bonos por 1 VN. Cripto en USD. RSI de Wilder 14 ruedas. Rango 6m = últimas 126 ruedas."
      : "ATENCIÓN: no se pudo bajar el MEP histórico; precios en PESOS (BYMA). Bonos por 1 VN.",
    fx,
    tickers,
  };
  await fs.writeFile(path.join(DATA_DIR, "signals.json"), JSON.stringify(out, null, 1));
  console.log(`signals.json: ${Object.keys(tickers).length} tickers`);
}

main().catch((e) => { console.error(e); process.exit(1); });
