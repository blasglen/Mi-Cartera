import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ReferenceDot,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Bitcoin,
  Landmark,
  Coins,
  Home,
  Upload,
  CalendarRange,
  History,
  PlusCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  CheckCircle2,
  Link2,
  Search,
  Sun,
  Moon,
  FileText,
  Layers,
  Globe,
} from "lucide-react";

// ---------- Datos simulados (después se reemplazan por el import real) ----------

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSeries() {
  const days = 420;
  const rand = seededRandom(42);
  const out = [];
  // Anclado al valor real actual de la cartera consolidada (Balanz + Bull Market + IOL).
  // El recorrido histórico hacia atrás sigue siendo simulado -- todavía no tenemos
  // valuaciones diarias reales, eso llega cuando conectemos cotizaciones en vivo.
  let equities = 8_019_532;
  let bonos = 1_717_611;
  let fondos = 196_054;
  const today = new Date();
  const points = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    points.push(d.toISOString().slice(0, 10));
  }
  // recorrer de hoy hacia atrás y aplicar la variación inversa, para que el último
  // punto (hoy) quede exactamente en el valor real
  const rows = [];
  for (let i = 0; i <= days; i++) {
    rows.unshift({ date: points[days - i], equities: Math.round(equities), bonos: Math.round(bonos), fondos: Math.round(fondos) });
    equities /= 1 + (rand() - 0.47) * 0.016;
    bonos /= 1 + (rand() - 0.49) * 0.009;
    fondos /= 1 + (rand() - 0.48) * 0.012;
  }
  return rows.map((r) => ({ ...r, total: r.equities + r.bonos + r.fondos }));
}

const SERIES = buildSeries();

const HOLDINGS = [
  { name: "YPFD", cat: "Acciones", qty: 40.0, avgCost: 7957.61, price: 13973.27, broker: "Balanz", manual: false },
  { name: "AMD", cat: "CEDEARs", qty: 1.0, avgCost: 76430.28, price: 75607.89, broker: "Balanz", manual: false },
  { name: "CEPU", cat: "Acciones", qty: 82.0, avgCost: 2425.57, price: 2949.73, broker: "Balanz", manual: false },
  { name: "TSM", cat: "CEDEARs", qty: 5.0, avgCost: 73767.68, price: 87976.07, broker: "Balanz", manual: false },
  { name: "BABA", cat: "CEDEARs", qty: 4.0, avgCost: 19821.04, price: 22326.42, broker: "Balanz", manual: false },
  { name: "GOOGL", cat: "CEDEARs", qty: 13.0, avgCost: 9828.05, price: 11956.61, broker: "Balanz", manual: false },
  { name: "MSFT", cat: "CEDEARs", qty: 15.0, avgCost: 20366.18, price: 19790.22, broker: "Balanz", manual: false },
  { name: "GOOGL", cat: "CEDEARs", qty: 14.0, avgCost: 7732.32, price: 9406.99, broker: "Balanz", manual: false },
  { name: "PFE", cat: "CEDEARs", qty: 10.0, avgCost: 9452.49, price: 8907.55, broker: "Balanz", manual: false },
  { name: "MELI", cat: "CEDEARs", qty: 18.0, avgCost: 23039.24, price: 22207.98, broker: "Balanz", manual: false },
  { name: "META", cat: "CEDEARs", qty: 5.0, avgCost: 42170.79, price: 48462.67, broker: "Balanz", manual: false },
  { name: "SPY", cat: "CEDEARs", qty: 12.0, avgCost: 14447.62, price: 43771.08, broker: "Balanz", manual: false },
  { name: "VIST", cat: "CEDEARs", qty: 3.0, avgCost: 25428.11, price: 28507.96, broker: "Balanz", manual: false },
  { name: "GGAL", cat: "Acciones", qty: 13.0, avgCost: 7023.11, price: 8395.42, broker: "Balanz", manual: false },
  { name: "MU", cat: "CEDEARs", qty: 1.0, avgCost: 71321.5, price: 71859.26, broker: "Balanz", manual: false },
  { name: "AMZN", cat: "CEDEARs", qty: 31.0, avgCost: 2442.15, price: 2647.09, broker: "Balanz", manual: false },
  { name: "BBAR", cat: "Acciones", qty: 6.0, avgCost: 7018.91, price: 7021.3, broker: "Balanz", manual: false },
  { name: "BMA", cat: "Acciones", qty: 3.0, avgCost: 9103.44, price: 11008.43, broker: "Balanz", manual: false },
  { name: "GD35", cat: "Bonos", qty: 62.0, avgCost: 811.86, price: 787.8, broker: "Balanz", manual: false },
  { name: "GD38", cat: "Bonos", qty: 79.0, avgCost: 894.47, price: 1043.46, broker: "Balanz", manual: false },
  { name: "GD41", cat: "Bonos", qty: 86.0, avgCost: 791.96, price: 939.79, broker: "Balanz", manual: false },
  { name: "AAPL", cat: "CEDEARs", qty: 12.0, avgCost: 12848.4, price: 15558.64, broker: "Bull Market", manual: false },
  { name: "AMD", cat: "CEDEARs", qty: 10.0, avgCost: 14143.2, price: 16389.99, broker: "Bull Market", manual: false },
  { name: "BABA", cat: "CEDEARs", qty: 20.0, avgCost: 13744.8, price: 14101.2, broker: "Bull Market", manual: false },
  { name: "MELI", cat: "CEDEARs", qty: 16.0, avgCost: 20081.85, price: 24275.14, broker: "Bull Market", manual: false },
  { name: "PFE", cat: "CEDEARs", qty: 5.0, avgCost: 9399.75, price: 9074.71, broker: "Bull Market", manual: false },
  { name: "QQQ", cat: "CEDEARs", qty: 4.0, avgCost: 30290.85, price: 32183.12, broker: "Bull Market", manual: false },
  { name: "SPY", cat: "CEDEARs", qty: 48.0, avgCost: 11889.75, price: 11587.04, broker: "Bull Market", manual: false },
  { name: "BBAR", cat: "Acciones", qty: 10.0, avgCost: 4718.55, price: 5667.03, broker: "Bull Market", manual: false },
  { name: "GGAL", cat: "Acciones", qty: 14.0, avgCost: 4531.8, price: 4683.43, broker: "Bull Market", manual: false },
  { name: "CONIOLA", cat: "Fondos", qty: 1676.82, avgCost: 112.05, price: 152.26, broker: "Bull Market", manual: false },
  { name: "NVDA", cat: "CEDEARs", qty: 34.0, avgCost: 8790.7, price: 9771.57, broker: "IOL", manual: false },
  { name: "META", cat: "CEDEARs", qty: 4.0, avgCost: 24474.69, price: 27535.98, broker: "IOL", manual: false },
  { name: "MELI", cat: "CEDEARs", qty: 8.0, avgCost: 18870.08, price: 21992.32, broker: "IOL", manual: false },
  { name: "KO", cat: "CEDEARs", qty: 1.0, avgCost: 10800.93, price: 12184.31, broker: "IOL", manual: false },
  { name: "CSCO", cat: "CEDEARs", qty: 1.0, avgCost: 10142.69, price: 11254.02, broker: "IOL", manual: false },
  { name: "DISN", cat: "CEDEARs", qty: 2.0, avgCost: 7552.64, price: 9070.79, broker: "IOL", manual: false },
  { name: "AMZN", cat: "CEDEARs", qty: 55.0, avgCost: 1627.25, price: 1824.73, broker: "IOL", manual: false },
  { name: "KEEL", cat: "CEDEARs", qty: 1.0, avgCost: 16085.6, price: 16245.97, broker: "IOL", manual: false },
  { name: "MCD", cat: "CEDEARs", qty: 2.0, avgCost: 12230.74, price: 13416.75, broker: "IOL", manual: false },
  { name: "GGAL", cat: "Acciones", qty: 57.0, avgCost: 5560.75, price: 5403.49, broker: "IOL", manual: false },
  { name: "MSFT", cat: "CEDEARs", qty: 10.0, avgCost: 16608.0, price: 16823.41, broker: "IOL", manual: false },
  { name: "LLY", cat: "CEDEARs", qty: 7.0, avgCost: 97639.97, price: 105356.46, broker: "IOL", manual: false },
  { name: "PBR", cat: "CEDEARs", qty: 1.0, avgCost: 19838.26, price: 20751.42, broker: "IOL", manual: false },
  { name: "YPFD", cat: "Acciones", qty: 2.0, avgCost: 19636.85, price: 23527.5, broker: "IOL", manual: false },
  { name: "TGSU2", cat: "Acciones", qty: 8.0, avgCost: 5953.06, price: 6871.08, broker: "IOL", manual: false },
  { name: "PAMP", cat: "Acciones", qty: 4.0, avgCost: 2439.5, price: 2823.31, broker: "IOL", manual: false },
  { name: "PYPL", cat: "CEDEARs", qty: 2.0, avgCost: 10012.78, price: 12187.66, broker: "IOL", manual: false },
  { name: "SPY", cat: "CEDEARs", qty: 9.0, avgCost: 32139.49, price: 37515.14, broker: "IOL", manual: false },
  { name: "GD38", cat: "Bonos", qty: 118.0, avgCost: 848.2, price: 896.0, broker: "IOL", manual: false },
  { name: "GD41", cat: "Bonos", qty: 133.0, avgCost: 747.09, price: 864.27, broker: "IOL", manual: false },
  { name: "AAPL", cat: "CEDEARs", qty: 4.0, avgCost: 15554.07, price: 14604.18, broker: "IOL", manual: false },
  { name: "BBAR", cat: "Acciones", qty: 27.0, avgCost: 4473.58, price: 4775.19, broker: "IOL", manual: false },
  { name: "SUPV", cat: "Acciones", qty: 15.0, avgCost: 1625.33, price: 1725.69, broker: "IOL", manual: false },
  { name: "AL30", cat: "Bonos", qty: 1683.0, avgCost: 751.05, price: 763.42, broker: "IOL", manual: false },
  { name: "HMY", cat: "CEDEARs", qty: 4.0, avgCost: 9442.81, price: 9759.89, broker: "IOL", manual: false },
  { name: "IBM", cat: "CEDEARs", qty: 3.0, avgCost: 36151.95, price: 43217.13, broker: "IOL", manual: false },
  { name: "T", cat: "CEDEARs", qty: 1.0, avgCost: 5937.38, price: 6924.59, broker: "IOL", manual: false },
  { name: "TSLA", cat: "CEDEARs", qty: 1.0, avgCost: 15909.88, price: 19297.89, broker: "IOL", manual: false },
  { name: "DIA", cat: "CEDEARs", qty: 1.0, avgCost: 17814.14, price: 16781.81, broker: "IOL", manual: false },
  { name: "AMD", cat: "CEDEARs", qty: 1.0, avgCost: 20392.11, price: 20774.05, broker: "IOL", manual: false },
  { name: "LOMA", cat: "Acciones", qty: 40.0, avgCost: 2590.55, price: 2977.76, broker: "IOL", manual: false },
];

