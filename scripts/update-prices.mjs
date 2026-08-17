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
  ["NIO", "CEDEARs"], ["RIOT", "CEDEARs"], ["COIN", "CEDEARs"], ["XYZ", "CEDEARs"],
  ["PANW", "CEDEARs"], ["SNOW", "CEDEARs"], ["ABNB", "CEDEARs"], ["DIS", "CEDEARs"],
  // Acciones argentinas populares que no tenés
  ["TXAR", "Acciones"], ["ALUA", "Acciones"], ["CRES", "Acciones"], ["COME", "Acciones"],
  ["TECO2", "Acciones"], ["EDN", "Acciones"], ["TRAN", "Acciones"], ["CVH", "Acciones"],
  ["MIRG", "Acciones"], ["VALO", "Acciones"], ["BYMA", "Acciones"],
  // Otros bonos soberanos comunes
  ["AL29", "Bonos"], ["AE38", "Bonos"], ["GD29", "Bonos"], ["GD46", "Bonos"],
];

// Cripto: mismo tratamiento que el resto -- histórico cacheado una vez al día,
// para no depender de pedirle en vivo a CoinGecko cada vez que alguien mira el
// gráfico (eso fue justo lo que disparó el límite de pedidos gratis).
const CRYPTO_TICKERS = [
  ["BTC", "Cripto"], ["ETH", "Cripto"], ["SOL", "Cripto"], ["USDT", "Cripto"],
  ["NEXO", "Cripto"], ["POL", "Cripto"], ["DOT", "Cripto"], ["DOGE", "Cripto"],
  ["RENDER", "Cripto"], ["AVAX", "Cripto"], ["LINK", "Cripto"], ["BNB", "Cripto"],
];

const TICKERS = [...HOLDINGS_TICKERS, ...EXTRA_TICKERS, ...CRYPTO_TICKERS];

// Obligaciones negociables (ONs) -- no están en los paneles de data912 (eso
// solo trae acciones/CEDEARs/bonos soberanos), así que van directo por la API
// de IOL, igual que CONIOLA/ADCGLOA/IOLDOLD/PRPEDOB/PLC2O más abajo.
const ON_TICKERS = ["DEC2O", "IRCPO", "LOC6O", "MIC6O", "PLC3O", "PQCSO", "YM34O", "YM42O", "ZZC1O"];

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
// NEXO no está en Coinbase ni en Kraken -- no encontramos fuente gratis
// viable, cae al fallback plano (precio actual hacia atrás).
const COINBASE_PRODUCTS = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD",
  DOT: "DOT-USD", DOGE: "DOGE-USD", RENDER: "RENDER-USD", AVAX: "AVAX-USD", LINK: "LINK-USD",
};
// Pares de Kraken -- se usan solo como respaldo para lo que Coinbase no
// tiene. POL sí está listado en Kraken (por el rebrand de MATIC). BNB no
// está en ningún exchange competidor de Binance por conflicto de interés, así
// que no hay fuente gratis para eso tampoco -- cae al fallback plano.
const KRAKEN_PRODUCTS = { POL: "POLUSD" };
// Binance.US -- solo para BNB, el único caso donde ni Coinbase ni Kraken
// tienen el par por ser el token del exchange competidor.
const BINANCE_US_PRODUCTS = { BNB: "BNBUSD" };
// MEXC -- solo para NEXO, el único caso donde no lo tienen ni Coinbase, ni
// Kraken, ni Binance.US.
const MEXC_PRODUCTS = { NEXO: "NEXOUSDT" };

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

