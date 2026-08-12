// Corre una vez al día vía GitHub Actions (no desde el navegador del usuario).
// Pide precios en vivo e históricos con calma (un pedido a la vez, con pausa)
// y guarda todo en public/data/*.json para que la app los lea como archivos
// estáticos, sin pegarle a las APIs externas en cada visita.

import fs from "node:fs/promises";
import path from "node:path";

const TICKERS = [
  ["YPFD", "Acciones"], ["AMD", "CEDEARs"], ["CEPU", "Acciones"], ["TSM", "CEDEARs"],
  ["BABA", "CEDEARs"], ["GOOGL", "CEDEARs"], ["MSFT", "CEDEARs"], ["PFE", "CEDEARs"],
  ["MELI", "CEDEARs"], ["META", "CEDEARs"], ["SPY", "CEDEARs"], ["VIST", "CEDEARs"],
  ["GGAL", "Acciones"], ["MU", "CEDEARs"], ["AMZN", "CEDEARs"], ["BBAR", "Acciones"],
  ["BMA", "Acciones"], ["GD35", "Bonos"], ["GD38", "Bonos"], ["GD41", "Bonos"],
  ["AAPL", "CEDEARs"], ["QQQ", "CEDEARs"], ["CONIOLA", "Fondos"], ["NVDA", "CEDEARs"],
  ["KO", "CEDEARs"], ["CSCO", "CEDEARs"], ["DISN", "CEDEARs"], ["KEEL", "CEDEARs"],
  ["MCD", "CEDEARs"], ["LLY", "CEDEARs"], ["PBR", "CEDEARs"], ["TGSU2", "Acciones"],
  ["PAMP", "Acciones"], ["PYPL", "CEDEARs"], ["SUPV", "Acciones"], ["AL30", "Bonos"],
  ["HMY", "CEDEARs"], ["IBM", "CEDEARs"], ["T", "CEDEARs"], ["TSLA", "CEDEARs"],
  ["DIA", "CEDEARs"], ["LOMA", "Acciones"],
];

const TYPE_MAP = { Acciones: "stocks", CEDEARs: "usa_stocks", Bonos: "bonds" };
const CRYPTO_IDS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "mi-cartera-daily-sync" } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function extractSymbol(o) { return o.symbol || o.ticker || o.simbolo || o.especie || null; }
function extractPrice(o) {
  if (typeof o.c === "number") return o.c;
  if (typeof o.close === "number") return o.close;
  if (typeof o.last === "number") return o.last;
  if (typeof o.px === "number") return o.px;
  if (typeof o.price === "number") return o.price;
  if (typeof o.px_bid === "number" && typeof o.px_ask === "number") return (o.px_bid + o.px_ask) / 2;
  return null;
}

async function fetchLivePanels() {
  const panels = [
    { path: "arg_stocks", cat: "Acciones AR" },
    { path: "arg_bonds", cat: "Bonos" },
    { path: "arg_cedears", cat: "CEDEARs" },
  ];
  const prices = {};
  const catalog = [];
  for (const p of panels) {
    const data = await fetchJson(`https://data912.com/live/${p.path}`);
    if (Array.isArray(data)) {
      for (const item of data) {
        const sym = extractSymbol(item);
        const price = extractPrice(item);
        if (sym && price) prices[sym] = price;
        if (sym) catalog.push({ symbol: sym, cat: p.cat });
      }
    }
    await sleep(500);
  }
  return { prices, catalog };
}

async function fetchFx() {
  const data = await fetchJson("https://dolarapi.com/v1/dolares");
  if (!Array.isArray(data)) return null;
  const byCasa = Object.fromEntries(data.map((d) => [d.casa, d]));
  const out = {};
  if (byCasa.oficial) out.oficial = { label: "Oficial", value: byCasa.oficial.venta };
  if (byCasa.bolsa) out.mep = { label: "MEP", value: byCasa.bolsa.venta };
  if (byCasa.blue) out.blue = { label: "Blue", value: byCasa.blue.venta };
  return out;
}

async function fetchHistoryFor(ticker, cat, fxMep) {
  if (CRYPTO_IDS[ticker]) {
    const data = await fetchJson(`https://api.coingecko.com/api/v3/coins/${CRYPTO_IDS[ticker]}/market_chart?vs_currency=usd&days=365`);
    if (!data?.prices) return null;
    return data.prices.map(([ts, usd]) => ({ date: new Date(ts).toISOString().slice(0, 10), price: usd * fxMep }));
  }
  const type = TYPE_MAP[cat];
  if (!type) return null; // ej: Fondos, no cubierto por data912
  const data = await fetchJson(`https://data912.com/historical/${type}/${ticker}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data
    .map((row) => {
      const date = row.date || row.fecha || row.d || row.t;
      const price = row.c ?? row.close ?? row.px ?? row.price;
      if (!date || price == null) return null;
      const finalPrice = cat === "Bonos" ? price / 100 : cat === "CEDEARs" ? price * fxMep : price;
      return { date: String(date).slice(0, 10), price: finalPrice };
    })
    .filter(Boolean);
}

async function main() {
  console.log("Actualizando dólar...");
  const fx = await fetchFx();
  const fxMep = fx?.mep?.value || 1245;

  console.log("Actualizando precios en vivo...");
  const { prices: live, catalog } = await fetchLivePanels();

  console.log("Actualizando cripto en vivo...");
  const cryptoLive = {};
  for (const [symbol, id] of Object.entries(CRYPTO_IDS)) {
    const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (data?.[id]?.usd) cryptoLive[symbol] = data[id].usd;
    await sleep(1500); // CoinGecko free tier es más estricto con el rate limit
  }

  console.log("Actualizando históricos (uno por vez, con pausa)...");
  const history = {};
  let ok = 0;
  for (const [ticker, cat] of TICKERS) {
    process.stdout.write(`  ${ticker}... `);
    const h = await fetchHistoryFor(ticker, cat, fxMep);
    if (h && h.length > 1) { history[ticker] = h; ok++; console.log(`ok (${h.length} puntos)`); }
    else console.log("sin datos");
    await sleep(1000);
  }
  console.log(`Histórico conseguido para ${ok} de ${TICKERS.length} tickers.`);

  const outDir = path.join(process.cwd(), "public", "data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "fx.json"), JSON.stringify({ fx, updatedAt: new Date().toISOString() }, null, 2));
  await fs.writeFile(path.join(outDir, "live.json"), JSON.stringify({
    prices: { ...live, ...Object.fromEntries(Object.entries(cryptoLive).map(([k, v]) => [k, v * fxMep])) },
    catalog: [...catalog, ...Object.keys(CRYPTO_IDS).map((symbol) => ({ symbol, cat: "Cripto" }))],
    updatedAt: new Date().toISOString(),
  }, null, 2));
  await fs.writeFile(path.join(outDir, "history.json"), JSON.stringify({ history, updatedAt: new Date().toISOString(), coverage: { ok, total: TICKERS.length } }, null, 2));
  console.log("Listo, archivos guardados en public/data/");
}

main().catch((err) => { console.error(err); process.exit(1); });