const MOVIMIENTOS = [
  { fecha: "2026-08-07", activo: "YPFD", tipo: "Compra", cantidad: 20.0, precio: 7867.009, broker: "Balanz" },
  { fecha: "2026-08-03", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 76430.28, broker: "Balanz" },
  { fecha: "2026-07-29", activo: "CEPU", tipo: "Compra", cantidad: 43.0, precio: 2313.293, broker: "Balanz" },
  { fecha: "2026-07-23", activo: "TSM", tipo: "Compra", cantidad: 2.0, precio: 73812.975, broker: "Balanz" },
  { fecha: "2026-07-13", activo: "YPFD", tipo: "Compra", cantidad: 1.0, precio: 77411.77, broker: "Balanz" },
  { fecha: "2026-07-13", activo: "BABA", tipo: "Compra", cantidad: 4.0, precio: 19821.0375, broker: "Balanz" },
  { fecha: "2026-07-13", activo: "AL30", tipo: "Compra", cantidad: 34.0, precio: 85740.0, broker: "IOL" },
  { fecha: "2026-07-13", activo: "AL30D", tipo: "Venta", cantidad: 34.0, precio: 56.12, broker: "IOL" },
  { fecha: "2026-07-06", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 80406.57, broker: "Balanz" },
  { fecha: "2026-07-06", activo: "GOOGL", tipo: "Compra", cantidad: 8.0, precio: 9905.4862, broker: "Balanz" },
  { fecha: "2026-06-30", activo: "MSFT", tipo: "Compra", cantidad: 4.0, precio: 19398.24, broker: "Balanz" },
  { fecha: "2026-06-29", activo: "GOOGL", tipo: "Compra", cantidad: 14.0, precio: 6.2107, broker: "Balanz" },
  { fecha: "2026-06-26", activo: "ADBE", tipo: "Venta", cantidad: 20.0, precio: 4.6045, broker: "Balanz" },
  { fecha: "2026-06-17", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 73208.99, broker: "Balanz" },
  { fecha: "2026-06-10", activo: "YPFD", tipo: "Compra", cantidad: 1.0, precio: 83552.37, broker: "Balanz" },
  { fecha: "2026-06-01", activo: "GOOGL", tipo: "Compra", cantidad: 5.0, precio: 9704.154, broker: "Balanz" },
  { fecha: "2026-05-22", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 67596.89, broker: "Balanz" },
  { fecha: "2026-05-18", activo: "PFE", tipo: "Compra", cantidad: 10.0, precio: 9452.491, broker: "Balanz" },
  { fecha: "2026-05-11", activo: "MELI", tipo: "Compra", cantidad: 7.0, precio: 19599.5729, broker: "Balanz" },
  { fecha: "2026-04-30", activo: "MSFT", tipo: "Compra", cantidad: 5.0, precio: 20102.9, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "MELI", tipo: "Compra", cantidad: 3.0, precio: 25891.1667, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "META", tipo: "Compra", cantidad: 2.0, precio: 42702.305, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 51440.07, broker: "Balanz" },
  { fecha: "2026-01-29", activo: "MSFT", tipo: "Compra", cantidad: 4.0, precio: 22720.2025, broker: "Balanz" },
  { fecha: "2026-01-22", activo: "ADBE", tipo: "Compra", cantidad: 20.0, precio: 10328.2805, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "VIST", tipo: "Compra", cantidad: 3.0, precio: 25428.1067, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "MELI", tipo: "Compra", cantidad: 6.0, precio: 26475.0267, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "CEPU", tipo: "Compra", cantidad: 39.0, precio: 2549.3538, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "GGAL", tipo: "Compra", cantidad: 2.0, precio: 8204.24, broker: "Balanz" },
  { fecha: "2025-11-05", activo: "MU", tipo: "Compra", cantidad: 1.0, precio: 71321.5, broker: "Balanz" },
  { fecha: "2025-10-30", activo: "META", tipo: "Compra", cantidad: 3.0, precio: 41816.45, broker: "Balanz" },
  { fecha: "2025-10-08", activo: "AMZN", tipo: "Compra", cantidad: 31.0, precio: 2442.1452, broker: "Balanz" },
  { fecha: "2025-06-05", activo: "GGAL", tipo: "Compra", cantidad: 7.0, precio: 6515.4057, broker: "Balanz" },
  { fecha: "2025-06-05", activo: "BBAR", tipo: "Compra", cantidad: 6.0, precio: 7018.915, broker: "Balanz" },
  { fecha: "2025-06-05", activo: "BMA", tipo: "Compra", cantidad: 3.0, precio: 9103.4433, broker: "Balanz" },
  { fecha: "2025-05-29", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 18252.2, broker: "Balanz" },
  { fecha: "2025-05-29", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 35245.63, broker: "Balanz" },
  { fecha: "2025-04-28", activo: "GD35", tipo: "Compra", cantidad: 62.0, precio: 811.8592, broker: "Balanz" },
  { fecha: "2025-02-24", activo: "GGAL", tipo: "Compra", cantidad: 4.0, precio: 7321.02, broker: "Balanz" },
  { fecha: "2025-02-11", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 20492.82, broker: "Balanz" },
  { fecha: "2025-02-03", activo: "GGAL", tipo: "Compra", cantidad: 6.0, precio: 7810.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 18425.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 16350.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "AMZN", tipo: "Compra", cantidad: 20.0, precio: 1945.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "TGSU2", tipo: "Compra", cantidad: 6.0, precio: 6670.0, broker: "IOL" },
  { fecha: "2025-01-30", activo: "GGALX", tipo: "Venta", cantidad: 51.0, precio: 20.7, broker: "IOL" },
  { fecha: "2025-01-21", activo: "GD38", tipo: "Compra", cantidad: 118.0, precio: 84390.0, broker: "IOL" },
  { fecha: "2025-01-21", activo: "GD41", tipo: "Compra", cantidad: 133.0, precio: 74330.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "GD38", tipo: "Compra", cantidad: 79.0, precio: 894.4723, broker: "Balanz" },
  { fecha: "2025-01-07", activo: "GD41", tipo: "Compra", cantidad: 86.0, precio: 791.9597, broker: "Balanz" },
  { fecha: "2025-01-07", activo: "GGAL", tipo: "Compra", cantidad: 7.0, precio: 8560.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "NVDA", tipo: "Compra", cantidad: 7.0, precio: 7590.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "MSFT", tipo: "Compra", cantidad: 3.0, precio: 17000.0, broker: "IOL" },
  { fecha: "2024-12-19", activo: "AL30D", tipo: "Venta", cantidad: 9.0, precio: 74.05, broker: "IOL" },
  { fecha: "2024-12-18", activo: "LOMA", tipo: "Compra", cantidad: 20.0, precio: 3025.0, broker: "IOL" },
  { fecha: "2024-12-18", activo: "GGAL", tipo: "Compra", cantidad: 10.0, precio: 8190.0, broker: "IOL" },
  { fecha: "2024-12-18", activo: "AL30", tipo: "Compra", cantidad: 9.0, precio: 85060.0, broker: "IOL" },
  { fecha: "2024-11-15", activo: "AL30D", tipo: "Venta", cantidad: 320.0, precio: 69.22, broker: "IOL" },
  { fecha: "2024-11-14", activo: "AL30", tipo: "Compra", cantidad: 320.0, precio: 77300.0, broker: "IOL" },
  { fecha: "2024-11-08", activo: "AL30D", tipo: "Venta", cantidad: 577.0, precio: 67.27, broker: "IOL" },
  { fecha: "2024-11-07", activo: "AL30", tipo: "Compra", cantidad: 577.0, precio: 77250.0, broker: "IOL" },
  { fecha: "2024-11-07", activo: "MELI", tipo: "Compra", cantidad: 4.0, precio: 17125.0, broker: "IOL" },
  { fecha: "2024-11-05", activo: "AL30D", tipo: "Venta", cantidad: 47.0, precio: 64.96, broker: "IOL" },
  { fecha: "2024-11-04", activo: "AL30", tipo: "Compra", cantidad: 47.0, precio: 74740.0, broker: "IOL" },
  { fecha: "2024-10-30", activo: "AL30D", tipo: "Venta", cantidad: 155.0, precio: 64.92, broker: "IOL" },
  { fecha: "2024-10-29", activo: "NVDA", tipo: "Compra", cantidad: 7.0, precio: 6820.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 28450.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "AMZN", tipo: "Compra", cantidad: 10.0, precio: 1540.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "LOMA", tipo: "Compra", cantidad: 20.0, precio: 2120.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "AL30", tipo: "Compra", cantidad: 155.0, precio: 74285.2903, broker: "IOL" },
  { fecha: "2024-10-17", activo: "AL30D", tipo: "Venta", cantidad: 128.0, precio: 61.96, broker: "IOL" },
  { fecha: "2024-10-16", activo: "NVDA", tipo: "Compra", cantidad: 8.0, precio: 6630.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 16300.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 34350.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "AL30", tipo: "Compra", cantidad: 128.0, precio: 72930.0, broker: "IOL" },
  { fecha: "2024-09-24", activo: "AL30D", tipo: "Venta", cantidad: 59.0, precio: 58.11, broker: "IOL" },
  { fecha: "2024-09-23", activo: "AL30", tipo: "Compra", cantidad: 59.0, precio: 70020.0, broker: "IOL" },
  { fecha: "2024-09-19", activo: "AL30D", tipo: "Venta", cantidad: 176.0, precio: 58.37, broker: "IOL" },
  { fecha: "2024-09-18", activo: "AL30", tipo: "Compra", cantidad: 176.0, precio: 69940.0, broker: "IOL" },
  { fecha: "2024-08-22", activo: "AL30D", tipo: "Venta", cantidad: 58.0, precio: 48.785, broker: "IOL" },
  { fecha: "2024-08-21", activo: "AMZN", tipo: "Compra", cantidad: 15.0, precio: 1615.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "MSFT", tipo: "Compra", cantidad: 1.0, precio: 18200.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 28600.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 20250.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "AL30", tipo: "Compra", cantidad: 58.0, precio: 64040.0, broker: "IOL" },
  { fecha: "2024-08-13", activo: "AL30D", tipo: "Venta", cantidad: 10.0, precio: 49.18, broker: "IOL" },
  { fecha: "2024-08-12", activo: "AL30", tipo: "Compra", cantidad: 10.0, precio: 62970.0, broker: "IOL" },
  { fecha: "2024-07-18", activo: "AL30D", tipo: "Venta", cantidad: 9.0, precio: 48.025, broker: "IOL" },
  { fecha: "2024-07-17", activo: "AL30", tipo: "Compra", cantidad: 9.0, precio: 62760.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "MSFT", tipo: "Compra", cantidad: 1.0, precio: 21757.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "SPY", tipo: "Compra", cantidad: 3.0, precio: 39041.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "AAPL", tipo: "Compra", cantidad: 2.0, precio: 15640.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "HMY", tipo: "Compra", cantidad: 2.0, precio: 12939.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "AL30", tipo: "Compra", cantidad: 1.0, precio: 70450.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 34588.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "NVDA", tipo: "Compra", cantidad: 10.0, precio: 6840.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "AL30", tipo: "Compra", cantidad: 100.0, precio: 69880.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "BBAR", tipo: "Compra", cantidad: 20.0, precio: 4550.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "GGAL", tipo: "Compra", cantidad: 8.0, precio: 4475.0, broker: "IOL" },
  { fecha: "2024-05-23", activo: "NVDA", tipo: "Compra", cantidad: 1.0, precio: 54200.0, broker: "IOL" },
  { fecha: "2024-05-23", activo: "GGAL", tipo: "Compra", cantidad: 6.0, precio: 4004.0, broker: "IOL" },
  { fecha: "2024-05-16", activo: "GGAL", tipo: "Compra", cantidad: 1.0, precio: 3960.0, broker: "IOL" },
  { fecha: "2024-05-06", activo: "BBAR", tipo: "Compra", cantidad: 7.0, precio: 4135.0, broker: "IOL" },
  { fecha: "2024-05-06", activo: "SUPV", tipo: "Compra", cantidad: 15.0, precio: 1614.0, broker: "IOL" },
  { fecha: "2024-05-06", activo: "GGAL", tipo: "Compra", cantidad: 11.0, precio: 4000.0, broker: "IOL" },
  { fecha: "2024-02-05", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 25829.5, broker: "IOL" },
  { fecha: "2024-02-05", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 32050.0, broker: "IOL" },
  { fecha: "2024-01-25", activo: "GGAL", tipo: "Compra", cantidad: 3.0, precio: 2522.0, broker: "IOL" },
  { fecha: "2024-01-25", activo: "GGAL", tipo: "Compra", cantidad: 1.0, precio: 2523.95, broker: "IOL" },
  { fecha: "2024-01-18", activo: "YPFD", tipo: "Compra", cantidad: 2.0, precio: 19500.0, broker: "IOL" },
  { fecha: "2024-01-18", activo: "TGSU2", tipo: "Compra", cantidad: 2.0, precio: 3636.3, broker: "IOL" },
  { fecha: "2024-01-18", activo: "PAMP", tipo: "Compra", cantidad: 4.0, precio: 2422.5, broker: "IOL" },
  { fecha: "2024-01-18", activo: "PYPL", tipo: "Compra", cantidad: 2.0, precio: 9943.0, broker: "IOL" },
  { fecha: "2024-01-18", activo: "GGAL", tipo: "Compra", cantidad: 4.0, precio: 2050.0, broker: "IOL" },
  { fecha: "2024-01-18", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 30713.0, broker: "IOL" },
  { fecha: "2024-01-09", activo: "LLY", tipo: "Compra", cantidad: 1.0, precio: 96959.5, broker: "IOL" },
  { fecha: "2024-01-09", activo: "PBR", tipo: "Compra", cantidad: 1.0, precio: 19700.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "NVDA", tipo: "Compra", cantidad: 1.0, precio: 20291.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 14337.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "MELI", tipo: "Compra", cantidad: 1.0, precio: 25820.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "KO", tipo: "Compra", cantidad: 1.0, precio: 11420.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "CSCO", tipo: "Compra", cantidad: 1.0, precio: 10072.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "DISN", tipo: "Compra", cantidad: 2.0, precio: 7500.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "AMZN", tipo: "Compra", cantidad: 10.0, precio: 1035.0, broker: "IOL" },
  { fecha: "2024-01-02", activo: "KEEL", tipo: "Compra", cantidad: 1.0, precio: 15973.5, broker: "IOL" },
  { fecha: "2024-01-02", activo: "MCD", tipo: "Compra", cantidad: 2.0, precio: 12145.5, broker: "IOL" },
  { fecha: "2023-12-29", activo: "HMY", tipo: "Compra", cantidad: 2.0, precio: 5815.0, broker: "IOL" },
  { fecha: "2023-12-28", activo: "DIA", tipo: "Compra", cantidad: 1.0, precio: 17690.0, broker: "IOL" },
  { fecha: "2023-12-26", activo: "TSLA", tipo: "Compra", cantidad: 1.0, precio: 15799.0, broker: "IOL" },
  { fecha: "2023-12-13", activo: "IBM", tipo: "Compra", cantidad: 1.0, precio: 35900.0, broker: "IOL" },
  { fecha: "2023-12-13", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 25490.0, broker: "IOL" },
  { fecha: "2023-12-13", activo: "T", tipo: "Compra", cantidad: 1.0, precio: 5896.0, broker: "IOL" },
  { fecha: "2023-12-11", activo: "MSFT", tipo: "Compra", cantidad: 1.0, precio: 12530.0, broker: "IOL" },
  { fecha: "2023-10-17", activo: "MSFT", tipo: "Venta", cantidad: 2.0, precio: 10925.0, broker: "IOL" },
  { fecha: "2023-10-17", activo: "SPY", tipo: "Venta", cantidad: 6.0, precio: 21650.0, broker: "IOL" },
  { fecha: "2023-10-17", activo: "KO", tipo: "Venta", cantidad: 1.0, precio: 10665.0, broker: "IOL" },
  { fecha: "2023-08-31", activo: "COIN", tipo: "Venta", cantidad: 4.0, precio: 2460.5, broker: "IOL" },
  { fecha: "2023-08-31", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 8840.5, broker: "IOL" },
  { fecha: "2023-08-31", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 18097.5, broker: "IOL" },
  { fecha: "2023-08-30", activo: "KO", tipo: "Compra", cantidad: 1.0, precio: 9822.0, broker: "IOL" },
  { fecha: "2023-08-30", activo: "AAPL", tipo: "Compra", cantidad: 1.0, precio: 15057.0, broker: "IOL" },
  { fecha: "2023-08-29", activo: "SPY", tipo: "Compra", cantidad: 5.0, precio: 17713.5, broker: "IOL" },
  { fecha: "2023-08-29", activo: "COIN", tipo: "Compra", cantidad: 4.0, precio: 2480.0, broker: "IOL" },
];

