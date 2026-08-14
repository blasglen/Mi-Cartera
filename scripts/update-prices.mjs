// Corre una vez al día vía GitHub Actions (no desde el navegador del usuario).
// Pide precios en vivo e históricos con calma (un pedido a la vez, con pausa)
// y guarda todo en public/data/*.json para que la app los lea como archivos
// estáticos, sin pegarle a las APIs externas en cada visita.

import fs from "node:fs/promises";
import path from "node:path";

// Tus tenencias reales -- siempre se piden.
const HOLDINGS_TICKERS = [
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

// Acciones/CEDEARs/bonos populares que NO tenés en cartera, pero es probable
// que busques -- así también tienen histórico real, no solo las tuyas. Si
// alguno no existe en data912, el script simplemente lo salta sin romper nada.
const EXTRA_TICKERS = [
  // CEDEARs de EE.UU. muy conocidas
  ["NKE", "CEDEARs"], ["V", "CEDEARs"], ["MA", "CEDEARs"], ["JNJ", "CEDEARs"],
  ["WMT", "CEDEARs"], ["XOM", "CEDEARs"], ["JPM", "CEDEARs"], ["BAC", "CEDEARs"],
  ["GE", "CEDEARs"], ["F", "CEDEARs"], ["GM", "CEDEARs"], ["NFLX", "CEDEARs"],
  ["UBER", "CEDEARs"], ["SBUX", "CEDEARs"], ["ORCL", "CEDEARs"], ["CRM", "CEDEARs"],
  ["ADBE", "CEDEARs"], ["INTC", "CEDEARs"], ["QCOM", "CEDEARs"], ["CVX", "CEDEARs"],
  ["UNH", "CEDEARs"], ["PG", "CEDEARs"], ["HD", "CEDEARs"], ["COST", "CEDEARs"],
  ["BA", "CEDEARs"], ["CAT", "CEDEARs"], ["MMM", "CEDEARs"], ["GS", "CEDEARs"],
  ["C", "CEDEARs"], ["WFC", "CEDEARs"], ["DE", "CEDEARs"], ["UPS", "CEDEARs"],
  ["NIO", "CEDEARs"], ["RIOT", "CEDEARs"], ["COIN", "CEDEARs"], ["SQ", "CEDEARs"],
  ["PANW", "CEDEARs"], ["SNOW", "CEDEARs"], ["ABNB", "CEDEARs"], ["DIS", "CEDEARs"],
  // Acciones argentinas populares que no tenés
  ["TXAR", "Acciones"], ["ALUA", "Acciones"], ["CRES", "Acciones"], ["COME", "Acciones"],
  ["TECO2", "Acciones"], ["EDN", "Acciones"], ["TRAN", "Acciones"], ["CVH", "Acciones"],
  ["MIRG", "Acciones"], ["VALO", "Acciones"], ["BYMA", "Acciones"], ["CEPU2", "Acciones"],
  // Otros bonos soberanos comunes
  ["AL29", "Bonos"], ["AE38", "Bonos"], ["GD29", "Bonos"], ["GD46", "Bonos"],
];

// Cripto: mismo tratamiento que el resto -- histórico cacheado una vez al día,
// para no depender de pedirle en vivo a CoinGecko cada vez que alguien mira el
// gráfico (eso fue justo lo que disparó el límite de pedidos gratis).
const CRYPTO_TICKERS = [["BTC", "Cripto"], ["ETH", "Cripto"], ["SOL", "Cripto"], ["USDT", "Cripto"]];

const TICKERS = [...HOLDINGS_TICKERS, ...EXTRA_TICKERS, ...CRYPTO_TICKERS];

const TYPE_MAP = { Acciones: "stocks", CEDEARs: "usa_stocks", Bonos: "bonds" };
// El CEDEAR se llama distinto al ticker real de EE.UU. en algunos casos puntuales.
const US_TICKER_ALIAS = { DISN: "DIS" };
const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether",
  // Sumados por la cartera de Nexo -- si alguno tira "sin datos" en el log,
  // es que el id de CoinGecko cambió (pasa con rebrands, ej. MATIC -> POL) y
  // hay que ajustarlo acá.
  NEXO: "nexo", POL: "polygon-ecosystem-token", DOT: "polkadot", DOGE: "dogecoin",
  RENDER: "render-token", AVAX: "avalanche-2", LINK: "chainlink", BNB: "binancecoin",
};
// Pares de Coinbase Exchange para histórico de cripto (ver fetchCoinbaseHistory
// más abajo). USDT no tiene par propio ahí -- se trata aparte, vale ~1 siempre.
// NEXO y POL no están listados en Coinbase -- esos dos caen al fallback plano
// (precio actual hacia atrás), como cualquier ticker sin histórico real.
const COINBASE_PRODUCTS = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD",
  DOT: "DOT-USD", DOGE: "DOGE-USD", RENDER: "RENDER-USD", AVAX: "AVAX-USD", LINK: "LINK-USD",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GitHub ya enmascara automáticamente el valor de los secrets en los logs de