// Respaldo para lo que Coinbase no tiene (por ahora, solo POL). Kraken es
// pública, sin key, sin bloqueo geográfico. Su OHLC diario pagina con el
// parámetro "since" (timestamp del último dato recibido).
async function fetchKrakenHistory(pair) {
  const out = [];
  let since = 0;
  for (let i = 0; i < 15; i++) {
    const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440&since=${since}`;
    const data = await fetchJson(url);
    const resultKeys = data?.result ? Object.keys(data.result).filter((k) => k !== "last") : [];
    const rows = resultKeys.length > 0 ? data.result[resultKeys[0]] : null;
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      // Formato: [time (unix seg), open, high, low, close, vwap, volume, count]
      const [time, , , , close] = row;
      if (time != null && close != null) out.push({ date: new Date(time * 1000).toISOString().slice(0, 10), price: parseFloat(close) });
    }
    const newSince = data.result.last;
    if (!newSince || newSince === since) break; // no avanzó, ya llegamos al final
    since = newSince;
    await sleep(500);
  }
  const byDate = new Map();
  for (const p of out) byDate.set(p.date, p.price);
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price }));
}

// Respaldo específico para BNB: Coinbase y Kraken no lo listan (conflicto de
// interés, es el token del exchange competidor), pero Binance.US -- la
// entidad separada y regulada para EE.UU., no el Binance.com principal que sí
// bloquea IPs de EE.UU. -- lo tiene y su API pública no debería tener ese
// bloqueo (fue pensada justo para usuarios de EE.UU., como los runners de
// GitHub Actions). Si algún día empieza a fallar por bloqueo regional
// igual, cae al fallback plano como cualquier otro ticker sin datos.
async function fetchBinanceUsHistory(symbol) {
  const out = [];
  let endTime = Date.now();
  const earliestFloor = new Date("2018-01-01T00:00:00Z").getTime();
  for (let i = 0; i < 15 && endTime > earliestFloor; i++) {
    const url = `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000&endTime=${endTime}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const row of data) {
      // Formato: [openTime, open, high, low, close, volume, closeTime, ...]
      const [openTime, , , , close] = row;
      if (openTime != null && close != null) out.push({ date: new Date(openTime).toISOString().slice(0, 10), price: parseFloat(close) });
    }
    const earliestOpenTime = data[0][0];
    if (data.length < 1000) break; // ya llegamos al principio del listado
    endTime = earliestOpenTime - 1;
    await sleep(500);
  }
  const byDate = new Map();
  for (const p of out) byDate.set(p.date, p.price);
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price }));
}

// Respaldo específico para NEXO: ni Coinbase, ni Kraken, ni Binance.US lo
// tienen (es chico). MEXC sí lo lista, con API pública sin key -- pero puso
// restricciones a pares de su "Assessment Zone" en 2025, y no confirmamos si
// NEXO sigue ahí, así que esto puede fallar. Si falla, cae al fallback plano
// como cualquier otro ticker, sin romper nada.
async function fetchMexcHistory(symbol) {
  const out = [];
  let endTime = Date.now();
  const earliestFloor = new Date("2018-01-01T00:00:00Z").getTime();
  for (let i = 0; i < 15 && endTime > earliestFloor; i++) {
    const url = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000&endTime=${endTime}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const row of data) {
      const [openTime, , , , close] = row;
      if (openTime != null && close != null) out.push({ date: new Date(openTime).toISOString().slice(0, 10), price: parseFloat(close) });
    }
    const earliestOpenTime2 = data[0][0];
    if (data.length < 1000) break;
    endTime = earliestOpenTime2 - 1;
    await sleep(500);
  }
  const byDate = new Map();
  for (const p of out) byDate.set(p.date, p.price);
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price }));
}