const CATS = [
  { key: "Acciones", color: "#4FA184", icon: Landmark },
  { key: "CEDEARs", color: "#6C8FC7", icon: Globe },
  { key: "Bonos", color: "#C89B3C", icon: FileText },
  { key: "Fondos", color: "#A87CC8", icon: Layers },
];

const BROKER_LIST = [...new Set(HOLDINGS.map((h) => h.broker))];

function genPriceSeries(seed, basePrice, points, volatility) {
  const rand = seededRandom(seed);
  const out = [];
  let p = basePrice;
  const today = new Date();
  for (let i = points; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    p *= 1 + (rand() - 0.49) * volatility;
    out.push({ date: d.toISOString().slice(0, 10), price: Math.round(p * 100) / 100 });
  }
  return out;
}

const ASSET_UNIVERSE = [
  { symbol: "GGAL", name: "Grupo Financiero Galicia", cat: "Acciones AR", ccy: "ARS", seed: 11, base: 3900 },
  { symbol: "YPFD", name: "YPF S.A.", cat: "Acciones AR", ccy: "ARS", seed: 12, base: 20500 },
  { symbol: "PAMP", name: "Pampa Energía", cat: "Acciones AR", ccy: "ARS", seed: 13, base: 2650 },
  { symbol: "BMA", name: "Banco Macro", cat: "Acciones AR", ccy: "ARS", seed: 14, base: 9800 },
  { symbol: "AL30", name: "Bonar 2030", cat: "Bonos", ccy: "ARS", seed: 15, base: 680 },
  { symbol: "AAPL", name: "Apple Inc. (CEDEAR)", cat: "CEDEARs", ccy: "ARS", seed: 21, base: 24500 },
  { symbol: "TSLA", name: "Tesla Inc. (CEDEAR)", cat: "CEDEARs", ccy: "ARS", seed: 22, base: 31000 },
  { symbol: "BTC", name: "Bitcoin", cat: "Cripto", ccy: "ARS", seed: 31, base: 71_000_000 },
  { symbol: "ETH", name: "Ethereum", cat: "Cripto", ccy: "ARS", seed: 32, base: 2_190_000 },
  { symbol: "SOL", name: "Solana", cat: "Cripto", ccy: "ARS", seed: 33, base: 210_000 },
  { symbol: "USDT", name: "Tether", cat: "Cripto", ccy: "ARS", seed: 34, base: 1245 },
];

// Nombres completos para que el buscador encuentre por "microsoft" y no solo "MSFT".
// Cubre tus tenencias reales + los tickers más comunes; lo que no está acá usa el
// ticker como nombre (sigue siendo buscable por símbolo, solo no por nombre completo).
const SYMBOL_NAMES = {
  GGAL: "Grupo Financiero Galicia", YPFD: "YPF", BBAR: "Banco BBVA Argentina",
  BMA: "Banco Macro", CEPU: "Central Puerto", PAMP: "Pampa Energía", SUPV: "Grupo Supervielle",
  LOMA: "Loma Negra", TGSU2: "Transportadora de Gas del Sur",
  AAPL: "Apple", AMD: "AMD", AMZN: "Amazon", BABA: "Alibaba", GOOGL: "Google (Alphabet)",
  MELI: "Mercado Libre", META: "Meta (Facebook)", MSFT: "Microsoft", MU: "Micron",
  PFE: "Pfizer", TSM: "Taiwan Semiconductor (TSMC)", VIST: "Vista Energy", NVDA: "Nvidia",
  KO: "Coca-Cola", CSCO: "Cisco", DISN: "Disney", MCD: "McDonald's", LLY: "Eli Lilly",
  PBR: "Petrobras", PYPL: "PayPal", HMY: "Harmony Gold", IBM: "IBM", T: "AT&T",
  SPY: "SPDR S&P 500 (ETF)", QQQ: "Invesco QQQ Trust (Nasdaq 100)", DIA: "SPDR Dow Jones (ETF)",
  AL30: "Bonar 2030", GD35: "Global 2035", GD38: "Global 2038", GD41: "Global 2041",
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", USDT: "Tether", TSLA: "Tesla",
  CONIOLA: "AdCap Acciones - Fondo Común de Inversión",
};

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return 200 + h;
}