// Actions, pero por las dudas no lo dejamos ni pasar por la URL que se loguea.
function redact(url) {
  return url.replace(/([?&]api_key=)[^&]+/, "$1***");
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
      },
    });
  } catch (err) {
    console.log(`    [red] ${err.message} -- ${redact(url)}`);
    return null;
  }
  if (!res.ok) {
    console.log(`    [${res.status}] ${redact(url)}`);
    return null;
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log(`    [no-json] ${redact(url)} -- primeros 150 caracteres: ${text.slice(0, 150).replace(/\n/g, " ")}`);
    return null;
  }
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

// Histórico de cripto: CoinGecko en el plan gratuito solo deja pedir los
// últimos 365 días (límite del plan, no del parámetro que mandemos), que fue
// justo lo que capó el histórico de BTC/ETH/SOL/USDT a 1 año en la
// calculadora. Probamos CryptoCompare pero ahora exige API key hasta en el
// plan gratis, y ESE plan gratis también viene capado a 365 días -- no
// serviría igual. Usamos en su lugar las velas públicas de Coinbase Exchange
// (api.exchange.coinbase.com/products/.../candles): sin key, sin bloqueo a
// IPs de EE.UU. (a diferencia de Binance), con histórico completo desde que
// el par se lista ahí, paginando de a 300 días por pedido.
// El precio EN VIVO sigue en CoinGecko (fetchCryptoPricesUsd más abajo) --
// ese endpoint nunca tuvo problema, no hace falta tocarlo.
async function fetchCoinbaseHistory(symbol) {
  // USDT no cotiza contra sí mismo en Coinbase -- por definición vale ~1 dólar
  // siempre, así que generamos la serie plana en vez de buscar un par que no existe.
  if (symbol === "USDT") {
    const out = [];
    const d = new Date("2015-01-01T00:00:00Z");
    const today = new Date();
    while (d <= today) {
      out.push({ date: d.toISOString().slice(0, 10), price: 1 });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }
  const product = COINBASE_PRODUCTS[symbol];
  if (!product) return [];
  const granularitySec = 86400; // 1 día
  const earliestFloor = new Date("2014-01-01T00:00:00Z").getTime();
  const out = [];
  let end = Date.now();
  for (let i = 0; i < 30 && end > earliestFloor; i++) {
    const start = end - 299 * granularitySec * 1000; // máx. 300 velas por pedido
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularitySec}&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || data.length === 0) break; // llegamos antes del listado del par
    for (const row of data) {
      // Formato: [time (unix seg), low, high, open, close, volume]
      const [time, , , , close] = row;
      if (time != null && close != null) out.push({ date: new Date(time * 1000).toISOString().slice(0, 10), price: close });
    }
    end = start - granularitySec * 1000;
    await sleep(400); // Coinbase pública es generosa, pero no hay apuro
  }
  const byDate = new Map();
  for (const p of out) byDate.set(p.date, p.price);
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price }));
}

async function fetchHistoryFor(ticker, cat, fxMep) {
  if (CRYPTO_IDS[ticker]) {
    const usdHistory = await fetchCoinbaseHistory(ticker);
    if (!usdHistory || usdHistory.length === 0) return null;
    return usdHistory.map((p) => ({ date: p.date, price: p.price * fxMep }));
  }
  const type = TYPE_MAP[cat];
  if (!type) return null; // ej: Fondos, no cubierto por data912
  const requestTicker = (cat === "CEDEARs" && US_TICKER_ALIAS[ticker]) || ticker;
  const data = await fetchJson(`https://data912.com/historical/${type}/${requestTicker}`);
  // Los bonos vienen cada 100 de nominal -- eso sí se corrige acá (es una
  // convención de cotización, no un valor real distinto). Las CEDEARs, en
  // cambio, se guardan tal cual -- es el precio real en dólares de la acción
  // en EE.UU., y la app decide cómo mostrarlo (como acción real, o convertido
  // a la escala del CEDEAR según el precio en vivo del día).
  const fxAdjust = (price) => (cat === "Bonos" ? price / 100 : price);

  // Formato A (stocks/bonds argentinos): lista de objetos [{date, c, ...}, ...]
  if (Array.isArray(data) && data.length > 0) {
    return data
      .map((row) => {
        const date = row.date || row.fecha || row.d || row.t;
        const price = row.c ?? row.close ?? row.px ?? row.price;
        if (!date || price == null) return null;
        return { date: String(date).slice(0, 10), price: fxAdjust(price) };
      })
      .filter(Boolean);
  }

  // Formato B (usa_stocks / CEDEARs): un objeto con arrays paralelos {dates:[...], prices:[...]}
  if (data && Array.isArray(data.dates) && Array.isArray(data.prices)) {
    const out = [];
    for (let i = 0; i < data.dates.length; i++) {
      if (data.dates[i] == null || data.prices[i] == null) continue;
      out.push({ date: String(data.dates[i]).slice(0, 10), price: fxAdjust(data.prices[i]) });
    }
    return out.length > 0 ? out : null;
  }

  if (data != null) console.log(`    [formato desconocido] respuesta: ${JSON.stringify(data).slice(0, 150)}`);
  return null;
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
    if (h && h.length > 1) {
      history[ticker] = h;
      ok++;
      const dates = h.map((p) => p.date).sort();
      console.log(`ok (${h.length} puntos, desde ${dates[0]} hasta ${dates[dates.length - 1]})`);
    }
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