async function fetchHistoryFor(ticker, cat, fxMep) {
  if (CRYPTO_IDS[ticker]) {
    let usdHistory = await fetchCoinbaseHistory(ticker);
    if ((!usdHistory || usdHistory.length === 0) && KRAKEN_PRODUCTS[ticker]) {
      usdHistory = await fetchKrakenHistory(KRAKEN_PRODUCTS[ticker]);
    }
    if ((!usdHistory || usdHistory.length === 0) && BINANCE_US_PRODUCTS[ticker]) {
      usdHistory = await fetchBinanceUsHistory(BINANCE_US_PRODUCTS[ticker]);
    }
    if ((!usdHistory || usdHistory.length === 0) && MEXC_PRODUCTS[ticker]) {
      usdHistory = await fetchMexcHistory(MEXC_PRODUCTS[ticker]);
    }
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

// CONIOLA vía la API de IOL: requiere una cuenta de IOL con el producto
// "APIs" habilitado (gratis, se pide desde Mi Cuenta > Mensajes) y los
// secrets IOL_USERNAME / IOL_PASSWORD cargados en el repo (Settings ->
// Secrets and variables -> Actions). El bearer token dura 15-20 minutos,
// pero acá alcanza con pedirlo una vez por corrida.
async function fetchIolToken() {
  const username = process.env.IOL_USERNAME;
  const password = process.env.IOL_PASSWORD;
  if (!username || !password) {
    console.log("    [IOL] faltan IOL_USERNAME / IOL_PASSWORD como secrets");
    return null;
  }
  try {
    const res = await fetch("https://api.invertironline.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password`,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`    [IOL] login falló, status ${res.status} -- ${text.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (!data?.access_token) console.log(`    [IOL] login ok pero sin access_token en la respuesta: ${JSON.stringify(data).slice(0, 200)}`);
    return data?.access_token || null;
  } catch (err) {
    console.log(`    [IOL] excepción al pedir el token: ${err.message}`);
    return null;
  }
}

async function fetchFromIol(token, ticker) {
  if (!token) return null;
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.invertironline.com/api/v2/bCBA/Titulos/${ticker}/Cotizacion/seriehistorica/2015-01-01/${today}/sinAjustar`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`    [IOL] pedido de cotización de ${ticker} falló, status ${res.status} -- ${text.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    // La API devuelve un array directo -- el {"value": [...]} que vimos al
    // probar con PowerShell era un artefacto de cómo ConvertTo-Json
    // re-serializa lo que Invoke-RestMethod ya había parseado, no la forma
    // real de la respuesta. Se acepta cualquiera de las dos formas igual,
    // por las dudas.
    const rows = Array.isArray(data) ? data : data?.value;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`    [IOL] ${ticker}: respuesta sin datos utilizables: ${JSON.stringify(data).slice(0, 200)}`);
      return null;
    }
    // Puede haber varias cotizaciones intradía en el mismo día -- nos
    // quedamos con la más reciente de cada fecha como cierre de ese día.
    const byDate = {};
    for (const r of rows) {
      const date = r.fechaHora?.slice(0, 10);
      if (!date || r.ultimoPrecio == null) continue;
      if (!byDate[date] || r.fechaHora > byDate[date].fechaHora) byDate[date] = r;
    }
    const series = Object.entries(byDate)
      .map(([date, r]) => ({ date, price: r.ultimoPrecio, variacion: r.variacion }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return series.length > 1 ? series : null;
  } catch (err) {
    console.log(`    [IOL] excepción al pedir la cotización: ${err.message}`);
    return null;
  }
}

// CONIOLA (fondo AdCap Acciones) -- respaldo si la API de IOL no está
// configurada o falla ese día: se aproxima con un índice ponderado de sus 5
// principales tenencias reales, según el informe de calificación de Moody's
// Local del 13/8/2025 (~65,6% de la cartera -- el ~34% restante, entre otras
// acciones, plazo fijo y liquidez, no está representado acá):
//   YPFD 19,0% · Pampa Energía (PAMP) 18,4% · Galicia (GGAL) 12,9% ·
//   BBVA Argentina (BBAR) 7,7% · Transp. Gas del Sur (TGSU2) 7,6%
// Esos 5 pesos se renormalizan a 100% entre sí, y el índice resultante se
// ancla al último precio real conocido de CONIOLA (183,29 ARS al 14/08/2026).
const CONIOLA_PROXY = {
  anchorDate: "2026-08-14",
  anchorPrice: 183.29,
  weights: { YPFD: 0.2896, PAMP: 0.2805, GGAL: 0.1967, BBAR: 0.1174, TGSU2: 0.1159 },
};

function buildConiolaProxy(history) {
  const tickers = Object.keys(CONIOLA_PROXY.weights);
  const maps = {};
  for (const t of tickers) {
    if (!history[t]) return null;
    maps[t] = {};
    for (const p of history[t]) maps[t][p.date] = p.price;
  }

  // Precio de anclaje de cada componente -- el de la fecha de referencia, o
  // el disponible más cercano hacia atrás si no hay dato exacto ese día.
  const anchorPrices = {};
  for (const t of tickers) {
    const dates = Object.keys(maps[t]).sort();
    let closest = null;
    for (const d of dates) {
      if (d > CONIOLA_PROXY.anchorDate) break;
      closest = d;
    }
    anchorPrices[t] = closest ? maps[t][closest] : null;
  }
  if (Object.values(anchorPrices).some((v) => v == null)) return null;

  const allDates = new Set();
  for (const t of tickers) for (const d of Object.keys(maps[t])) allDates.add(d);

  const out = [];
  for (const date of [...allDates].sort()) {
    let ratioSum = 0;
    let weightSum = 0;
    for (const t of tickers) {
      const p = maps[t][date];
      if (p == null) continue;
      ratioSum += CONIOLA_PROXY.weights[t] * (p / anchorPrices[t]);
      weightSum += CONIOLA_PROXY.weights[t];
    }
    if (weightSum === 0) continue;
    const index = ratioSum / weightSum; // renormaliza si algún componente falta justo ese día
    out.push({ date, price: CONIOLA_PROXY.anchorPrice * index });
  }
  return out.length > 1 ? out : null;
}

async function main() {
  console.log("Actualizando dólar...");
  const fx = await fetchFx();
  const fxMep = fx?.mep?.value || 1245;

  console.log("Actualizando precios en vivo...");
  const { prices: live, catalog } = await fetchLivePanels();

  console.log("Actualizando cripto en vivo...");
  const cryptoLive = {};
  // Un solo pedido con todos los ids juntos -- pedir uno por uno (como antes)
  // fue justo lo que empezó a pegar contra el límite gratis de CoinGecko al
  // sumar más monedas.
  const allIds = Object.values(CRYPTO_IDS).join(",");
  const cryptoData = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${allIds}&vs_currencies=usd`);
  for (const [symbol, id] of Object.entries(CRYPTO_IDS)) {
    if (cryptoData?.[id]?.usd) cryptoLive[symbol] = cryptoData[id].usd;
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
  console.log(`Histórico conseguido para ${ok} de ${TICKERS.length} tickers (más las ONs, que se cuentan aparte más abajo).`);

  console.log("Buscando activos de IOL sin otra fuente (CONIOLA, ADCGLOA, IOLDOLD, PRPEDOB, PLC2O, ONs)...");
  const iolToken = await fetchIolToken();
  const coniolaReal = await fetchFromIol(iolToken, "CONIOLA");
  if (coniolaReal) {
    history.CONIOLA = coniolaReal.map((p) => ({ date: p.date, price: p.price }));
    ok++;
    console.log(`  CONIOLA... ok vía IOL (${coniolaReal.length} puntos, desde ${coniolaReal[0].date} hasta ${coniolaReal[coniolaReal.length - 1].date})`);
  } else {
    const coniolaProxy = buildConiolaProxy(history);
    if (coniolaProxy) {
      history.CONIOLA = coniolaProxy;
      ok++;
      console.log(`  CONIOLA... IOL no disponible, aproximado con índice ponderado de 5 tenencias (${coniolaProxy.length} puntos)`);
    } else {
      console.log("  CONIOLA... no se pudo obtener ni real (IOL) ni aproximado");
    }
  }

  // Estos no tienen un fondo/índice de respaldo como CONIOLA -- si IOL no los
  // tiene, quedan directamente en "sin datos" (fallback plano en la app).
  // PLC2O y las ONs (DEC2O, IRCPO, etc.) son títulos de deuda -- vía el mismo
  // endpoint de IOL, cotizan cada 100 de nominal (misma convención que
  // AL30/GD35/GD38/GD41 en data912), así que necesitan la misma corrección
  // /100. ADCGLOA/IOLDOLD/PRPEDOB son fondos comunes (cuotaparte directa), no
  // la necesitan.
  const IOL_PER_100_NOMINAL = new Set(["PLC2O", ...ON_TICKERS]);
  for (const ticker of ["ADCGLOA", "IOLDOLD", "PRPEDOB", "PLC2O", ...ON_TICKERS]) {
    const series = await fetchFromIol(iolToken, ticker);
    if (series) {
      const fxAdjust = IOL_PER_100_NOMINAL.has(ticker) ? (p) => p / 100 : (p) => p;
      history[ticker] = series.map((p) => ({ date: p.date, price: fxAdjust(p.price) }));
      ok++;
      console.log(`  ${ticker}... ok vía IOL (${series.length} puntos, desde ${series[0].date} hasta ${series[series.length - 1].date})`);
    } else {
      console.log(`  ${ticker}... sin datos (IOL no lo tiene disponible)`);
    }
    await sleep(500);
  }

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