// Cualquier ticker que esté en tus tenencias reales pero no esté en el catálogo de
// arriba se agrega automáticamente, para que "Buscar activo" siempre encuentre lo
// que tenés en cartera (aunque el gráfico de precio siga siendo simulado).
const HOLDINGS_CAT_TO_SEARCH_CAT = { Acciones: "Acciones AR", CEDEARs: "CEDEARs", Bonos: "Bonos", Fondos: "CEDEARs" };
const AUTO_ASSETS = [...new Set(HOLDINGS.map((h) => h.name))]
  .filter((t) => !ASSET_UNIVERSE.some((a) => a.symbol === t))
  .map((t) => {
    const h = HOLDINGS.find((x) => x.name === t);
    return {
      symbol: t,
      name: SYMBOL_NAMES[t] || t,
      cat: HOLDINGS_CAT_TO_SEARCH_CAT[h.cat] || "CEDEARs",
      ccy: "ARS",
      seed: hashSeed(t),
      base: h.price || h.avgCost || 100,
    };
  });
const ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];

const CHART_RANGES = [
  { label: "1S", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1A", days: 365 },
];

// Cronograma de pagos de renta fija — en la app real sale del prospecto/emisor
// o de una fuente pública tipo BYMA/ArgentinaDatos, por instrumento.
// Calendario de eventos corporativos — en la app real sale de la agenda de la
// bolsa (BYMA/CNV) o del propio emisor, por empresa.
const CORPORATE_EVENTS = {
  GGAL: [
    { fecha: "2026-08-27", tipo: "Presenta balance", detalle: "Resultados 2º trimestre 2026" },
    { fecha: "2026-11-14", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026" },
  ],
  YPFD: [
    { fecha: "2026-09-05", tipo: "Presenta balance", detalle: "Resultados 2º trimestre 2026" },
    { fecha: "2026-09-30", tipo: "Reparte dividendos", detalle: "Pago en efectivo, fecha de corte 15/09" },
  ],
  AAPL: [
    { fecha: "2026-08-20", tipo: "Presenta balance", detalle: "Earnings Q3 fiscal 2026" },
    { fecha: "2026-09-12", tipo: "Reparte dividendos", detalle: "Dividendo trimestral" },
  ],
  TSLA: [
    { fecha: "2026-09-02", tipo: "Presenta balance", detalle: "Earnings Q2 2026" },
  ],
};

const COUPON_SCHEDULE = {
  AL30: [
    { fecha: "2026-09-09", tipo: "Cupón", monto: 0.5 },
    { fecha: "2027-01-09", tipo: "Amortización + Cupón", monto: 4.5 },
    { fecha: "2027-07-09", tipo: "Cupón", monto: 0.5 },
    { fecha: "2028-01-09", tipo: "Amortización + Cupón", monto: 4.5 },
  ],
};

const RANGE_PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "Este mes", month: true },
  { label: "YTD", ytd: true },
  { label: "Todo", days: 420 },
];

const FX_RATES = {
  oficial: { label: "Oficial", value: 1050 },
  mep: { label: "MEP", value: 1245 },
  blue: { label: "Blue", value: 1280 },
};

// --- Cotizaciones en vivo -------------------------------------------------
// fetch() del navegador no tiene timeout por defecto: si el servidor no
// responde (bloqueado por firewall/antivirus/red corporativa, o caído), la
// promesa queda colgada para siempre en vez de fallar. Por eso todo fetch acá
// se corta a los 8s con AbortController.
async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// --- Datos cacheados por el workflow diario -------------------------------
// En vez de pedirle en vivo a data912/CoinGecko/DolarAPI desde el navegador de
// cada visitante (lo que terminó bloqueando el sitio por exceso de pedidos),
// un GitHub Action corre una vez al día, pide todo con calma, y guarda el
// resultado acá mismo en el repo. La app solo lee estos archivos estáticos.
const dataUrl = (name) => `${import.meta.env.BASE_URL}data/${name}`;

async function fetchFxRates() {
  const res = await fetchWithTimeout(dataUrl("fx.json"));
  if (!res.ok) throw new Error("fx cache fetch failed");
  const data = await res.json();
  return data.fx || {};
}

async function fetchLivePrices() {
  const res = await fetchWithTimeout(dataUrl("live.json"));
  if (!res.ok) throw new Error("live cache fetch failed");
  const data = await res.json();
  return { prices: data.prices || {}, catalog: data.catalog || [] };
}

async function fetchHistoryCache() {
  const res = await fetchWithTimeout(dataUrl("history.json"));
  if (!res.ok) return { history: {}, coverage: null };
  const data = await res.json();
  return { history: data.history || {}, coverage: data.coverage || null };
}

const COINGECKO_IDS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether" };

// Los bonos en ley extranjera (AL/GD) cotizan "cada 100 de nominal" y en dólares
// (ej: 84,59 = US$0,8459 por unidad), mientras que nuestro costo de compra (avgCost)
// está guardado en pesos por unidad. Confirmado con datos reales del usuario
// (Balanz: GD38 a u$s0,8466/unidad; data912: "GD38" sin sufijo = ARS 1293,60,
// cada 100 nominal) -- ya está en pesos, solo falta dividir por 100.
function liveAdjustedPrice(holding, livePrices, fx) {
  const raw = livePrices[holding.name];
  if (raw == null) return holding.price; // sin dato en caché, se mantiene el estimado
  if (holding.cat === "Bonos") return raw / 100;
  return raw;
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

// --- Reconstrucción de histórico real de la cartera --------------------
// Cruza tus movimientos reales (sabemos cuánto tenías de cada activo en cada
// fecha) con el histórico de precio real de cada uno (ya cacheado en
// history.json). Los activos sin histórico real disponible (ej: fondos como
// CONIOLA) aportan su valor actual "plano" hacia atrás -- no es ideal, pero es
// mejor que inventar una caminata aleatoria, y queda claramente marcado.

function buildQtyTimeline(ticker, broker) {
  const trades = MOVIMIENTOS.filter(
    (m) => m.activo === ticker && (broker == null || m.broker === broker) && (m.tipo === "Compra" || m.tipo === "Venta")
  )
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return (date) => {
    let q = 0;
    for (const t of trades) {
      if (t.fecha > date) break;
      q += (t.tipo === "Compra" ? 1 : -1) * t.cantidad;
    }
    return q;
  };
}

// Capital invertido real, día por día: para cada tenencia (ticker+broker,
// respetando el filtro de cartera activo), cuánto tenías comprado a esa fecha
// multiplicado por tu costo promedio real. A diferencia del valor de mercado,
// esto no es una estimación -- sale directo de tus movimientos reales.
function buildInvestedSeries(holdings, dates) {
  const perHolding = holdings.map((h) => ({ qtyAt: buildQtyTimeline(h.name, h.broker), avgCost: h.avgCost }));
  return dates.map((date) => ({
    date,
    invertido: perHolding.reduce((s, h) => s + h.qtyAt(date) * h.avgCost, 0),
  }));
}

function priceAt(historyMap, sortedDates, date) {
  if (historyMap[date] != null) return historyMap[date];
  let lo = 0, hi = sortedDates.length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= date) { ans = sortedDates[mid]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans ? historyMap[ans] : null;
}

// Ahora es sincrónica y sin red -- historyCache ya viene descargado (un solo
// archivo, una sola vez) así que cruzar todo es instantáneo.
function buildRealPortfolioHistory(holdings, historyCache) {
  const uniqueTickers = [...new Map(holdings.map((h) => [h.name, h])).values()];
  const days = 365;
  const today = new Date();
  const dates = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  let tickersWithRealData = 0;
  const perTicker = uniqueTickers.map((h) => {
    const qtyAt = buildQtyTimeline(h.name);
    const hist = historyCache[h.name];
    if (hist && hist.length > 1) {
      tickersWithRealData++;
      const historyMap = {};
      for (const p of hist) historyMap[p.date] = p.price;
      const sortedDates = Object.keys(historyMap).sort();
      return { valueAt: (date) => qtyAt(date) * (priceAt(historyMap, sortedDates, date) ?? h.price) };
    }
    return { valueAt: (date) => qtyAt(date) * h.price };
  });

  const points = dates.map((date) => ({ date, total: perTicker.reduce((s, t) => s + t.valueAt(date), 0) }));
  return { points, coverage: { tickersWithRealData, tickersTotal: uniqueTickers.length } };
}

const BROKERS = [
  { name: "Balanz", status: "conectado", tipo: "Import manual (Excel)" },
  { name: "IOL", status: "conectado", tipo: "API" },
  { name: "Bull Market", status: "sin conectar", tipo: "Import manual (Excel)" },
  { name: "Binance", status: "conectado", tipo: "API (solo lectura)" },
  { name: "Buenbit", status: "sin conectar", tipo: "API (solo lectura)" },
];

function fmt(n, currency, fxRate) {
  if (currency === "USD") {
    const usd = n / fxRate;
    return "US$" + usd.toLocaleString("en-US", { maximumFractionDigits: usd >= 1000 ? 0 : 2 });
  }
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function pct(a, b) {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// Suma la misma acción/activo cuando está repartida en más de una plataforma,
// para mostrar el monto total consolidado en vez de una fila por broker.
function consolidateByName(holdings) {
  const map = new Map();
  for (const h of holdings) {
    if (!map.has(h.name)) {
      map.set(h.name, { name: h.name, cat: h.cat, qty: 0, costSum: 0, price: h.price });
    }
    const e = map.get(h.name);
    e.qty += h.qty;
    e.costSum += h.qty * h.avgCost;
  }
  return [...map.values()].map((e) => ({ ...e, avgCost: e.costSum / e.qty }));
}

function closestPoint(dateStr) {
  if (!dateStr) return null;
  const exact = SERIES.find((p) => p.date === dateStr);
  if (exact) return exact;
  return [...SERIES].reverse().find((p) => p.date <= dateStr) || SERIES[0];
}

const NAV = [
  { key: "inicio", label: "Inicio", icon: Home },
  { key: "buscar", label: "Buscar activo", icon: Search },
  { key: "importar", label: "Importar archivos", icon: Upload },
  { key: "pnl", label: "P&L de fecha específica", icon: CalendarRange },
  { key: "movimientos", label: "Movimientos", icon: History },
  { key: "manual", label: "Activos manuales", icon: PlusCircle },
  { key: "config", label: "Configuración", icon: Settings },
];

const DARK = {
  bg: "#10161C",
  surface: "#182029",
  border: "#26313C",
  text: "#EFEAE0",
  muted: "#8B95A1",
  faint: "#5C6773",
  gold: "#C89B3C",
  gain: "#4FA184",
  loss: "#C1584A",
  rowLine: "#1C2B25",
  chipActive: "#2A2416",
  scrollbar: "#2A3D34",
};

const LIGHT = {
  bg: "#F5F1E8",
  surface: "#FFFFFF",
  border: "#E1D9C8",
  text: "#1E2620",
  muted: "#6B6255",
  faint: "#9A9280",
  gold: "#A87C1F",
  gain: "#2F7A5C",
  loss: "#B23F32",
  rowLine: "#EEE7D8",
  chipActive: "#F1E4C0",
  scrollbar: "#E1D9C8",
};

export default function InvestmentDashboard() {
  const [view, setView] = useState("inicio");
  const [jumpSymbol, setJumpSymbol] = useState(null);
  const goToAsset = (symbol) => { setJumpSymbol(symbol); setView("buscar"); };
  const [hoverDot, setHoverDot] = useState(null); // { x, y, text } en píxeles del gráfico
  const [collapsed, setCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const C = themeMode === "dark" ? DARK : LIGHT;

  const [rangeIdx, setRangeIdx] = useState(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [catFilter, setCatFilter] = useState("Todas");
  const [brokerFilter, setBrokerFilter] = useState([]); // [] = todas las carteras
  const [currency, setCurrency] = useState("USD");
  const [fxType, setFxType] = useState("mep");

  const [liveFxRates, setLiveFxRates] = useState(null); // null hasta que carguen
  const [livePrices, setLivePrices] = useState({});
  const [liveCatalog, setLiveCatalog] = useState([]);
  const [historyCache, setHistoryCache] = useState({});
  const [historyCoverage, setHistoryCoverage] = useState(null);
  const [liveStatus, setLiveStatus] = useState("cargando"); // cargando | ok | error

  // Todo sale de public/data/*.json, generados una vez al día por un GitHub
  // Action (ver .github/workflows/update-prices.yml) -- la app nunca le pega
  // en vivo a data912/CoinGecko/DolarAPI, así que no hay límites de pedidos
  // ni bloqueos por CORS que temer.
  React.useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchFxRates(), fetchLivePrices(), fetchHistoryCache()])
      .then(([fxRes, pxRes, histRes]) => {
        if (cancelled) return;
        if (fxRes.status === "fulfilled" && Object.keys(fxRes.value).length > 0) {
          setLiveFxRates(fxRes.value);
        }
        if (pxRes.status === "fulfilled" && pxRes.value.prices && Object.keys(pxRes.value.prices).length > 0) {
          setLivePrices(pxRes.value.prices);
          setLiveCatalog(pxRes.value.catalog || []);
        }
        if (histRes.status === "fulfilled") {
          setHistoryCache(histRes.value.history || {});
        }
        const gotFx = fxRes.status === "fulfilled" && Object.keys(fxRes.value || {}).length > 0;
        setLiveStatus(gotFx ? "ok" : "error");
      })
      .catch(() => {
        // red de seguridad: cualquier error no previsto no debe dejar el estado
        // colgado en "cargando" para siempre.
        if (!cancelled) setLiveStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  // Cruzar movimientos reales + histórico cacheado es sincrónico e instantáneo
  // (no hay red de por medio acá), así que se recalcula solo con useMemo.
  const { points: realHistoryPoints, coverage: realHistoryCoverage } = useMemo(
    () => buildRealPortfolioHistory(HOLDINGS, historyCache),
    [historyCache]
  );
  React.useEffect(() => { setHistoryCoverage(realHistoryCoverage); }, [realHistoryCoverage]);
  const realPortfolioHistory = Object.keys(historyCache).length > 0 ? realHistoryPoints : null;

  const activeFxRates = { ...FX_RATES, ...(liveFxRates || {}) };
  const fx = activeFxRates[fxType].value;
  const f = (n) => fmt(n, currency, fx);
  const priceFor = (h) => livePrices[h.name] ?? h.price;

  const holdingsLive = useMemo(() => HOLDINGS.map((h) => ({ ...h, price: liveAdjustedPrice(h, livePrices, fx) })), [livePrices, fx]);

  const byBroker = brokerFilter.length === 0 ? holdingsLive : holdingsLive.filter((h) => brokerFilter.includes(h.broker));
  const filteredHoldings = catFilter === "Todas" ? byBroker : byBroker.filter((h) => h.cat === catFilter);

  // Valor real de la cartera filtrada, calculado directo de las tenencias con precio
  // en vivo -- esta es la fuente de verdad. El histórico (SERIES) sigue siendo una
  // caminata simulada porque no tenemos valuaciones diarias reales, pero se reescala
  // para que su último punto coincida exactamente con este valor real, y respeta el
  // filtro de broker seleccionado.
  const realCurrentTotal = byBroker.reduce((s, h) => s + h.qty * h.price, 0);
  const baseSeries = realPortfolioHistory && realPortfolioHistory.length > 1 ? realPortfolioHistory : SERIES;
  const seriesLastFull = baseSeries[baseSeries.length - 1].total;
  const scale = seriesLastFull > 0 ? realCurrentTotal / seriesLastFull : 1;
  const scaledSeries = useMemo(() => baseSeries.map((p) => ({ ...p, total: p.total * scale })), [scale, baseSeries]);

  const { from, to } = useMemo(() => {
    if (useCustom && customFrom && customTo) return { from: customFrom, to: customTo };
    const preset = RANGE_PRESETS[rangeIdx];
    const last = SERIES[SERIES.length - 1];
    const lastDate = new Date(last.date);
    let fromDate;
    if (preset.month) fromDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
    else if (preset.ytd) fromDate = new Date(lastDate.getFullYear(), 0, 1);
    else {
      fromDate = new Date(lastDate);
      fromDate.setDate(fromDate.getDate() - preset.days);
    }
    return { from: fromDate.toISOString().slice(0, 10), to: last.date };
  }, [rangeIdx, useCustom, customFrom, customTo]);

  const rangeStartPoint = scaledSeries.find((p) => p.date >= from) || scaledSeries[0];
  const rangeEndPoint = [...scaledSeries].reverse().find((p) => p.date <= to) || scaledSeries[scaledSeries.length - 1];
  const pnlAbs = rangeEndPoint.total - rangeStartPoint.total;
  const pnlPct = pct(rangeEndPoint.total, rangeStartPoint.total);
  const chartDataRaw = scaledSeries.filter((p) => p.date >= rangeStartPoint.date && p.date <= rangeEndPoint.date);
  const investedSeries = useMemo(
    () => buildInvestedSeries(byBroker, chartDataRaw.map((p) => p.date)),
    [byBroker, chartDataRaw.length ? chartDataRaw[0].date : null, chartDataRaw.length ? chartDataRaw[chartDataRaw.length - 1].date : null]
  );
  const chartData = chartDataRaw.map((p, i) => ({ ...p, invertido: investedSeries[i]?.invertido ?? null }));
  const chartTrades = MOVIMIENTOS.filter(
    (m) =>
      (m.tipo === "Compra" || m.tipo === "Venta") &&
      (brokerFilter.length === 0 || brokerFilter.includes(m.broker)) &&
      m.fecha >= chartData[0]?.date &&
      m.fecha <= chartData[chartData.length - 1]?.date
  ).map((m) => {
    const point = chartData.find((p) => p.date === m.fecha) || [...chartData].reverse().find((p) => p.date <= m.fecha);
    return { ...m, y: point ? point.total : null };
  }).filter((m) => m.y != null);

  const current = scaledSeries[scaledSeries.length - 1];
  const yesterday = scaledSeries[scaledSeries.length - 2];

  const currentTotal = realCurrentTotal;
  const yesterdayTotal = yesterday.total;
  const dayAbs = currentTotal - yesterdayTotal;
  const dayPct = pct(currentTotal, yesterdayTotal);

  const toggleBroker = (b) => {
    setBrokerFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.bg, color: C.text, minHeight: "100%", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .tabular { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .display { font-family: 'Fraunces', serif; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.scrollbar}; border-radius: 4px; }
        @media (max-width: 640px) {
          .comp-grid { grid-template-columns: 1fr !important; }
          .sidebar-expanded { width: 168px !important; }
        }
      `}</style>

      {/* -------- Sidebar -------- */}
      <div
        className={!collapsed ? "sidebar-expanded" : ""}
        style={{
          width: collapsed ? 60 : 200,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "16px 10px",
          transition: "width 0.15s ease",
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ alignSelf: collapsed ? "center" : "flex-end", background: "none", border: "none", color: C.faint, cursor: "pointer", padding: 6, marginBottom: 12 }}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                title={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  background: active ? C.rowLine : "transparent",
                  color: active ? C.gold : C.muted,
                  borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* -------- Contenido -------- */}
      <div style={{ flex: 1, padding: "24px 20px 48px", minWidth: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {view === "inicio" && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div className="display" style={{ fontSize: 13, letterSpacing: "0.08em", color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>
                    Cartera personal
                  </div>
                  <div className="display tabular" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1 }}>
                    {f(currentTotal)}
                  </div>
                  <div className="tabular" style={{ fontSize: 13, marginTop: 6, color: dayAbs >= 0 ? C.gain : C.loss }}>
                    {dayAbs >= 0 ? "+" : ""}{f(dayAbs)} ({dayPct >= 0 ? "+" : ""}{dayPct.toFixed(1)}%) vs. ayer
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: liveStatus === "ok" ? C.gain : C.faint, marginTop: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: liveStatus === "ok" ? C.gain : C.faint, display: "inline-block" }} />
                    {liveStatus === "ok"
                      ? `Dólar en vivo · ${Object.keys(livePrices).length > 0 ? `${Object.keys(livePrices).length} activos con precio en vivo` : "precios de mercado sin conectar todavía"}`
                      : liveStatus === "cargando"
                      ? "Conectando cotizaciones…"
                      : "Estimado — sin conexión a las fuentes de cotización"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      onClick={() => setBrokerFilter([])}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: `1px solid ${C.border}`,
                        background: brokerFilter.length === 0 ? C.gold : "transparent",
                        color: brokerFilter.length === 0 ? C.bg : C.muted,
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Todas las carteras
                    </button>
                    {BROKER_LIST.map((b) => {
                      const active = brokerFilter.includes(b);
                      return (
                        <button
                          key={b}
                          onClick={() => toggleBroker(b)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            border: `1px solid ${active ? C.gold : C.border}`,
                            background: active ? C.chipActive : "transparent",
                            color: active ? C.gold : C.muted,
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
                      title={themeMode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer" }}
                    >
                      {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                    <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 999, overflow: "hidden" }}>
                      {["USD", "ARS"].map((c) => (
                        <button key={c} onClick={() => setCurrency(c)} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: currency === c ? C.gold : "transparent", color: currency === c ? C.bg : C.muted }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  {currency === "USD" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {Object.entries(activeFxRates).map(([key, r]) => (
                        <button key={key} onClick={() => setFxType(key)} title={`1 USD ${r.label} = ${fmt(r.value, "ARS")}`} style={{ padding: "3px 9px", fontSize: 11, borderRadius: 999, border: `1px solid ${C.border}`, cursor: "pointer", background: fxType === key ? C.border : "transparent", color: fxType === key ? C.text : C.faint }}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                      Resultado {useCustom ? `del ${from} al ${to}` : RANGE_PRESETS[rangeIdx].label.toLowerCase()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {pnlAbs >= 0 ? <TrendingUp size={22} color={C.gain} /> : <TrendingDown size={22} color={C.loss} />}
                      <span className="tabular" style={{ fontSize: 26, fontWeight: 600, color: pnlAbs >= 0 ? C.gain : C.loss }}>
                        {pnlAbs >= 0 ? "+" : ""}{f(pnlAbs)}
                      </span>
                      <span className="tabular" style={{ fontSize: 15, color: pnlAbs >= 0 ? C.gain : C.loss, opacity: 0.85 }}>
                        ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {RANGE_PRESETS.map((p, i) => (
                      <button key={p.label} onClick={() => { setRangeIdx(i); setUseCustom(false); }} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${C.border}`, background: !useCustom && rangeIdx === i ? C.gold : "transparent", color: !useCustom && rangeIdx === i ? C.bg : C.muted, cursor: "pointer", fontWeight: 500 }}>
                        {p.label}
                      </button>
                    ))}
                    <button onClick={() => setUseCustom(true)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${C.border}`, background: useCustom ? C.gold : "transparent", color: useCustom ? C.bg : C.muted, cursor: "pointer", fontWeight: 500 }}>
                      Personalizado
                    </button>
                  </div>
                </div>

                {useCustom && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
                      Desde
                      <input type="date" value={customFrom} min={SERIES[0].date} max={SERIES[SERIES.length - 1].date} onChange={(e) => setCustomFrom(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "5px 8px" }} />
                    </label>
                    <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
                      Hasta
                      <input type="date" value={customTo} min={SERIES[0].date} max={SERIES[SERIES.length - 1].date} onChange={(e) => setCustomTo(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "5px 8px" }} />
                    </label>
                  </div>
                )}

                <div style={{ height: 190, marginTop: 4, position: "relative" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={C.rowLine} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: C.faint, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={40} />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} formatter={(v, name) => [f(v), name]} />
                      <Area type="monotone" dataKey="total" name="Valor actual" stroke={C.gold} strokeWidth={2} fill="url(#fillTotal)" />
                      <Line type="monotone" dataKey="invertido" name="Invertido" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                      {chartTrades.map((t, i) => {
                        const text = `${t.activo}: ${t.tipo === "Compra" ? "↑" : "↓"} ${f(t.cantidad * t.precio)}`;
                        return (
                          <ReferenceDot
                            key={i}
                            x={t.fecha}
                            y={t.y}
                            r={4}
                            fill={t.tipo === "Compra" ? C.gain : C.loss}
                            stroke={C.bg}
                            strokeWidth={1.5}
                            isFront
                            shape={(props) => (
                              <g
                                style={{ cursor: "pointer" }}
                                onMouseEnter={() => setHoverDot({ x: props.cx, y: props.cy, text })}
                                onMouseLeave={() => setHoverDot(null)}
                              >
                                {/* hitbox invisible más grande, más fácil de acertar con el mouse */}
                                <circle cx={props.cx} cy={props.cy} r={10} fill="transparent" />
                                <circle cx={props.cx} cy={props.cy} r={4} fill={t.tipo === "Compra" ? C.gain : C.loss} stroke={C.bg} strokeWidth={1.5} />
                              </g>
                            )}
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                  {hoverDot && (
                    <div
                      style={{
                        position: "absolute",
                        left: hoverDot.x,
                        top: hoverDot.y - 10,
                        transform: "translate(-50%, -100%)",
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        color: C.text,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        zIndex: 10,
                      }}
                      className="tabular"
                    >
                      {hoverDot.text}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted, marginTop: 4, paddingBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 14, height: 0, borderTop: `1.5px dashed ${C.muted}`, display: "inline-block" }} />
                    Invertido
                  </span>
                  {chartTrades.length > 0 && (
                    <>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: C.gain, display: "inline-block" }} />
                        Compra
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: C.loss, display: "inline-block" }} />
                        Venta
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 10, color: realPortfolioHistory ? C.gain : C.faint, paddingBottom: 4 }}>
                  {realPortfolioHistory
                    ? `Histórico real: ${historyCoverage?.tickersWithRealData ?? 0} de ${historyCoverage?.tickersTotal ?? 0} activos con precio real por fecha (actualizado una vez al día; el resto usa su precio actual hacia atrás).`
                    : "Cargando histórico cacheado…"}
                </div>
              </div>

              <div className="comp-grid" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 12, marginTop: 20, alignItems: "stretch" }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 18px 14px", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Composición</span>
                  <div style={{ position: "relative", height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={CATS.map((c) => ({ name: c.key, value: byBroker.filter((h) => h.cat === c.key).reduce((s, h) => s + h.qty * h.price, 0) }))}
                          dataKey="value" nameKey="name" innerRadius={50} outerRadius={68} paddingAngle={3} stroke="none"
                          onClick={(d) => setCatFilter(catFilter === d.name ? "Todas" : d.name)} cursor="pointer"
                        >
                          {CATS.map((c) => <Cell key={c.key} fill={c.color} opacity={catFilter === "Todas" || catFilter === c.key ? 1 : 0.25} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text }} formatter={(v) => f(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
                      <div className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>{f(currentTotal)}</div>
                      <div style={{ fontSize: 10, color: C.faint }}>total</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {CATS.map((c) => {
                      const value = byBroker.filter((h) => h.cat === c.key).reduce((s, h) => s + h.qty * h.price, 0);
                      const share = (value / currentTotal) * 100;
                      return (
                        <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, display: "inline-block" }} />
                            {c.key}
                          </span>
                          <span className="tabular" style={{ color: C.text }}>{share.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {CATS.map((c) => {
                    const items = byBroker.filter((h) => h.cat === c.key);
                    const value = items.reduce((s, h) => s + h.qty * h.price, 0);
                    const cost = items.reduce((s, h) => s + h.qty * h.avgCost, 0);
                    const p = pct(value, cost);
                    const Icon = c.icon;
                    return (
                      <button key={c.key} onClick={() => setCatFilter(catFilter === c.key ? "Todas" : c.key)} style={{ textAlign: "left", background: C.surface, border: catFilter === c.key ? `1px solid ${c.color}` : `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <Icon size={16} color={c.color} />
                          <span style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.key}</span>
                        </div>
                        <div className="tabular" style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{f(value)}</div>
                        <div className="tabular" style={{ fontSize: 12, color: p >= 0 ? C.gain : C.loss }}>{p >= 0 ? "+" : ""}{p.toFixed(1)}% desde costo</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
                  <span className="display" style={{ fontSize: 15, fontWeight: 600 }}>Tenencias {catFilter !== "Todas" ? `· ${catFilter}` : ""}</span>
                  {catFilter !== "Todas" && <button onClick={() => setCatFilter("Todas")} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>ver todas ×</button>}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: C.faint, textAlign: "left" }}>
                        <th style={{ padding: "10px 18px", fontWeight: 500 }}>Activo</th>
                        <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>Valor actual</th>
                        <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>Cantidad</th>
                        <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>Precio</th>
                        <th style={{ padding: "10px 18px", fontWeight: 500, textAlign: "right" }}>P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidateByName(filteredHoldings)
                        .sort((a, b) => b.qty * b.price - a.qty * a.price)
                        .map((h) => {
                          const value = h.qty * h.price;
                          const cost = h.qty * h.avgCost;
                          const p = pct(value, cost);
                          const enVivo = livePrices[h.name] != null;
                          return (
                            <tr
                              key={h.name}
                              onClick={() => goToAsset(h.name)}
                              style={{ borderTop: `1px solid ${C.rowLine}`, cursor: "pointer" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = C.rowLine)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "10px 18px", fontWeight: 500 }}>{h.name}</td>
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>{f(value)}</td>
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: C.muted }}>{h.qty}</td>
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  {enVivo && <span style={{ width: 5, height: 5, borderRadius: 999, background: C.gain, display: "inline-block" }} />}
                                  {f(h.price)}
                                </span>
                              </td>
                              <td className="tabular" style={{ padding: "10px 18px", textAlign: "right", color: p >= 0 ? C.gain : C.loss }}>{p >= 0 ? "+" : ""}{p.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {view === "importar" && <ImportarView C={C} />}
          {view === "buscar" && <BuscarView key={jumpSymbol || "default"} currency={currency} fx={fx} f={f} C={C} livePrices={livePrices} liveCatalog={liveCatalog} historyCache={historyCache} initialSymbol={jumpSymbol} />}
          {view === "pnl" && <PnlFechaView currency={currency} fx={fx} f={f} C={C} />}
          {view === "movimientos" && <MovimientosView f={f} C={C} />}
          {view === "manual" && <ManualView f={f} C={C} />}
          {view === "config" && <ConfigView currency={currency} setCurrency={setCurrency} fxType={fxType} setFxType={setFxType} C={C} fxRates={activeFxRates} liveStatus={liveStatus} livePrices={livePrices} />}
        </div>
      </div>
    </div>
  );
}

function BuscarView({ fx, f, C, livePrices, liveCatalog, historyCache, initialSymbol }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => ASSET_UNIVERSE_FULL.find((a) => a.symbol === initialSymbol) || ASSET_UNIVERSE_FULL[0]);
  const [rangeIdx, setRangeIdx] = useState(1);
  const [tick, setTick] = useState(0);
  const [posExpanded, setPosExpanded] = useState(false);
  const [hoverDot, setHoverDot] = useState(null);

  // Simula actualización en vivo: cada 3s "late" el último precio un poco.
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // Universo completo: catálogo base + tus tenencias + todo lo que devuelva data912
  // en vivo (así "Nike", "Coca-Cola", etc. aparecen aunque no los tengas en cartera).
  const fullCatalog = useMemo(() => {
    const known = new Set(ASSET_UNIVERSE_FULL.map((a) => a.symbol));
    const fromLive = (liveCatalog || [])
      .filter((c) => !known.has(c.symbol))
      .map((c) => ({ symbol: c.symbol, name: SYMBOL_NAMES[c.symbol] || c.symbol, cat: c.cat, ccy: "ARS", seed: hashSeed(c.symbol), base: livePrices[c.symbol] || 100 }));
    return [...ASSET_UNIVERSE_FULL, ...fromLive];
  }, [liveCatalog]);

  const results =
    query.trim() === ""
      ? []
      : fullCatalog.filter(
          (a) => a.symbol.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 30);

  const series = useMemo(() => genPriceSeries(selected.seed, selected.base, 400, selected.cat === "Cripto" ? 0.035 : 0.016), [selected]);
  const liveJitter = useMemo(() => {
    const r = seededRandom(selected.seed + tick);
    return 1 + (r() - 0.5) * 0.004;
  }, [selected, tick]);

  const days = CHART_RANGES[rangeIdx].days;

  // Histórico real cacheado (sin red, instantáneo) -- si no está disponible
  // para este símbolo, se cae al simulado y se avisa en el pie del gráfico.
  const cachedHistory = historyCache[selected.symbol];
  const historyStatus = cachedHistory && cachedHistory.length > 1 ? "ok" : "no-disponible";
  const sliced = historyStatus === "ok" ? cachedHistory.slice(-days) : series.slice(-days);
  const first = sliced[0].price;
  const lastRaw = sliced[sliced.length - 1].price;

  // Precio real cacheado (actualizado una vez al día). La cripto ya viene
  // convertida a pesos desde el archivo cacheado, igual que el resto.
  const liveRaw = livePrices[selected.symbol];
  const realLivePrice = liveRaw != null ? (selected.cat === "Bonos" ? liveRaw / 100 : liveRaw) : null;

  const isLive = realLivePrice != null;
  const last = isLive ? realLivePrice : historyStatus === "ok" ? lastRaw : lastRaw * liveJitter;
  const abs = last - first;
  const p = pct(last, first);

  const coupons = COUPON_SCHEDULE[selected.symbol] || [];
  const events = CORPORATE_EVENTS[selected.symbol] || [];
  const held = consolidateByName(HOLDINGS.filter((h) => h.name === selected.symbol))[0];
  if (held) held.price = liveAdjustedPrice(held, livePrices, fx);
  const heldQty = held?.qty || 0;
  const symbolTrades = MOVIMIENTOS.filter((m) => m.activo === selected.symbol && (m.tipo === "Compra" || m.tipo === "Venta")).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const today = SERIES[SERIES.length - 1].date;
  const daysUntil = (dateStr) => Math.round((new Date(dateStr) - new Date(today)) / 86400000);

  // Marcas de compra/venta sobre el gráfico, a partir de tus movimientos reales.
  const trades = MOVIMIENTOS.filter(
    (m) => m.activo === selected.symbol && (m.tipo === "Compra" || m.tipo === "Venta") && m.fecha >= sliced[0].date && m.fecha <= sliced[sliced.length - 1].date
  ).map((m) => {
    const point = series.find((p) => p.date === m.fecha) || [...series].reverse().find((p) => p.date <= m.fecha);
    return { ...m, y: point ? point.price : m.precio };
  });

  return (
    <div>
      <SectionTitle C={C} sub="Buscá cualquier activo de tu universo de inversión y seguí su precio.">Buscar activo</SectionTitle>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={15} color={C.faint} style={{ position: "absolute", left: 12, top: 10 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscá por ticker o nombre — ej: GGAL, Bitcoin, Apple..."
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 12px 9px 34px", fontSize: 13 }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {results.map((a) => (
          <button
            key={a.symbol}
            onClick={() => setSelected(a)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              border: `1px solid ${selected.symbol === a.symbol ? C.gold : C.border}`,
              background: selected.symbol === a.symbol ? C.chipActive : "transparent",
              color: selected.symbol === a.symbol ? C.gold : C.muted,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {a.symbol} <span style={{ opacity: 0.7 }}>· {a.cat}</span>
          </button>
        ))}
        {results.length === 0 && (
          <span style={{ fontSize: 13, color: C.faint }}>
            {query.trim() === "" ? "Escribí para buscar entre acciones, CEDEARs, bonos y más." : "No encontramos nada con ese nombre."}
          </span>
        )}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>{selected.symbol}</span>
              <span style={{ fontSize: 12, color: C.faint }}>{selected.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.gain, marginLeft: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: C.gain, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                en vivo
              </span>
            </div>
            <div className="tabular" style={{ fontSize: 28, fontWeight: 600 }}>{f(last)}</div>
            <div className="tabular" style={{ fontSize: 13, color: abs >= 0 ? C.gain : C.loss, marginTop: 2 }}>
              {abs >= 0 ? "+" : ""}{f(abs)} ({p >= 0 ? "+" : ""}{p.toFixed(2)}%) · {CHART_RANGES[rangeIdx].label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {CHART_RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                style={{
                  padding: "5px 11px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: `1px solid ${C.border}`,
                  background: rangeIdx === i ? C.gold : "transparent",
                  color: rangeIdx === i ? C.bg : C.muted,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 220, position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillAsset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={abs >= 0 ? C.gain : C.loss} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={abs >= 0 ? C.gain : C.loss} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.rowLine} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.faint, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={40} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} formatter={(v) => [f(v), "Precio"]} />
              <Area type="monotone" dataKey="price" stroke={abs >= 0 ? C.gain : C.loss} strokeWidth={2} fill="url(#fillAsset)" />
              {trades.map((t, i) => {
                const text = `${t.activo}: ${t.tipo === "Compra" ? "↑" : "↓"} ${f(t.cantidad * t.precio)}`;
                return (
                  <ReferenceDot
                    key={i}
                    x={t.fecha}
                    y={t.y}
                    r={5}
                    fill={t.tipo === "Compra" ? C.gain : C.loss}
                    stroke={C.bg}
                    strokeWidth={2}
                    isFront
                    shape={(props) => (
                      <g
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoverDot({ x: props.cx, y: props.cy, text })}
                        onMouseLeave={() => setHoverDot(null)}
                      >
                        <circle cx={props.cx} cy={props.cy} r={11} fill="transparent" />
                        <circle cx={props.cx} cy={props.cy} r={5} fill={t.tipo === "Compra" ? C.gain : C.loss} stroke={C.bg} strokeWidth={2} />
                      </g>
                    )}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
          {hoverDot && (
            <div
              className="tabular"
              style={{
                position: "absolute",
                left: hoverDot.x,
                top: hoverDot.y - 12,
                transform: "translate(-50%, -100%)",
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 11,
                color: C.text,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              {hoverDot.text}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: isLive ? C.gain : C.faint }}>
            {isLive ? "Precio real (actualizado una vez al día)." : "Precio simulado — no encontramos cotización cacheada para este símbolo todavía."}
          </div>
          {trades.length > 0 && (
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: C.gain, display: "inline-block" }} />
                Compra
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: C.loss, display: "inline-block" }} />
                Venta
              </span>
            </div>
          )}
        </div>
        {isLive && (
          <div style={{ fontSize: 10, color: historyStatus === "ok" ? C.gain : C.faint, marginTop: 4 }}>
            {historyStatus === "ok"
              ? "Histórico real (actualizado una vez al día)."
              : "No encontramos histórico real para este símbolo — el gráfico de arriba es simulado, aunque el precio actual sí es real."}
          </div>
        )}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 16, overflow: "hidden" }}>
        <div
          onClick={() => held && setPosExpanded(!posExpanded)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", cursor: held ? "pointer" : "default" }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Tu posición en {selected.symbol}</div>
          {held && (
            <ChevronDown size={16} color={C.faint} style={{ transform: posExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
          )}
        </div>
        <div style={{ padding: "0 20px 16px" }}>
        {!held ? (
          <div style={{ fontSize: 13, color: C.faint }}>No tenés {selected.symbol} en tu cartera todavía.</div>
        ) : (
          (() => {
            const valorAhora = held.qty * held.price;
            const costoTotal = held.qty * held.avgCost;
            const ganAbs = valorAhora - costoTotal;
            const ganPct = pct(valorAhora, costoTotal);
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Cantidad</div>
                  <div className="tabular" style={{ fontSize: 16, fontWeight: 600 }}>{held.qty}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>PPC</div>
                  <div className="tabular" style={{ fontSize: 16, fontWeight: 600 }}>{f(held.avgCost)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Plata ahora</div>
                  <div className="tabular" style={{ fontSize: 16, fontWeight: 600 }}>{f(valorAhora)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Ganancia</div>
                  <div className="tabular" style={{ fontSize: 16, fontWeight: 600, color: ganAbs >= 0 ? C.gain : C.loss }}>
                    {ganAbs >= 0 ? "+" : ""}{f(ganAbs)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>%</div>
                  <div className="tabular" style={{ fontSize: 16, fontWeight: 600, color: ganPct >= 0 ? C.gain : C.loss }}>
                    {ganPct >= 0 ? "+" : ""}{ganPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })()
        )}
        </div>

        {held && posExpanded && (
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {symbolTrades.length === 0 ? (
              <div style={{ padding: "14px 20px", fontSize: 13, color: C.faint }}>No hay operaciones individuales cargadas para este activo todavía.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.faint, textAlign: "left" }}>
                    <th style={{ padding: "8px 20px", fontWeight: 500 }}>Fecha</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Tipo</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Cantidad</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Precio</th>
                    <th style={{ padding: "8px 20px", fontWeight: 500 }}>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {symbolTrades.map((t, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.rowLine}` }}>
                      <td className="tabular" style={{ padding: "9px 20px", color: C.muted }}>{t.fecha}</td>
                      <td style={{ padding: "9px 12px", color: t.tipo === "Compra" ? C.gain : C.loss, fontWeight: 500 }}>{t.tipo}</td>
                      <td className="tabular" style={{ padding: "9px 12px", textAlign: "right" }}>{t.cantidad}</td>
                      <td className="tabular" style={{ padding: "9px 12px", textAlign: "right" }}>{f(t.precio)}</td>
                      <td style={{ padding: "9px 20px", color: C.muted }}>{t.broker}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {selected.cat === "Bonos" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Próximos pagos de {selected.symbol}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Cupones y amortizaciones programados para este instrumento.</div>
          </div>
          {coupons.length === 0 ? (
            <div style={{ padding: "16px 18px", fontSize: 13, color: C.faint }}>No tenemos el cronograma de pagos cargado para este instrumento todavía.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.faint, textAlign: "left" }}>
                  <th style={{ padding: "8px 18px", fontWeight: 500 }}>Fecha</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Tipo</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Por c/100 VN</th>
                  {heldQty > 0 && <th style={{ padding: "8px 18px", fontWeight: 500, textAlign: "right" }}>Te corresponde (aprox.)</th>}
                </tr>
              </thead>
              <tbody>
                {coupons.map((c, i) => {
                  const dLeft = daysUntil(c.fecha);
                  const estimado = (heldQty / 100) * c.monto * fx;
                  return (
                    <tr key={i} style={{ borderTop: `1px solid ${C.rowLine}` }}>
                      <td style={{ padding: "9px 18px" }}>
                        <span className="tabular">{c.fecha}</span>
                        {dLeft >= 0 && <span style={{ fontSize: 11, color: dLeft <= 30 ? C.gold : C.faint, marginLeft: 8 }}>en {dLeft}d</span>}
                      </td>
                      <td style={{ padding: "9px 12px", color: c.tipo.includes("Amortización") ? C.gold : C.muted }}>{c.tipo}</td>
                      <td className="tabular" style={{ padding: "9px 12px", textAlign: "right" }}>{c.monto.toFixed(2)}</td>
                      {heldQty > 0 && <td className="tabular" style={{ padding: "9px 18px", textAlign: "right", color: C.gain }}>{f(estimado)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(selected.cat === "Acciones AR" || selected.cat === "CEDEARs") && events.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Próximos eventos de {selected.symbol}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Balances, dividendos y otras fechas relevantes.</div>
          </div>
          <div>
            {events.map((ev, i) => {
              const dLeft = daysUntil(ev.fecha);
              const isDiv = ev.tipo.toLowerCase().includes("dividendo");
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i > 0 ? `1px solid ${C.rowLine}` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: isDiv ? C.gain : C.gold }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {ev.tipo}
                      <span style={{ color: C.faint, fontWeight: 400 }}> · {ev.detalle}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="tabular" style={{ fontSize: 13 }}>{ev.fecha}</div>
                    {dLeft >= 0 && <div style={{ fontSize: 11, color: dLeft <= 15 ? C.gold : C.faint }}>en {dLeft}d</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, sub, C }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ImportarView({ C }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <SectionTitle C={C} sub="Subí el estado de cuenta o histórico de movimientos exportado desde tu broker o exchange.">Importar archivos</SectionTitle>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
        style={{
          border: `2px dashed ${dragOver ? C.gold : C.border}`,
          borderRadius: 12,
          padding: "40px 20px",
          textAlign: "center",
          background: dragOver ? C.rowLine : C.surface,
          transition: "all 0.15s ease",
        }}
      >
        <FileSpreadsheet size={28} color={C.muted} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 14, marginBottom: 4 }}>Arrastrá el archivo acá, o hacé click para elegirlo</div>
        <div style={{ fontSize: 12, color: C.faint }}>.xlsx, .xls o .csv — máx. 10MB</div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Origen del archivo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Balanz", "IOL", "Bull Market", "Binance", "Buenbit", "Otro"].map((b) => (
            <span key={b} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, cursor: "pointer" }}>{b}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>Importaciones recientes</div>
        {[
          { nombre: "balanz_movimientos_julio.xlsx", fecha: "05 ago 2026", filas: 34 },
          { nombre: "iol_estado_cuenta.csv", fecha: "28 jul 2026", filas: 19 },
        ].map((row) => (
          <div key={row.nombre} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: `1px solid ${C.rowLine}`, fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={14} color={C.gain} />
              {row.nombre}
            </span>
            <span style={{ color: C.faint, fontSize: 12 }}>{row.filas} movimientos · {row.fecha}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PnlFechaView({ f, C }) {
  const [dateA, setDateA] = useState(SERIES[SERIES.length - 60].date);
  const [dateB, setDateB] = useState(SERIES[SERIES.length - 1].date);

  const pA = closestPoint(dateA);
  const pB = closestPoint(dateB);
  const abs = pB.total - pA.total;
  const p = pct(pB.total, pA.total);

  const rows = [
    { label: "Acciones y CEDEARs", key: "equities" },
    { label: "Bonos", key: "bonos" },
    { label: "Fondos", key: "fondos" },
  ];

  return (
    <div>
      <SectionTitle C={C} sub="Elegí dos fechas cualquiera y calculamos el resultado exacto entre esos dos momentos.">P&L de fecha específica</SectionTitle>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Desde
          <input type="date" value={dateA} min={SERIES[0].date} max={SERIES[SERIES.length - 1].date} onChange={(e) => setDateA(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }} />
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Hasta
          <input type="date" value={dateB} min={SERIES[0].date} max={SERIES[SERIES.length - 1].date} onChange={(e) => setDateB(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }} />
        </label>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "22px" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Resultado del período</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          {abs >= 0 ? <TrendingUp size={24} color={C.gain} /> : <TrendingDown size={24} color={C.loss} />}
          <span className="tabular" style={{ fontSize: 30, fontWeight: 600, color: abs >= 0 ? C.gain : C.loss }}>{abs >= 0 ? "+" : ""}{f(abs)}</span>
          <span className="tabular" style={{ fontSize: 16, color: abs >= 0 ? C.gain : C.loss, opacity: 0.85 }}>({p >= 0 ? "+" : ""}{p.toFixed(1)}%)</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12, color: C.faint, marginBottom: 6 }}>
          <span>Categoría</span><span style={{ textAlign: "right" }}>{dateA}</span><span style={{ textAlign: "right" }}>{dateB}</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.rowLine}` }}>
            <span>{r.label}</span>
            <span className="tabular" style={{ textAlign: "right", color: C.muted }}>{f(pA[r.key])}</span>
            <span className="tabular" style={{ textAlign: "right" }}>{f(pB[r.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovimientosView({ f, C }) {
  return (
    <div>
      <SectionTitle C={C} sub="Todas las compras, ventas y rentas registradas, en un solo lugar.">Movimientos</SectionTitle>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.faint, textAlign: "left" }}>
              <th style={{ padding: "10px 18px", fontWeight: 500 }}>Fecha</th>
              <th style={{ padding: "10px 12px", fontWeight: 500 }}>Activo</th>
              <th style={{ padding: "10px 12px", fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>Cantidad</th>
              <th style={{ padding: "10px 18px", fontWeight: 500 }}>Origen</th>
            </tr>
          </thead>
          <tbody>
            {MOVIMIENTOS.map((m, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.rowLine}` }}>
                <td className="tabular" style={{ padding: "10px 18px", color: C.muted }}>{m.fecha}</td>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{m.activo}</td>
                <td style={{ padding: "10px 12px", color: m.tipo === "Venta" ? C.loss : m.tipo === "Compra" ? C.gain : C.gold }}>{m.tipo}</td>
                <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>{m.cantidad}</td>
                <td style={{ padding: "10px 18px", color: C.muted }}>{m.broker}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManualView({ f, C }) {
  const manuales = HOLDINGS.filter((h) => h.manual);
  return (
    <div>
      <SectionTitle C={C} sub="Cosas que no salen de ningún broker: dólares, efectivo, plazos fijos.">Activos manuales</SectionTitle>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Nombre
            <input placeholder="Ej: USD billete" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }} />
          </label>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Monto
            <input type="number" placeholder="0" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }} />
          </label>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Categoría
            <select style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }}>
              <option>Efectivo</option><option>Acciones</option><option>Cripto</option>
            </select>
          </label>
          <button style={{ background: C.gold, color: C.bg, border: "none", borderRadius: 6, padding: "7px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Agregar</button>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {manuales.map((h) => (
          <div key={h.name} style={{ display: "flex", justifyContent: "space-between", padding: "12px 18px", borderTop: `1px solid ${C.rowLine}`, fontSize: 13 }}>
            <span>{h.name}</span>
            <span className="tabular">{f(h.qty * h.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigView({ currency, setCurrency, fxType, setFxType, C, fxRates, liveStatus, livePrices }) {
  return (
    <div>
      <SectionTitle C={C} sub="Moneda por defecto, fuente del tipo de cambio y qué cuentas están conectadas.">Configuración</SectionTitle>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Moneda por defecto</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["USD", "ARS"].map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `1px solid ${C.border}`, background: currency === c ? C.gold : "transparent", color: currency === c ? C.bg : C.muted, cursor: "pointer" }}>{c}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Fuente del tipo de cambio (dólar)</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(fxRates).map(([key, r]) => (
            <button key={key} onClick={() => setFxType(key)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `1px solid ${C.border}`, background: fxType === key ? C.border : "transparent", color: C.text, cursor: "pointer" }}>{r.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: liveStatus === "ok" ? C.gain : C.faint, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: liveStatus === "ok" ? C.gain : C.faint, display: "inline-block" }} />
          {liveStatus === "ok"
            ? "Dólar: desde la caché diaria (DolarAPI)."
            : liveStatus === "cargando"
            ? "Cargando caché…"
            : "Dólar: sin datos cacheados todavía, usando valores de referencia."}
        </div>
        <div style={{ fontSize: 11, color: Object.keys(livePrices).length > 0 ? C.gain : C.faint, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: Object.keys(livePrices).length > 0 ? C.gain : C.faint, display: "inline-block" }} />
          {Object.keys(livePrices).length > 0
            ? `Precios de mercado: ${Object.keys(livePrices).length} activos desde la caché diaria (data912).`
            : "Precios de mercado: sin datos cacheados todavía — usando estimados."}
        </div>
        <div style={{ fontSize: 10, color: C.faint, marginTop: 8 }}>
          Todo esto se actualiza una vez al día vía GitHub Actions, no en vivo desde tu navegador — así no se satura la fuente de datos gratuita.
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>Brokers y exchanges</div>
        {BROKERS.map((b) => (
          <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderTop: `1px solid ${C.rowLine}`, fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={13} color={b.status === "conectado" ? C.gain : C.faint} />
              {b.name}
              <span style={{ fontSize: 11, color: C.faint }}>· {b.tipo}</span>
            </span>
            <span style={{ fontSize: 12, color: b.status === "conectado" ? C.gain : C.faint }}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
