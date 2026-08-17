import React, { useState, useMemo, useRef, useEffect } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
  ReferenceLine,
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
  Calculator,
  Bell,
  Mail,
  Lock,
  LogOut,
  Trash2,
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

let HOLDINGS = [
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
  { name: "CONIOLA", cat: "Fondos", qty: 3345.7227, avgCost: 130.07, price: 183.29, broker: "IOL", manual: false },
  { name: "CONIOLA", cat: "Fondos", qty: 1676.82, avgCost: 112.05, price: 152.26, broker: "Bull Market", manual: false },
  { name: "NVDA", cat: "CEDEARs", qty: 52.0, avgCost: 5707.7115, price: 9771.57, broker: "IOL", manual: false },
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
  { name: "YPFD", cat: "Acciones", qty: 20.0, avgCost: 1950.0, price: 23527.5, broker: "IOL", manual: false },
  { name: "TGSU2", cat: "Acciones", qty: 8.0, avgCost: 5953.06, price: 6871.08, broker: "IOL", manual: false },
  { name: "PAMP", cat: "Acciones", qty: 4.0, avgCost: 2439.5, price: 2823.31, broker: "IOL", manual: false },
  { name: "PYPL", cat: "CEDEARs", qty: 2.0, avgCost: 10012.78, price: 12187.66, broker: "IOL", manual: false },
  { name: "SPY", cat: "CEDEARs", qty: 27.0, avgCost: 11432.0, price: 37515.14, broker: "IOL", manual: false },
  { name: "GD38", cat: "Bonos", qty: 118.0, avgCost: 848.2, price: 896.0, broker: "IOL", manual: false },
  { name: "GD41", cat: "Bonos", qty: 133.0, avgCost: 747.09, price: 864.27, broker: "IOL", manual: false },
  { name: "AAPL", cat: "CEDEARs", qty: 4.0, avgCost: 15554.07, price: 14604.18, broker: "IOL", manual: false },
  { name: "BBAR", cat: "Acciones", qty: 27.0, avgCost: 4473.58, price: 4775.19, broker: "IOL", manual: false },
  { name: "SUPV", cat: "Acciones", qty: 15.0, avgCost: 1625.33, price: 1725.69, broker: "IOL", manual: false },
  { name: "AL30", cat: "Bonos", qty: 101.0, avgCost: 751.05, price: 763.42, broker: "IOL", manual: false },
  { name: "HMY", cat: "CEDEARs", qty: 4.0, avgCost: 9442.81, price: 9759.89, broker: "IOL", manual: false },
  { name: "IBM", cat: "CEDEARs", qty: 3.0, avgCost: 36151.95, price: 43217.13, broker: "IOL", manual: false },
  { name: "T", cat: "CEDEARs", qty: 1.0, avgCost: 5937.38, price: 6924.59, broker: "IOL", manual: false },
  { name: "TSLA", cat: "CEDEARs", qty: 1.0, avgCost: 15909.88, price: 19297.89, broker: "IOL", manual: false },
  { name: "DIA", cat: "CEDEARs", qty: 1.0, avgCost: 17814.14, price: 16781.81, broker: "IOL", manual: false },
  { name: "AMD", cat: "CEDEARs", qty: 1.0, avgCost: 20392.11, price: 20774.05, broker: "IOL", manual: false },
  { name: "LOMA", cat: "Acciones", qty: 40.0, avgCost: 2590.55, price: 2977.76, broker: "IOL", manual: false },
  { name: "AAPL", cat: "CEDEARs", qty: 0.393527, avgCost: 329250.5978, price: 329250.5978, broker: "Nexo", manual: false },
  { name: "AVAX", cat: "Cripto", qty: 4.85770256, avgCost: 38290.322988, price: 38290.322988, broker: "Nexo", manual: false },
  { name: "BNB", cat: "Cripto", qty: 0.39021382, avgCost: 883867.977818, price: 883867.977818, broker: "Nexo", manual: false },
  { name: "BTC", cat: "Cripto", qty: 0.07212047, avgCost: 82507106.673558, price: 82507106.673558, broker: "Nexo", manual: false },
  { name: "DOGE", cat: "Cripto", qty: 271.89774259, avgCost: 416.035084, price: 416.035084, broker: "Nexo", manual: false },
  { name: "DOT", cat: "Cripto", qty: 38.66604277, avgCost: 5920.883451, price: 5920.883451, broker: "Nexo", manual: false },
  { name: "ETH", cat: "Cripto", qty: 0.10999919, avgCost: 3653206.628769, price: 3653206.628769, broker: "Nexo", manual: false },
  { name: "GGAL", cat: "Acciones", qty: 2.529191, avgCost: 57330.5852, price: 57330.5852, broker: "Nexo", manual: false },
  { name: "LINK", cat: "Cripto", qty: 5.39068771, avgCost: 19828.45339, price: 19828.45339, broker: "Nexo", manual: false },
  { name: "LOMA", cat: "CEDEARs", qty: 5.337977, avgCost: 15902.6888, price: 15902.6888, broker: "Nexo", manual: false },
  { name: "MELI", cat: "CEDEARs", qty: 0.119748, avgCost: 3130987.5138, price: 3130987.5138, broker: "Nexo", manual: false },
  { name: "MSFT", cat: "CEDEARs", qty: 0.136891, avgCost: 553237.7074, price: 553237.7074, broker: "Nexo", manual: false },
  { name: "NEXO", cat: "Cripto", qty: 1408.1530209, avgCost: 1287.171129, price: 1287.171129, broker: "Nexo", manual: false },
  { name: "PAM", cat: "CEDEARs", qty: 0.503029, avgCost: 103805.1484, price: 103805.1484, broker: "Nexo", manual: false },
  { name: "POL", cat: "Cripto", qty: 577.04928319, avgCost: 523.973946, price: 523.973946, broker: "Nexo", manual: false },
  { name: "RENDER", cat: "Cripto", qty: 23.68130544, avgCost: 9290.366216, price: 9290.366216, broker: "Nexo", manual: false },
  { name: "SOL", cat: "Cripto", qty: 1.33853572, avgCost: 168616.680622, price: 168616.680622, broker: "Nexo", manual: false },
  { name: "SPY", cat: "CEDEARs", qty: 0.60623199, avgCost: 976446.9688, price: 976446.9688, broker: "Nexo", manual: false },
  { name: "USDT", cat: "Cripto", qty: 651.775679, avgCost: 230.14053, price: 230.14053, broker: "Nexo", manual: false },
  { name: "BNB", cat: "Cripto", qty: 0.24841999, avgCost: 725440.627447, price: 725440.627447, broker: "Bybit", manual: false },
  { name: "BTC", cat: "Cripto", qty: 0.01524745, avgCost: 109043011.108317, price: 109043011.108317, broker: "Bybit", manual: false },
  { name: "ETH", cat: "Cripto", qty: 0.1639624, avgCost: 3846804.202701, price: 3846804.202701, broker: "Bybit", manual: false },
  { name: "LINK", cat: "Cripto", qty: 2.02650597, avgCost: 26539.522112, price: 26539.522112, broker: "Bybit", manual: false },
  { name: "RENDER", cat: "Cripto", qty: 5.46407218, avgCost: 9842.933663, price: 9842.933663, broker: "Bybit", manual: false },
  { name: "ADCGLOA", cat: "Fondos", qty: 22.109, avgCost: 2043.90, price: 2053.34, broker: "IOL", manual: false },
  { name: "IOLDOLD", cat: "Fondos", qty: 17.4688, avgCost: 1655.83, price: 1658.29, broker: "IOL", manual: false },
  { name: "PRPEDOB", cat: "Fondos", qty: 46.1664, avgCost: 2338.11, price: 2749.90, broker: "IOL", manual: false },
  { name: "PLC2O", cat: "Bonos", qty: 298.0, avgCost: 1531.52, price: 1622.19, broker: "IOL", manual: false },
];

let MOVIMIENTOS = [
  { fecha: "2026-08-08", activo: "BNB", tipo: "Compra", cantidad: 0.24216698, precio: 943475.035284, broker: "Nexo" },
  { fecha: "2026-08-08", activo: "BTC", tipo: "Compra", cantidad: 0.00153958, precio: 103924446.927084, broker: "Nexo" },
  { fecha: "2026-08-07", activo: "YPFD", tipo: "Compra", cantidad: 20.0, precio: 7867.009, broker: "Balanz" },
  { fecha: "2026-08-04", activo: "YPFD", tipo: "Split", cantidad: 18.0, precio: 0, broker: "Balanz" },
  { fecha: "2026-08-04", activo: "YPFD", tipo: "Split", cantidad: 18.0, precio: 0, broker: "IOL" },
  { fecha: "2026-08-03", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 76430.28, broker: "Balanz" },
  { fecha: "2026-08-01", activo: "BNB", tipo: "Split", cantidad: 0.00146229, precio: 0, broker: "Nexo" },
  { fecha: "2026-08-01", activo: "BTC", tipo: "Split", cantidad: 0.00008054, precio: 0, broker: "Nexo" },
  { fecha: "2026-08-01", activo: "ETH", tipo: "Split", cantidad: 0.00013431, precio: 0, broker: "Nexo" },
  { fecha: "2026-08-01", activo: "NEXO", tipo: "Split", cantidad: 1.59673436, precio: 0, broker: "Nexo" },
  { fecha: "2026-08-01", activo: "SOL", tipo: "Split", cantidad: 0.00250253, precio: 0, broker: "Nexo" },
  { fecha: "2026-08-01", activo: "USDT", tipo: "Split", cantidad: 3.293011, precio: 0, broker: "Nexo" },
  { fecha: "2026-07-29", activo: "CEPU", tipo: "Compra", cantidad: 43.0, precio: 2313.293, broker: "Balanz" },
  { fecha: "2026-07-23", activo: "TSM", tipo: "Compra", cantidad: 2.0, precio: 73812.975, broker: "Balanz" },
  { fecha: "2026-07-18", activo: "NEXO", tipo: "Compra", cantidad: 133.36427879, precio: 1141.160147, broker: "Nexo" },
  { fecha: "2026-07-13", activo: "YPFD", tipo: "Compra", cantidad: 1.0, precio: 77411.77, broker: "Balanz" },
  { fecha: "2026-07-13", activo: "BABA", tipo: "Compra", cantidad: 4.0, precio: 19821.0375, broker: "Balanz" },
  { fecha: "2026-07-13", activo: "AL30", tipo: "Compra", cantidad: 34.0, precio: 857.4, broker: "IOL" },
  { fecha: "2026-07-13", activo: "AL30", tipo: "Venta", cantidad: 34.0, precio: 698.694, broker: "IOL" },

  { fecha: "2026-07-13", activo: "ADCGLOA", tipo: "Compra", cantidad: 11.0, precio: 2051.304, broker: "IOL" },
  { fecha: "2026-07-13", activo: "IOLDOLD", tipo: "Compra", cantidad: 17.0, precio: 1655.826, broker: "IOL" },
  { fecha: "2026-07-10", activo: "BTC", tipo: "Compra", cantidad: 0.0015543, precio: 102960721.868365, broker: "Nexo" },
  { fecha: "2026-07-06", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 80406.57, broker: "Balanz" },
  { fecha: "2026-07-06", activo: "GOOGL", tipo: "Compra", cantidad: 8.0, precio: 9905.4862, broker: "Balanz" },
  { fecha: "2026-07-01", activo: "BTC", tipo: "Split", cantidad: 0.00016483, precio: 0, broker: "Nexo" },
  { fecha: "2026-07-01", activo: "ETH", tipo: "Split", cantidad: 0.00029536, precio: 0, broker: "Nexo" },
  { fecha: "2026-07-01", activo: "NEXO", tipo: "Split", cantidad: 3.66785294, precio: 0, broker: "Nexo" },
  { fecha: "2026-07-01", activo: "SOL", tipo: "Split", cantidad: 0.00285431, precio: 0, broker: "Nexo" },
  { fecha: "2026-07-01", activo: "USDT", tipo: "Split", cantidad: 53.066874, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-30", activo: "MSFT", tipo: "Compra", cantidad: 4.0, precio: 19398.24, broker: "Balanz" },
  { fecha: "2026-06-30", activo: "BTC", tipo: "Compra", cantidad: 0.00171821, precio: 93120165.753895, broker: "Nexo" },
  { fecha: "2026-06-29", activo: "GOOGL", tipo: "Compra", cantidad: 14.0, precio: 7732.3215, broker: "Balanz" },
  { fecha: "2026-06-26", activo: "ADBE", tipo: "Venta", cantidad: 20.0, precio: 5732.6, broker: "Balanz" },
  { fecha: "2026-06-24", activo: "BTC", tipo: "Compra", cantidad: 0.01638268, precio: 92072847.66595, broker: "Nexo" },
  { fecha: "2026-06-24", activo: "NEXO", tipo: "Compra", cantidad: 94.01376792, precio: 1123.112097, broker: "Nexo" },
  { fecha: "2026-06-17", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 73208.99, broker: "Balanz" },
  { fecha: "2026-06-10", activo: "YPFD", tipo: "Compra", cantidad: 1.0, precio: 83552.37, broker: "Balanz" },
  { fecha: "2026-06-09", activo: "BTC", tipo: "Compra", cantidad: 0.00159489, precio: 97195079.284465, broker: "Nexo" },
  { fecha: "2026-06-04", activo: "BTC", tipo: "Compra", cantidad: 0.00381894, precio: 95582805.700011, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "GOOGL", tipo: "Compra", cantidad: 5.0, precio: 9704.154, broker: "Balanz" },
  { fecha: "2026-06-01", activo: "SPY", tipo: "Split", cantidad: 8.0, precio: 0, broker: "Balanz" },
  { fecha: "2026-06-01", activo: "SPY", tipo: "Split", cantidad: 32.0, precio: 0, broker: "Bull Market" },
  { fecha: "2026-06-01", activo: "BTC", tipo: "Split", cantidad: 0.0002327, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "ETH", tipo: "Split", cantidad: 0.00028502, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "NEXO", tipo: "Split", cantidad: 3.13500124, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "SOL", tipo: "Split", cantidad: 0.00265298, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "USDT", tipo: "Split", cantidad: 44.973828, precio: 0, broker: "Nexo" },
  { fecha: "2026-06-01", activo: "SPY", tipo: "Split", cantidad: 18.0, precio: 0, broker: "IOL" },
  { fecha: "2026-05-28", activo: "NEXO", tipo: "Compra", cantidad: 60.48977702, precio: 1183.76201, broker: "Nexo" },
  { fecha: "2026-05-22", activo: "TSM", tipo: "Compra", cantidad: 1.0, precio: 67596.89, broker: "Balanz" },
  { fecha: "2026-05-18", activo: "PFE", tipo: "Compra", cantidad: 10.0, precio: 9452.491, broker: "Balanz" },
  { fecha: "2026-05-11", activo: "MELI", tipo: "Compra", cantidad: 7.0, precio: 19599.5729, broker: "Balanz" },
  { fecha: "2026-05-07", activo: "BTC", tipo: "Compra", cantidad: 0.00124866, precio: 120128778.05007, broker: "Nexo" },
  { fecha: "2026-05-04", activo: "ADCGLOA", tipo: "Compra", cantidad: 10.0, precio: 2035.302, broker: "IOL" },
  { fecha: "2026-05-01", activo: "BTC", tipo: "Split", cantidad: 0.00010687, precio: 0, broker: "Nexo" },
  { fecha: "2026-05-01", activo: "ETH", tipo: "Split", cantidad: 0.00029378, precio: 0, broker: "Nexo" },
  { fecha: "2026-05-01", activo: "NEXO", tipo: "Split", cantidad: 2.95589888, precio: 0, broker: "Nexo" },
  { fecha: "2026-05-01", activo: "SOL", tipo: "Split", cantidad: 0.00548459, precio: 0, broker: "Nexo" },
  { fecha: "2026-05-01", activo: "USDT", tipo: "Split", cantidad: 2.846465, precio: 0, broker: "Nexo" },
  { fecha: "2026-04-30", activo: "MSFT", tipo: "Compra", cantidad: 5.0, precio: 20102.9, broker: "Balanz" },
  { fecha: "2026-04-26", activo: "USDT", tipo: "Compra", cantidad: 99.882458, precio: 1501.765205, broker: "Nexo" },
  { fecha: "2026-04-06", activo: "MELI", tipo: "Compra", cantidad: 0.02372095, precio: 3130987.5138, broker: "Nexo" },
  { fecha: "2026-04-06", activo: "MSFT", tipo: "Compra", cantidad: 0.136891, precio: 553237.7074, broker: "Nexo" },
  { fecha: "2026-04-01", activo: "BTC", tipo: "Split", cantidad: 0.00009876, precio: 0, broker: "Nexo" },
  { fecha: "2026-04-01", activo: "ETH", tipo: "Split", cantidad: 0.00029571, precio: 0, broker: "Nexo" },
  { fecha: "2026-04-01", activo: "NEXO", tipo: "Split", cantidad: 2.69328134, precio: 0, broker: "Nexo" },
  { fecha: "2026-04-01", activo: "SOL", tipo: "Split", cantidad: 0.00530283, precio: 0, broker: "Nexo" },
  { fecha: "2026-04-01", activo: "USDT", tipo: "Split", cantidad: 53.869542, precio: 0, broker: "Nexo" },
  { fecha: "2026-03-26", activo: "BTC", tipo: "Compra", cantidad: 0.001441414161, precio: 97215639.884365, broker: "Bybit" },
  { fecha: "2026-03-11", activo: "SPY", tipo: "Compra", cantidad: 0.07418324, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2026-03-01", activo: "BTC", tipo: "Split", cantidad: 0.00009409, precio: 0, broker: "Nexo" },
  { fecha: "2026-03-01", activo: "ETH", tipo: "Split", cantidad: 0.0002922, precio: 0, broker: "Nexo" },
  { fecha: "2026-03-01", activo: "NEXO", tipo: "Split", cantidad: 2.41836502, precio: 0, broker: "Nexo" },
  { fecha: "2026-03-01", activo: "SOL", tipo: "Split", cantidad: 0.0047544, precio: 0, broker: "Nexo" },
  { fecha: "2026-03-01", activo: "USDT", tipo: "Split", cantidad: 42.983855, precio: 0, broker: "Nexo" },
  { fecha: "2026-02-05", activo: "MELI", tipo: "Compra", cantidad: 3.0, precio: 25891.1667, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "META", tipo: "Compra", cantidad: 2.0, precio: 42702.305, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 51440.07, broker: "Balanz" },
  { fecha: "2026-02-05", activo: "NEXO", tipo: "Compra", cantidad: 132.47003549, precio: 1102.739948, broker: "Nexo" },
  { fecha: "2026-02-01", activo: "BTC", tipo: "Split", cantidad: 0.00008699, precio: 0, broker: "Nexo" },
  { fecha: "2026-02-01", activo: "NEXO", tipo: "Split", cantidad: 2.33333483, precio: 0, broker: "Nexo" },
  { fecha: "2026-01-29", activo: "MSFT", tipo: "Compra", cantidad: 4.0, precio: 22720.2025, broker: "Balanz" },
  { fecha: "2026-01-29", activo: "SPY", tipo: "Compra", cantidad: 0.07636769, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2026-01-29", activo: "MELI", tipo: "Compra", cantidad: 0.02383242, precio: 3130987.5138, broker: "Nexo" },
  { fecha: "2026-01-29", activo: "AAPL", tipo: "Compra", cantidad: 0.22648099, precio: 329250.5978, broker: "Nexo" },
  { fecha: "2026-01-29", activo: "BTC", tipo: "Compra", cantidad: 0.000562141206, precio: 129760991.048929, broker: "Bybit" },
  { fecha: "2026-01-26", activo: "NEXO", tipo: "Compra", cantidad: 65.53040408, precio: 1344.960423, broker: "Nexo" },
  { fecha: "2026-01-22", activo: "ADBE", tipo: "Compra", cantidad: 20.0, precio: 10328.2805, broker: "Balanz" },
  { fecha: "2026-01-15", activo: "BTC", tipo: "Compra", cantidad: 0.00051622, precio: 142751106.456191, broker: "Bybit" },
  { fecha: "2026-01-13", activo: "VIST", tipo: "Compra", cantidad: 3.0, precio: 25428.1067, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "MELI", tipo: "Compra", cantidad: 6.0, precio: 26475.0267, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "CEPU", tipo: "Compra", cantidad: 39.0, precio: 2549.3538, broker: "Balanz" },
  { fecha: "2026-01-13", activo: "GGAL", tipo: "Compra", cantidad: 2.0, precio: 8204.24, broker: "Balanz" },
  { fecha: "2026-01-12", activo: "SPY", tipo: "Compra", cantidad: 0.07783321, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2026-01-12", activo: "MELI", tipo: "Compra", cantidad: 0.02428127, precio: 3130987.5138, broker: "Nexo" },
  { fecha: "2026-01-12", activo: "PRPEDOB", tipo: "Compra", cantidad: 9.0, precio: 2564.5872, broker: "IOL" },
  { fecha: "2026-01-01", activo: "BTC", tipo: "Split", cantidad: 0.00011555, precio: 0, broker: "Nexo" },
  { fecha: "2026-01-01", activo: "NEXO", tipo: "Split", cantidad: 2.45778141, precio: 0, broker: "Nexo" },
  { fecha: "2026-01-01", activo: "USDT", tipo: "Split", cantidad: 53.913553, precio: 0, broker: "Nexo" },
  { fecha: "2025-12-05", activo: "BTC", tipo: "Compra", cantidad: 0.001104259266, precio: 133532046.811912, broker: "Bybit" },
  { fecha: "2025-12-04", activo: "MELI", tipo: "Compra", cantidad: 0.0239541, precio: 3130987.5138, broker: "Nexo" },
  { fecha: "2025-12-04", activo: "SPY", tipo: "Compra", cantidad: 0.07681427, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-12-01", activo: "BTC", tipo: "Split", cantidad: 0.00011631, precio: 0, broker: "Nexo" },
  { fecha: "2025-12-01", activo: "NEXO", tipo: "Split", cantidad: 2.26166448, precio: 0, broker: "Nexo" },
  { fecha: "2025-12-01", activo: "USDT", tipo: "Split", cantidad: 7.392687, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-07", activo: "GGAL", tipo: "Compra", cantidad: 1.27331685, precio: 57330.5852, broker: "Nexo" },
  { fecha: "2025-11-07", activo: "SPY", tipo: "Compra", cantidad: 0.03738042, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-11-07", activo: "LOMA", tipo: "Compra", cantidad: 2.29572416, precio: 15902.6888, broker: "Nexo" },
  { fecha: "2025-11-05", activo: "MU", tipo: "Compra", cantidad: 1.0, precio: 71321.5, broker: "Balanz" },
  { fecha: "2025-11-01", activo: "AVAX", tipo: "Split", cantidad: 0.015559, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "BNB", tipo: "Split", cantidad: 0.0004694, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "BTC", tipo: "Split", cantidad: 0.0001308, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "DOGE", tipo: "Split", cantidad: 0.17783544, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "DOT", tipo: "Split", cantidad: 0.28705863, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "ETH", tipo: "Split", cantidad: 0.00034582, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "LINK", tipo: "Split", cantidad: 0.01388398, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "NEXO", tipo: "Split", cantidad: 2.75336268, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "POL", tipo: "Split", cantidad: 1.12045795, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "SOL", tipo: "Split", cantidad: 0.00421175, precio: 0, broker: "Nexo" },
  { fecha: "2025-11-01", activo: "USDT", tipo: "Split", cantidad: 69.796603, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-31", activo: "NEXO", tipo: "Compra", cantidad: 43.60583314, precio: 1694.108212, broker: "Nexo" },
  { fecha: "2025-10-30", activo: "META", tipo: "Compra", cantidad: 3.0, precio: 41816.45, broker: "Balanz" },
  { fecha: "2025-10-28", activo: "PRPEDOB", tipo: "Compra", cantidad: 11.0, precio: 2424.5316, broker: "IOL" },
  { fecha: "2025-10-10", activo: "BTC", tipo: "Compra", cantidad: 0.00169548, precio: 173992884.73, broker: "Nexo" },
  { fecha: "2025-10-08", activo: "AMZN", tipo: "Compra", cantidad: 31.0, precio: 2442.1452, broker: "Balanz" },
  { fecha: "2025-10-08", activo: "SPY", tipo: "Compra", cantidad: 0.07783321, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-10-08", activo: "MELI", tipo: "Compra", cantidad: 0.02395926, precio: 3130987.5138, broker: "Nexo" },
  { fecha: "2025-10-08", activo: "ETH", tipo: "Compra", cantidad: 0.010983768543, precio: 6955490.704389, broker: "Bybit" },
  { fecha: "2025-10-08", activo: "BTC", tipo: "Compra", cantidad: 0.0004016725515, precio: 190198458.208564, broker: "Bybit" },
  { fecha: "2025-10-01", activo: "AVAX", tipo: "Split", cantidad: 0.01964402, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "BNB", tipo: "Split", cantidad: 0.00059837, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "BTC", tipo: "Split", cantidad: 0.00013647, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "DOGE", tipo: "Split", cantidad: 0.21845762, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "DOT", tipo: "Split", cantidad: 0.36483007, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "ETH", tipo: "Split", cantidad: 0.00044083, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "LINK", tipo: "Split", cantidad: 0.01766831, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "NEXO", tipo: "Split", cantidad: 2.94666957, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "POL", tipo: "Split", cantidad: 1.39797043, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "SOL", tipo: "Split", cantidad: 0.00536903, precio: 0, broker: "Nexo" },
  { fecha: "2025-10-01", activo: "USDT", tipo: "Split", cantidad: 5.673032, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-15", activo: "NEXO", tipo: "Compra", cantidad: 76.44058259, precio: 1946.68846, broker: "Nexo" },
  { fecha: "2025-09-12", activo: "GGAL", tipo: "Compra", cantidad: 1.25587415, precio: 57330.5852, broker: "Nexo" },
  { fecha: "2025-09-12", activo: "SPY", tipo: "Compra", cantidad: 0.07375154, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-09-12", activo: "ETH", tipo: "Compra", cantidad: 0.010876927858690905, precio: 6750411.070469, broker: "Bybit" },
  { fecha: "2025-09-12", activo: "BTC", tipo: "Compra", cantidad: 0.00042924, precio: 171051638.662782, broker: "Bybit" },
  { fecha: "2025-09-01", activo: "AVAX", tipo: "Split", cantidad: 0.01879632, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "BNB", tipo: "Split", cantidad: 0.00057466, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "BTC", tipo: "Split", cantidad: 0.00013107, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "DOGE", tipo: "Split", cantidad: 0.20719773, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "DOT", tipo: "Split", cantidad: 0.3487439, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "ETH", tipo: "Split", cantidad: 0.00042336, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "LINK", tipo: "Split", cantidad: 0.01696571, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "NEXO", tipo: "Split", cantidad: 2.80481774, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "POL", tipo: "Split", cantidad: 1.33284007, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "SOL", tipo: "Split", cantidad: 0.00515624, precio: 0, broker: "Nexo" },
  { fecha: "2025-09-01", activo: "USDT", tipo: "Split", cantidad: 21.625605, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-20", activo: "PRPEDOB", tipo: "Compra", cantidad: 12.0, precio: 2270.6076, broker: "IOL" },
  { fecha: "2025-08-13", activo: "NEXO", tipo: "Compra", cantidad: 71.50231885, precio: 1844.303823, broker: "Nexo" },
  { fecha: "2025-08-05", activo: "LOMA", tipo: "Compra", cantidad: 3.04225284, precio: 15902.6888, broker: "Nexo" },
  { fecha: "2025-08-05", activo: "PAM", tipo: "Compra", cantidad: 0.503029, precio: 103805.1484, broker: "Nexo" },
  { fecha: "2025-08-05", activo: "SPY", tipo: "Compra", cantidad: 0.03525319, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-08-05", activo: "ETH", tipo: "Compra", cantidad: 0.01380693, precio: 4868098.846014, broker: "Bybit" },
  { fecha: "2025-08-05", activo: "BTC", tipo: "Compra", cantidad: 0.0004361, precio: 154124054.116028, broker: "Bybit" },
  { fecha: "2025-08-01", activo: "AVAX", tipo: "Split", cantidad: 0.01986434, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "BNB", tipo: "Split", cantidad: 0.00059922, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "BTC", tipo: "Split", cantidad: 0.00013722, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "DOGE", tipo: "Split", cantidad: 0.22917241, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "DOT", tipo: "Split", cantidad: 0.36079687, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "ETH", tipo: "Split", cantidad: 0.00044147, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "LINK", tipo: "Split", cantidad: 0.01776539, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "NEXO", tipo: "Split", cantidad: 2.63570762, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "POL", tipo: "Split", cantidad: 1.43719181, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "SOL", tipo: "Split", cantidad: 0.00537669, precio: 0, broker: "Nexo" },
  { fecha: "2025-08-01", activo: "USDT", tipo: "Split", cantidad: 37.195423, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-11", activo: "BTC", tipo: "Venta", cantidad: 0.00860681, precio: 146719408.25, broker: "Nexo" },
  { fecha: "2025-07-11", activo: "NEXO", tipo: "Compra", cantidad: 22.69323002, precio: 1677.725029, broker: "Nexo" },
  { fecha: "2025-07-09", activo: "BTC", tipo: "Venta", cantidad: 0.00455367, precio: 137562215.87, broker: "Nexo" },
  { fecha: "2025-07-07", activo: "AAPL", tipo: "Compra", cantidad: 0.16704601, precio: 329250.5978, broker: "Nexo" },
  { fecha: "2025-07-07", activo: "SPY", tipo: "Compra", cantidad: 0.07681522, precio: 976446.9688, broker: "Nexo" },
  { fecha: "2025-07-07", activo: "ETH", tipo: "Compra", cantidad: 0.00973106, precio: 3279293.314397, broker: "Bybit" },
  { fecha: "2025-07-07", activo: "BTC", tipo: "Compra", cantidad: 0.00068516, precio: 139723568.217643, broker: "Bybit" },
  { fecha: "2025-07-01", activo: "AVAX", tipo: "Split", cantidad: 0.01978221, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "BNB", tipo: "Split", cantidad: 0.00059674, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "BTC", tipo: "Split", cantidad: 0.00015134, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "DOGE", tipo: "Split", cantidad: 0.22897881, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "DOT", tipo: "Split", cantidad: 0.35734079, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "ETH", tipo: "Split", cantidad: 0.00043965, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "LINK", tipo: "Split", cantidad: 0.01770632, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "NEXO", tipo: "Split", cantidad: 2.34799577, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "POL", tipo: "Split", cantidad: 1.43358828, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "SOL", tipo: "Split", cantidad: 0.00535446, precio: 0, broker: "Nexo" },
  { fecha: "2025-07-01", activo: "USDT", tipo: "Split", cantidad: 16.741861, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-10", activo: "AAPL", tipo: "Compra", cantidad: 5.0, precio: 12125.0, broker: "Bull Market" },
  { fecha: "2025-06-10", activo: "MELI", tipo: "Compra", cantidad: 1.0, precio: 23975.0, broker: "Bull Market" },
  { fecha: "2025-06-10", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 35950.0, broker: "Bull Market" },
  { fecha: "2025-06-10", activo: "ETH", tipo: "Compra", cantidad: 0.018013271364, precio: 3301565.762167, broker: "Bybit" },
  { fecha: "2025-06-10", activo: "BTC", tipo: "Compra", cantidad: 0.0004522731345, precio: 131495760.997937, broker: "Bybit" },
  { fecha: "2025-06-05", activo: "GGAL", tipo: "Compra", cantidad: 7.0, precio: 6515.4057, broker: "Balanz" },
  { fecha: "2025-06-05", activo: "BBAR", tipo: "Compra", cantidad: 6.0, precio: 7018.915, broker: "Balanz" },
  { fecha: "2025-06-05", activo: "BMA", tipo: "Compra", cantidad: 3.0, precio: 9103.4433, broker: "Balanz" },
  { fecha: "2025-06-01", activo: "AVAX", tipo: "Split", cantidad: 0.01894176, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "BNB", tipo: "Split", cantidad: 0.00057328, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "BTC", tipo: "Split", cantidad: 0.00017353, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "DOGE", tipo: "Split", cantidad: 0.21772874, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "DOT", tipo: "Split", cantidad: 0.34165475, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "ETH", tipo: "Split", cantidad: 0.00042234, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "LINK", tipo: "Split", cantidad: 0.01700923, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "NEXO", tipo: "Split", cantidad: 2.16288565, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "POL", tipo: "Split", cantidad: 1.36871341, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "SOL", tipo: "Split", cantidad: 0.00514386, precio: 0, broker: "Nexo" },
  { fecha: "2025-06-01", activo: "USDT", tipo: "Split", cantidad: 10.466349, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-29", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 18252.2, broker: "Balanz" },
  { fecha: "2025-05-29", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 35245.63, broker: "Balanz" },
  { fecha: "2025-05-07", activo: "AAPL", tipo: "Compra", cantidad: 7.0, precio: 11775.0, broker: "Bull Market" },
  { fecha: "2025-05-07", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 33250.0, broker: "Bull Market" },
  { fecha: "2025-05-07", activo: "ETH", tipo: "Compra", cantidad: 0.0271208282895, precio: 2131332.398221, broker: "Bybit" },
  { fecha: "2025-05-07", activo: "BTC", tipo: "Compra", cantidad: 0.000509361237, precio: 113482330.026617, broker: "Bybit" },
  { fecha: "2025-05-01", activo: "AVAX", tipo: "Split", cantidad: 0.01962208, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "BNB", tipo: "Split", cantidad: 0.00059191, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "BTC", tipo: "Split", cantidad: 0.00017946, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "DOGE", tipo: "Split", cantidad: 0.22860147, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "DOT", tipo: "Split", cantidad: 0.35064509, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "ETH", tipo: "Split", cantidad: 0.00043608, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "LINK", tipo: "Split", cantidad: 0.01759087, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "NEXO", tipo: "Split", cantidad: 2.22766907, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "POL", tipo: "Split", cantidad: 1.42656202, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "SOL", tipo: "Split", cantidad: 0.00531105, precio: 0, broker: "Nexo" },
  { fecha: "2025-05-01", activo: "USDT", tipo: "Split", cantidad: 16.592002, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-28", activo: "GD35", tipo: "Compra", cantidad: 62.0, precio: 811.8592, broker: "Balanz" },
  { fecha: "2025-04-23", activo: "NEXO", tipo: "Compra", cantidad: 14.96259352, precio: 1331.131051, broker: "Nexo" },
  { fecha: "2025-04-22", activo: "NEXO", tipo: "Compra", cantidad: 46.88279302, precio: 1212.567445, broker: "Nexo" },
  { fecha: "2025-04-07", activo: "AMD", tipo: "Compra", cantidad: 6.0, precio: 11475.0, broker: "Bull Market" },
  { fecha: "2025-04-07", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 34475.0, broker: "Bull Market" },
  { fecha: "2025-04-07", activo: "BTC", tipo: "Compra", cantidad: 0.00255129, precio: 107424087.422441, broker: "Bybit" },
  { fecha: "2025-04-01", activo: "AVAX", tipo: "Split", cantidad: 0.01792458, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "BNB", tipo: "Split", cantidad: 0.00055563, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "BTC", tipo: "Split", cantidad: 0.00016744, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "DOGE", tipo: "Split", cantidad: 0.19165449, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "DOT", tipo: "Split", cantidad: 0.32907421, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "ETH", tipo: "Split", cantidad: 0.00040936, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "LINK", tipo: "Split", cantidad: 0.01641261, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "NEXO", tipo: "Split", cantidad: 2.1553664, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "POL", tipo: "Split", cantidad: 1.25606235, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "SOL", tipo: "Split", cantidad: 0.00498554, precio: 0, broker: "Nexo" },
  { fecha: "2025-04-01", activo: "USDT", tipo: "Split", cantidad: 0.104293, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-31", activo: "NEXO", tipo: "Compra", cantidad: 18.08355498, precio: 1453.220898, broker: "Nexo" },
  { fecha: "2025-03-27", activo: "NEXO", tipo: "Compra", cantidad: 15.98945273, precio: 1616.428056, broker: "Nexo" },
  { fecha: "2025-03-18", activo: "BABA", tipo: "Compra", cantidad: 2.0, precio: 20500.0, broker: "Bull Market" },
  { fecha: "2025-03-18", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 35825.0, broker: "Bull Market" },
  { fecha: "2025-03-01", activo: "AVAX", tipo: "Split", cantidad: 0.01922099, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "BNB", tipo: "Split", cantidad: 0.00058348, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "BTC", tipo: "Split", cantidad: 0.0001769, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "DOGE", tipo: "Split", cantidad: 0.22090493, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "DOT", tipo: "Split", cantidad: 0.34238541, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "ETH", tipo: "Split", cantidad: 0.00042985, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "LINK", tipo: "Split", cantidad: 0.01733948, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "NEXO", tipo: "Split", cantidad: 2.02573895, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "POL", tipo: "Split", cantidad: 1.3896387, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "SOL", tipo: "Split", cantidad: 0.00523529, precio: 0, broker: "Nexo" },
  { fecha: "2025-03-01", activo: "USDT", tipo: "Split", cantidad: 0.347141, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-24", activo: "GGAL", tipo: "Compra", cantidad: 4.0, precio: 7321.02, broker: "Balanz" },
  { fecha: "2025-02-11", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 20492.82, broker: "Balanz" },
  { fecha: "2025-02-03", activo: "GGAL", tipo: "Compra", cantidad: 6.0, precio: 7810.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 18425.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 16350.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "AMZN", tipo: "Compra", cantidad: 20.0, precio: 1945.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "TGSU2", tipo: "Compra", cantidad: 6.0, precio: 6670.0, broker: "IOL" },
  { fecha: "2025-02-03", activo: "BABA", tipo: "Compra", cantidad: 2.0, precio: 13175.0, broker: "Bull Market" },
  { fecha: "2025-02-03", activo: "MELI", tipo: "Compra", cantidad: 5.0, precio: 18200.0, broker: "Bull Market" },
  { fecha: "2025-02-03", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 35550.0, broker: "Bull Market" },
  { fecha: "2025-02-02", activo: "BTC", tipo: "Compra", cantidad: 0.00400713, precio: 117672249.215773, broker: "Nexo" },
  { fecha: "2025-02-02", activo: "NEXO", tipo: "Compra", cantidad: 35.93646586, precio: 1640.144588, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "AVAX", tipo: "Split", cantidad: 0.01751464, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "BNB", tipo: "Split", cantidad: 0.00052828, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "BTC", tipo: "Split", cantidad: 0.00017929, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "DOGE", tipo: "Split", cantidad: 0.20599796, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "DOT", tipo: "Split", cantidad: 0.30801163, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "ETH", tipo: "Split", cantidad: 0.00038919, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "LINK", tipo: "Split", cantidad: 0.01573686, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "NEXO", tipo: "Split", cantidad: 1.87306331, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "POL", tipo: "Split", cantidad: 1.27944064, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "SOL", tipo: "Split", cantidad: 0.00474001, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "USDT", tipo: "Split", cantidad: 0.525164, precio: 0, broker: "Nexo" },
  { fecha: "2025-02-01", activo: "ETH", tipo: "Compra", cantidad: 0.00784664, precio: 3755811.404627, broker: "Bybit" },
  { fecha: "2025-02-01", activo: "BTC", tipo: "Compra", cantidad: 0.00073255, precio: 120690055.286329, broker: "Bybit" },
  { fecha: "2025-01-30", activo: "GGALX", tipo: "Venta", cantidad: 51.0, precio: 20.7, broker: "IOL" },
  { fecha: "2025-01-28", activo: "GGALX", tipo: "Venta", cantidad: 14.0, precio: 14.0, broker: "Bull Market" },
  { fecha: "2025-01-27", activo: "PLC2O", tipo: "Compra", cantidad: 298.0, precio: 1531.5177, broker: "IOL" },
  { fecha: "2025-01-21", activo: "GD38", tipo: "Compra", cantidad: 118.0, precio: 843.9, broker: "IOL" },
  { fecha: "2025-01-21", activo: "GD41", tipo: "Compra", cantidad: 133.0, precio: 743.3, broker: "IOL" },
  { fecha: "2025-01-09", activo: "BNB", tipo: "Compra", cantidad: 0.139812, precio: 832682.459302, broker: "Nexo" },
  { fecha: "2025-01-09", activo: "BTC", tipo: "Compra", cantidad: 0.00171054, precio: 110558744.107779, broker: "Nexo" },
  { fecha: "2025-01-09", activo: "DOT", tipo: "Compra", cantidad: 14.510659, precio: 8022.998818, broker: "Nexo" },
  { fecha: "2025-01-09", activo: "POL", tipo: "Compra", cantidad: 212.022296, precio: 549.088479, broker: "Nexo" },
  { fecha: "2025-01-09", activo: "NEXO", tipo: "Compra", cantidad: 39.90024938, precio: 1476.55381, broker: "Nexo" },
  { fecha: "2025-01-09", activo: "PRPEDOB", tipo: "Compra", cantidad: 7.0, precio: 2282.0376, broker: "IOL" },
  { fecha: "2025-01-07", activo: "GD38", tipo: "Compra", cantidad: 79.0, precio: 894.4723, broker: "Balanz" },
  { fecha: "2025-01-07", activo: "GD41", tipo: "Compra", cantidad: 86.0, precio: 791.9597, broker: "Balanz" },
  { fecha: "2025-01-07", activo: "GGAL", tipo: "Compra", cantidad: 7.0, precio: 8560.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "NVDA", tipo: "Compra", cantidad: 7.0, precio: 7590.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "MSFT", tipo: "Compra", cantidad: 3.0, precio: 17000.0, broker: "IOL" },
  { fecha: "2025-01-07", activo: "CONIOLA", tipo: "Compra", cantidad: 472.0, precio: 179.7581, broker: "IOL" },
  { fecha: "2025-01-06", activo: "AL30", tipo: "Venta", cantidad: 12.0, precio: 890.58, broker: "Bull Market" },
  { fecha: "2025-01-04", activo: "ETH", tipo: "Compra", cantidad: 0.01366347, precio: 4266412.55845, broker: "Bybit" },
  { fecha: "2025-01-04", activo: "BTC", tipo: "Compra", cantidad: 0.00050544, precio: 115333175.055397, broker: "Bybit" },
  { fecha: "2025-01-03", activo: "AL30", tipo: "Compra", cantidad: 12.0, precio: 887.1, broker: "Bull Market" },
  { fecha: "2025-01-03", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 18075.0, broker: "Bull Market" },
  { fecha: "2025-01-03", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 34800.0, broker: "Bull Market" },
  { fecha: "2025-01-01", activo: "AVAX", tipo: "Split", cantidad: 0.01931488, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "BNB", tipo: "Split", cantidad: 0.00110158, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "BTC", tipo: "Split", cantidad: 0.00017049, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "DOGE", tipo: "Split", cantidad: 0.22788583, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "DOT", tipo: "Split", cantidad: 0.36527054, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "ETH", tipo: "Split", cantidad: 0.00042919, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "LINK", tipo: "Split", cantidad: 0.01736775, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "NEXO", tipo: "Split", cantidad: 1.81844312, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "POL", tipo: "Split", cantidad: 2.30085034, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "SOL", tipo: "Split", cantidad: 0.00522721, precio: 0, broker: "Nexo" },
  { fecha: "2025-01-01", activo: "USDT", tipo: "Split", cantidad: 0.281364, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-19", activo: "AL30", tipo: "Venta", cantidad: 9.0, precio: 921.9225, broker: "IOL" },
  { fecha: "2024-12-19", activo: "RENDER", tipo: "Compra", cantidad: 12.465761, precio: 9074.375804, broker: "Nexo" },
  { fecha: "2024-12-19", activo: "DOGE", tipo: "Compra", cantidad: 268.114592, precio: 421.905422, broker: "Nexo" },
  { fecha: "2024-12-19", activo: "NEXO", tipo: "Compra", cantidad: 19.70665944, precio: 1585.792652, broker: "Nexo" },
  { fecha: "2024-12-18", activo: "LOMA", tipo: "Compra", cantidad: 20.0, precio: 3025.0, broker: "IOL" },
  { fecha: "2024-12-18", activo: "GGAL", tipo: "Compra", cantidad: 10.0, precio: 8190.0, broker: "IOL" },
  { fecha: "2024-12-18", activo: "AL30", tipo: "Compra", cantidad: 9.0, precio: 850.6, broker: "IOL" },
  { fecha: "2024-12-18", activo: "CONIOLA", tipo: "Compra", cantidad: 1273.0, precio: 157.0771, broker: "IOL" },
  { fecha: "2024-12-04", activo: "AMD", tipo: "Compra", cantidad: 2.0, precio: 15600.0, broker: "Bull Market" },
  { fecha: "2024-12-04", activo: "MELI", tipo: "Compra", cantidad: 3.0, precio: 18125.0, broker: "Bull Market" },
  { fecha: "2024-12-04", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 33350.0, broker: "Bull Market" },
  { fecha: "2024-12-03", activo: "RENDER", tipo: "Compra", cantidad: 5.46407218, precio: 9842.933663, broker: "Bybit" },
  { fecha: "2024-12-03", activo: "LINK", tipo: "Compra", cantidad: 2.02650597, precio: 26539.522112, broker: "Bybit" },
  { fecha: "2024-12-01", activo: "ETH", tipo: "Compra", cantidad: 0.026447, precio: 4041630.430673, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "AVAX", tipo: "Compra", cantidad: 2.196709, precio: 48658.69808, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "LINK", tipo: "Compra", cantidad: 5.16323, precio: 20701.963693, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "POL", tipo: "Compra", cantidad: 163.42593, precio: 654.051655, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "RENDER", tipo: "Compra", cantidad: 11.097727, precio: 9631.611951, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "AVAX", tipo: "Split", cantidad: 0.02962991, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "BTC", tipo: "Split", cantidad: 0.00015756, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "DOGE", tipo: "Split", cantidad: 1.42873516, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "DOT", tipo: "Split", cantidad: 0.19540736, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "ETH", tipo: "Split", cantidad: 0.00055442, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "LINK", tipo: "Split", cantidad: 0.0420112, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "NEXO", tipo: "Split", cantidad: 1.68104329, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "POL", tipo: "Split", cantidad: 1.66636264, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "RENDER", tipo: "Split", cantidad: 0.11781744, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "SOL", tipo: "Split", cantidad: 0.0052056, precio: 0, broker: "Nexo" },
  { fecha: "2024-12-01", activo: "USDT", tipo: "Split", cantidad: 0.610112, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-15", activo: "AL30", tipo: "Venta", cantidad: 320.0, precio: 861.789, broker: "IOL" },
  { fecha: "2024-11-14", activo: "AL30", tipo: "Compra", cantidad: 320.0, precio: 773.0, broker: "IOL" },
  { fecha: "2024-11-12", activo: "NEXO", tipo: "Compra", cantidad: 32.9209976, precio: 1366.179742, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "ETH", tipo: "Compra", cantidad: 0.0228865, precio: 3456797.675486, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "DOT", tipo: "Compra", cantidad: 15.7188332, precio: 5033.070775, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "SOL", tipo: "Compra", cantidad: 0.3504389, precio: 225756.900846, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "AVAX", tipo: "Compra", cantidad: 2.4066707, precio: 32872.798094, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "POL", tipo: "Compra", cantidad: 182.97840099, precio: 432.022521, broker: "Nexo" },
  { fecha: "2024-11-09", activo: "NEXO", tipo: "Compra", cantidad: 17.9769624, precio: 1257.387066, broker: "Nexo" },
  { fecha: "2024-11-08", activo: "AL30", tipo: "Venta", cantidad: 577.0, precio: 837.5115, broker: "IOL" },
  { fecha: "2024-11-07", activo: "AL30", tipo: "Compra", cantidad: 577.0, precio: 772.5, broker: "IOL" },
  { fecha: "2024-11-07", activo: "MELI", tipo: "Compra", cantidad: 4.0, precio: 17125.0, broker: "IOL" },
  { fecha: "2024-11-05", activo: "AL30", tipo: "Venta", cantidad: 47.0, precio: 808.752, broker: "IOL" },
  { fecha: "2024-11-04", activo: "AL30", tipo: "Compra", cantidad: 47.0, precio: 747.4, broker: "IOL" },
  { fecha: "2024-11-03", activo: "BTC", tipo: "Compra", cantidad: 0.02178, precio: 79307162.534435, broker: "Nexo" },
  { fecha: "2024-11-03", activo: "NEXO", tipo: "Compra", cantidad: 41.074298, precio: 1121.421479, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "AVAX", tipo: "Split", cantidad: 0.01850813, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "BTC", tipo: "Split", cantidad: 0.00025617, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "DOT", tipo: "Split", cantidad: 0.21696675, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "ETH", tipo: "Split", cantidad: 0.00038931, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "NEXO", tipo: "Split", cantidad: 1.77926508, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "POL", tipo: "Split", cantidad: 1.21297756, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "SOL", tipo: "Split", cantidad: 0.00629915, precio: 0, broker: "Nexo" },
  { fecha: "2024-11-01", activo: "USDT", tipo: "Split", cantidad: 41.561337, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-31", activo: "BABA", tipo: "Compra", cantidad: 4.0, precio: 12575.0, broker: "Bull Market" },
  { fecha: "2024-10-31", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 33050.0, broker: "Bull Market" },
  { fecha: "2024-10-31", activo: "ETH", tipo: "Compra", cantidad: 0.01858323, precio: 3044303.923484, broker: "Bybit" },
  { fecha: "2024-10-31", activo: "BTC", tipo: "Compra", cantidad: 0.00068262, precio: 82876270.838827, broker: "Bybit" },
  { fecha: "2024-10-30", activo: "AL30", tipo: "Venta", cantidad: 155.0, precio: 808.254, broker: "IOL" },
  { fecha: "2024-10-29", activo: "NVDA", tipo: "Compra", cantidad: 7.0, precio: 6820.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 28450.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "AMZN", tipo: "Compra", cantidad: 10.0, precio: 1540.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "LOMA", tipo: "Compra", cantidad: 20.0, precio: 2120.0, broker: "IOL" },
  { fecha: "2024-10-29", activo: "AL30", tipo: "Compra", cantidad: 155.0, precio: 742.8529, broker: "IOL" },
  { fecha: "2024-10-29", activo: "NEXO", tipo: "Compra", cantidad: 39.16647131, precio: 1148.446387, broker: "Nexo" },
  { fecha: "2024-10-17", activo: "AL30", tipo: "Venta", cantidad: 128.0, precio: 771.402, broker: "IOL" },
  { fecha: "2024-10-16", activo: "NVDA", tipo: "Compra", cantidad: 8.0, precio: 6630.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "MSFT", tipo: "Compra", cantidad: 2.0, precio: 16300.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 34350.0, broker: "IOL" },
  { fecha: "2024-10-16", activo: "AL30", tipo: "Compra", cantidad: 128.0, precio: 729.3, broker: "IOL" },
  { fecha: "2024-10-04", activo: "BABA", tipo: "Compra", cantidad: 4.0, precio: 15750.0, broker: "Bull Market" },
  { fecha: "2024-10-04", activo: "MELI", tipo: "Compra", cantidad: 3.0, precio: 19900.0, broker: "Bull Market" },
  { fecha: "2024-10-04", activo: "ETH", tipo: "Compra", cantidad: 0.02029581, precio: 2925529.949285, broker: "Bybit" },
  { fecha: "2024-10-04", activo: "BTC", tipo: "Compra", cantidad: 0.00079064, precio: 75098654.254781, broker: "Bybit" },
  { fecha: "2024-10-03", activo: "BTC", tipo: "Compra", cantidad: 0.0039528, precio: 72358227.079539, broker: "Nexo" },
  { fecha: "2024-10-03", activo: "NEXO", tipo: "Compra", cantidad: 31.3613325, precio: 1140.008958, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "BTC", tipo: "Split", cantidad: 0.00010249, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "DOT", tipo: "Split", cantidad: 0.04078268, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "ETH", tipo: "Split", cantidad: 0.00021882, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "NEXO", tipo: "Split", cantidad: 1.28065829, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "SOL", tipo: "Split", cantidad: 0.00369718, precio: 0, broker: "Nexo" },
  { fecha: "2024-10-01", activo: "USDT", tipo: "Split", cantidad: 0.306554, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-25", activo: "SOL", tipo: "Compra", cantidad: 0.29477475, precio: 184685.255437, broker: "Nexo" },
  { fecha: "2024-09-25", activo: "BTC", tipo: "Compra", cantidad: 0.0021574, precio: 78506813.7573, broker: "Nexo" },
  { fecha: "2024-09-24", activo: "AL30", tipo: "Venta", cantidad: 59.0, precio: 723.4695, broker: "IOL" },
  { fecha: "2024-09-23", activo: "AL30", tipo: "Compra", cantidad: 59.0, precio: 700.2, broker: "IOL" },
  { fecha: "2024-09-19", activo: "AL30", tipo: "Venta", cantidad: 176.0, precio: 726.7065, broker: "IOL" },
  { fecha: "2024-09-18", activo: "AL30", tipo: "Compra", cantidad: 176.0, precio: 699.4, broker: "IOL" },
  { fecha: "2024-09-18", activo: "AL30", tipo: "Venta", cantidad: 12.0, precio: 693.26, broker: "Bull Market" },
  { fecha: "2024-09-17", activo: "AL30", tipo: "Compra", cantidad: 12.0, precio: 698.3, broker: "Bull Market" },
  { fecha: "2024-09-05", activo: "QQQ", tipo: "Compra", cantidad: 4.0, precio: 30000.0, broker: "Bull Market" },
  { fecha: "2024-09-04", activo: "BTC", tipo: "Compra", cantidad: 0.00169872, precio: 75341433.549967, broker: "Bybit" },
  { fecha: "2024-09-01", activo: "BTC", tipo: "Split", cantidad: 0.00007431, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-01", activo: "DOT", tipo: "Split", cantidad: 0.03919562, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-01", activo: "ETH", tipo: "Split", cantidad: 0.00021156, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-01", activo: "NEXO", tipo: "Split", cantidad: 0.96895854, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-01", activo: "SOL", tipo: "Split", cantidad: 0.00406022, precio: 0, broker: "Nexo" },
  { fecha: "2024-09-01", activo: "USDT", tipo: "Split", cantidad: 0.447673, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-26", activo: "AL30", tipo: "Venta", cantidad: 8.0, precio: 646.04, broker: "Bull Market" },
  { fecha: "2024-08-23", activo: "AL30", tipo: "Compra", cantidad: 8.0, precio: 639.6, broker: "Bull Market" },
  { fecha: "2024-08-22", activo: "AL30", tipo: "Venta", cantidad: 58.0, precio: 607.3732, broker: "IOL" },
  { fecha: "2024-08-22", activo: "BTC", tipo: "Compra", cantidad: 0.004075, precio: 78725766.871166, broker: "Nexo" },
  { fecha: "2024-08-22", activo: "NEXO", tipo: "Compra", cantidad: 24.87562189, precio: 1316.728719, broker: "Nexo" },
  { fecha: "2024-08-21", activo: "AMZN", tipo: "Compra", cantidad: 15.0, precio: 1615.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "MSFT", tipo: "Compra", cantidad: 1.0, precio: 18200.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 28600.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 20250.0, broker: "IOL" },
  { fecha: "2024-08-21", activo: "AL30", tipo: "Compra", cantidad: 58.0, precio: 640.4, broker: "IOL" },
  { fecha: "2024-08-13", activo: "AL30", tipo: "Venta", cantidad: 10.0, precio: 612.291, broker: "IOL" },
  { fecha: "2024-08-12", activo: "AL30", tipo: "Compra", cantidad: 10.0, precio: 629.7, broker: "IOL" },
  { fecha: "2024-08-06", activo: "BTC", tipo: "Compra", cantidad: 0.00174835, precio: 76449708.490863, broker: "Bybit" },
  { fecha: "2024-08-05", activo: "BABA", tipo: "Compra", cantidad: 8.0, precio: 11400.0, broker: "Bull Market" },
  { fecha: "2024-08-05", activo: "PFE", tipo: "Compra", cantidad: 5.0, precio: 10025.0, broker: "Bull Market" },
  { fecha: "2024-08-05", activo: "NEXO", tipo: "Compra", cantidad: 39.90024938, precio: 1218.157583, broker: "Nexo" },
  { fecha: "2024-08-02", activo: "BTC", tipo: "Compra", cantidad: 0.00304888, precio: 86794831.116804, broker: "Nexo" },
  { fecha: "2024-08-02", activo: "NEXO", tipo: "Compra", cantidad: 17.404621, precio: 1532.972192, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "BTC", tipo: "Split", cantidad: 0.00008875, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "DOT", tipo: "Split", cantidad: 0.04001847, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "ETH", tipo: "Split", cantidad: 0.00021705, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "NEXO", tipo: "Split", cantidad: 2.4998538, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "SOL", tipo: "Split", cantidad: 0.00245008, precio: 0, broker: "Nexo" },
  { fecha: "2024-08-01", activo: "USDT", tipo: "Split", cantidad: 34.381592, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-18", activo: "AL30", tipo: "Venta", cantidad: 9.0, precio: 597.9112, broker: "IOL" },
  { fecha: "2024-07-17", activo: "AL30", tipo: "Compra", cantidad: 9.0, precio: 627.6, broker: "IOL" },
  { fecha: "2024-07-06", activo: "NEXO", tipo: "Compra", cantidad: 9.3870271, precio: 1487.414477, broker: "Nexo" },
  { fecha: "2024-07-06", activo: "BNB", tipo: "Compra", cantidad: 0.05575735, precio: 727974.93812, broker: "Bybit" },
  { fecha: "2024-07-06", activo: "BNB", tipo: "Compra", cantidad: 0.19266264, precio: 724707.187652, broker: "Bybit" },
  { fecha: "2024-07-03", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 22840.0, broker: "Bull Market" },
  { fecha: "2024-07-03", activo: "MELI", tipo: "Compra", cantidad: 2.0, precio: 18829.0, broker: "Bull Market" },
  { fecha: "2024-07-03", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 38440.0, broker: "Bull Market" },
  { fecha: "2024-07-03", activo: "BTC", tipo: "Compra", cantidad: 0.004923, precio: 84247410.115783, broker: "Nexo" },
  { fecha: "2024-07-03", activo: "NEXO", tipo: "Compra", cantidad: 34.6095608, precio: 1597.824379, broker: "Nexo" },
  { fecha: "2024-07-02", activo: "MSFT", tipo: "Compra", cantidad: 1.0, precio: 21757.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "SPY", tipo: "Compra", cantidad: 3.0, precio: 39041.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "AAPL", tipo: "Compra", cantidad: 2.0, precio: 15640.0, broker: "IOL" },
  { fecha: "2024-07-02", activo: "HMY", tipo: "Compra", cantidad: 2.0, precio: 12939.0, broker: "IOL" },
  { fecha: "2024-07-01", activo: "BTC", tipo: "Split", cantidad: 0.00006217, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-01", activo: "DOT", tipo: "Split", cantidad: 0.0396361, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-01", activo: "ETH", tipo: "Split", cantidad: 0.00021614, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-01", activo: "NEXO", tipo: "Split", cantidad: 0.60329943, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-01", activo: "SOL", tipo: "Split", cantidad: 0.00243998, precio: 0, broker: "Nexo" },
  { fecha: "2024-07-01", activo: "USDT", tipo: "Split", cantidad: 2.180365, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-24", activo: "NEXO", tipo: "Compra", cantidad: 7.98004988, precio: 1544.95132, broker: "Nexo" },
  { fecha: "2024-06-13", activo: "AL30", tipo: "Compra", cantidad: 1.0, precio: 704.5, broker: "IOL" },
  { fecha: "2024-06-13", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 34588.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "NVDA", tipo: "Compra", cantidad: 10.0, precio: 6840.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "AL30", tipo: "Compra", cantidad: 100.0, precio: 698.8, broker: "IOL" },
  { fecha: "2024-06-13", activo: "BBAR", tipo: "Compra", cantidad: 20.0, precio: 4550.0, broker: "IOL" },
  { fecha: "2024-06-13", activo: "GGAL", tipo: "Compra", cantidad: 8.0, precio: 4475.0, broker: "IOL" },
  { fecha: "2024-06-11", activo: "NVDA", tipo: "Split", cantidad: 18.0, precio: 0, broker: "IOL" },
  { fecha: "2024-06-06", activo: "ETH", tipo: "Compra", cantidad: 0.0235215, precio: 4867074.803903, broker: "Nexo" },
  { fecha: "2024-06-06", activo: "BTC", tipo: "Compra", cantidad: 0.0016824, precio: 90728245.363766, broker: "Nexo" },
  { fecha: "2024-06-03", activo: "AL30", tipo: "Venta", cantidad: 22.0, precio: 685.41, broker: "Bull Market" },
  { fecha: "2024-06-01", activo: "BTC", tipo: "Split", cantidad: 0.00002967, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-01", activo: "DOT", tipo: "Split", cantidad: 0.03749354, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-01", activo: "ETH", tipo: "Split", cantidad: 0.00030044, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-01", activo: "NEXO", tipo: "Split", cantidad: 0.35351491, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-01", activo: "SOL", tipo: "Split", cantidad: 0.00231305, precio: 0, broker: "Nexo" },
  { fecha: "2024-06-01", activo: "USDT", tipo: "Split", cantidad: 2.664613, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-31", activo: "AL30", tipo: "Compra", cantidad: 22.0, precio: 684.8, broker: "Bull Market" },
  { fecha: "2024-05-31", activo: "ETH", tipo: "Compra", cantidad: 0.01304046, precio: 4662143.82008, broker: "Bybit" },
  { fecha: "2024-05-30", activo: "AMD", tipo: "Compra", cantidad: 1.0, precio: 20293.5, broker: "Bull Market" },
  { fecha: "2024-05-30", activo: "SPY", tipo: "Compra", cantidad: 2.0, precio: 31806.0, broker: "Bull Market" },
  { fecha: "2024-05-28", activo: "CONIOLA", tipo: "Compra", cantidad: 1599.0, precio: 93.7754, broker: "IOL" },
  { fecha: "2024-05-23", activo: "NVDA", tipo: "Compra", cantidad: 1.0, precio: 54200.0, broker: "IOL" },
  { fecha: "2024-05-23", activo: "GGAL", tipo: "Compra", cantidad: 6.0, precio: 4004.0, broker: "IOL" },
  { fecha: "2024-05-16", activo: "GGAL", tipo: "Compra", cantidad: 1.0, precio: 3960.0, broker: "IOL" },
  { fecha: "2024-05-16", activo: "BBAR", tipo: "Compra", cantidad: 10.0, precio: 4125.0, broker: "Bull Market" },
  { fecha: "2024-05-16", activo: "GGAL", tipo: "Compra", cantidad: 14.0, precio: 3960.0, broker: "Bull Market" },
  { fecha: "2024-05-16", activo: "PRPEDOB", tipo: "Compra", cantidad: 5.0, precio: 1691.3352, broker: "IOL" },
  { fecha: "2024-05-06", activo: "BBAR", tipo: "Compra", cantidad: 7.0, precio: 4135.0, broker: "IOL" },
  { fecha: "2024-05-06", activo: "SUPV", tipo: "Compra", cantidad: 15.0, precio: 1614.0, broker: "IOL" },
  { fecha: "2024-05-06", activo: "GGAL", tipo: "Compra", cantidad: 11.0, precio: 4000.0, broker: "IOL" },
  { fecha: "2024-05-01", activo: "SOL", tipo: "Compra", cantidad: 0.3167948, precio: 134416.347743, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "BTC", tipo: "Compra", cantidad: 0.0021541, precio: 64246228.123114, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "NEXO", tipo: "Compra", cantidad: 39.58254878, precio: 1263.355748, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "BTC", tipo: "Split", cantidad: 0.00002803, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "DOT", tipo: "Split", cantidad: 0.03899822, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "ETH", tipo: "Split", cantidad: 0.00011741, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "NEXO", tipo: "Split", cantidad: 1.73784265, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "SOL", tipo: "Split", cantidad: 0.00396946, precio: 0, broker: "Nexo" },
  { fecha: "2024-05-01", activo: "USDT", tipo: "Split", cantidad: 25.487764, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-18", activo: "NEXO", tipo: "Compra", cantidad: 5.98503741, precio: 1236.523155, broker: "Nexo" },
  { fecha: "2024-04-14", activo: "NEXO", tipo: "Compra", cantidad: 7.98004988, precio: 1303.497717, broker: "Nexo" },
  { fecha: "2024-04-11", activo: "ETH", tipo: "Compra", cantidad: 0.01664847, precio: 3531629.392971, broker: "Nexo" },
  { fecha: "2024-04-11", activo: "BTC", tipo: "Compra", cantidad: 0.00056622, precio: 70456511.603264, broker: "Nexo" },
  { fecha: "2024-04-11", activo: "NEXO", tipo: "Compra", cantidad: 11.10340032, precio: 1433.593272, broker: "Nexo" },
  { fecha: "2024-04-03", activo: "DOT", tipo: "Compra", cantidad: 3.98021371, precio: 8392.547535, broker: "Nexo" },
  { fecha: "2024-04-03", activo: "BTC", tipo: "Compra", cantidad: 0.00076916, precio: 65558385.121431, broker: "Nexo" },
  { fecha: "2024-04-03", activo: "SOL", tipo: "Compra", cantidad: 0.264195, precio: 187598.17559, broker: "Nexo" },
  { fecha: "2024-04-03", activo: "NEXO", tipo: "Compra", cantidad: 18.95261845, precio: 1308.449772, broker: "Nexo" },
  { fecha: "2024-04-02", activo: "NEXO", tipo: "Compra", cantidad: 2.98507463, precio: 1268.799825, broker: "Nexo" },
  { fecha: "2024-04-02", activo: "NEXO", tipo: "Compra", cantidad: 2.9925187, precio: 1267.808612, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "BTC", tipo: "Split", cantidad: 0.00001538, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "DOT", tipo: "Split", cantidad: 0.05202623, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "ETH", tipo: "Split", cantidad: 0.00017054, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "NEXO", tipo: "Split", cantidad: 0.28060336, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "SOL", tipo: "Split", cantidad: 0.00223478, precio: 0, broker: "Nexo" },
  { fecha: "2024-04-01", activo: "USDT", tipo: "Split", cantidad: 2.423887, precio: 0, broker: "Nexo" },
  { fecha: "2024-03-20", activo: "ETH", tipo: "Compra", cantidad: 0.0118223, precio: 3600792.068142, broker: "Nexo" },
  { fecha: "2024-03-20", activo: "BTC", tipo: "Compra", cantidad: 0.00125015, precio: 69867783.625965, broker: "Nexo" },
  { fecha: "2024-03-20", activo: "NEXO", tipo: "Compra", cantidad: 7.98004988, precio: 1407.280456, broker: "Nexo" },
  { fecha: "2024-03-01", activo: "BTC", tipo: "Split", cantidad: 0.00000625, precio: 0, broker: "Nexo" },
  { fecha: "2024-03-01", activo: "ETH", tipo: "Split", cantidad: 0.00007421, precio: 0, broker: "Nexo" },
  { fecha: "2024-03-01", activo: "NEXO", tipo: "Split", cantidad: 0.03557003, precio: 0, broker: "Nexo" },
  { fecha: "2024-03-01", activo: "USDT", tipo: "Split", cantidad: 0.140672, precio: 0, broker: "Nexo" },
  { fecha: "2024-02-08", activo: "NEXO", tipo: "Compra", cantidad: 1.08932461, precio: 1086.498909, broker: "Nexo" },
  { fecha: "2024-02-05", activo: "META", tipo: "Compra", cantidad: 1.0, precio: 25829.5, broker: "IOL" },
  { fecha: "2024-02-05", activo: "SPY", tipo: "Compra", cantidad: 1.0, precio: 32050.0, broker: "IOL" },
  { fecha: "2024-02-01", activo: "NEXO", tipo: "Compra", cantidad: 29.52637643, precio: 1098.34126, broker: "Nexo" },
  { fecha: "2024-02-01", activo: "NEXO", tipo: "Compra", cantidad: 31.17221793, precio: 1070.074965, broker: "Nexo" },
  { fecha: "2024-02-01", activo: "NEXO", tipo: "Split", cantidad: 0.08237143, precio: 0, broker: "Nexo" },
  { fecha: "2024-01-26", activo: "AAPL", tipo: "Compra", cantidad: 1.0, precio: 15879.28, broker: "IOL" },
  { fecha: "2024-01-26", activo: "IBM", tipo: "Compra", cantidad: 2.0, precio: 36277.92, broker: "IOL" },
  { fecha: "2024-01-26", activo: "LLY", tipo: "Compra", cantidad: 6.0, precio: 97753.38, broker: "IOL" },
  { fecha: "2024-01-26", activo: "MELI", tipo: "Compra", cantidad: 1.0, precio: 19790.64, broker: "IOL" },
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
  { key: "Cripto", color: "#E8964F", icon: Bitcoin },
];

function computeBrokerList() {
  return [...new Set(HOLDINGS.map((h) => h.broker))];
}
let BROKER_LIST = computeBrokerList();

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
  NEXO: "Nexo", POL: "Polygon", DOT: "Polkadot", DOGE: "Dogecoin",
  RENDER: "Render", AVAX: "Avalanche", LINK: "Chainlink", BNB: "BNB (Binance Coin)",
  PAM: "Pampa Energía (ADR)",
};

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return 200 + h;
}

// Cualquier ticker que esté en tus tenencias reales pero no esté en el catálogo de
// arriba se agrega automáticamente, para que "Buscar activo" siempre encuentre lo
// que tenés en cartera (aunque el gráfico de precio siga siendo simulado).
const HOLDINGS_CAT_TO_SEARCH_CAT = { Acciones: "Acciones AR", CEDEARs: "CEDEARs", Bonos: "Bonos", Fondos: "Fondos", Cripto: "Cripto" };
function computeAutoAssets() {
  return [...new Set(HOLDINGS.map((h) => h.name))]
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
}
let AUTO_ASSETS = computeAutoAssets();
let ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];

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
  // --- Acciones argentinas -- fechas confirmadas por la propia empresa donde
  // se pudo, estimadas por patrón trimestral (mismo mes que el año anterior)
  // donde no había aviso oficial todavía.
  BBAR: [{ fecha: "2026-08-27", tipo: "Presenta balance", detalle: "Resultados 2º trimestre 2026 (confirmado por la empresa)" }],
  BMA: [{ fecha: "2026-08-26", tipo: "Presenta balance", detalle: "Resultados 2º trimestre 2026 (estimado por patrón)" }],
  CEPU: [{ fecha: "2026-11-10", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026 (estimado por patrón)" }],
  LOMA: [{ fecha: "2026-11-06", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026 (estimado por patrón)" }],
  PAM: [{ fecha: "2026-11-04", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026 (estimado por patrón)" }],
  SUPV: [{ fecha: "2026-11-10", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026 (estimado por patrón)" }],
  TGSU2: [{ fecha: "2026-11-03", tipo: "Presenta balance", detalle: "Resultados 3º trimestre 2026 (estimado por patrón)" }],
  // --- CEDEARs de EE.UU. -- las más grandes tienen calendario trimestral muy
  // consistente año a año; estimado por ese patrón salvo que se indique lo
  // contrario. No incluye ETFs (DIA/QQQ/SPY) ni las que no encontramos dato.
  MSFT: [{ fecha: "2026-10-27", tipo: "Presenta balance", detalle: "Earnings Q1 fiscal 2027 (estimado por patrón)" }],
  AMZN: [{ fecha: "2026-10-29", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  GOOGL: [{ fecha: "2026-10-27", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  META: [{ fecha: "2026-10-28", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  NVDA: [{ fecha: "2026-11-19", tipo: "Presenta balance", detalle: "Earnings Q3 fiscal 2027 (estimado por patrón)" }],
  AMD: [{ fecha: "2026-10-27", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  MU: [{ fecha: "2026-09-23", tipo: "Presenta balance", detalle: "Earnings Q4 fiscal 2026 (estimado por patrón)" }],
  IBM: [{ fecha: "2026-10-21", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  MELI: [{ fecha: "2026-11-04", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  MCD: [{ fecha: "2026-10-27", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  KO: [{ fecha: "2026-10-20", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  PYPL: [{ fecha: "2026-10-28", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  CSCO: [{ fecha: "2026-11-11", tipo: "Presenta balance", detalle: "Earnings Q1 fiscal 2027 (estimado por patrón)" }],
  T: [{ fecha: "2026-10-22", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  DISN: [{ fecha: "2026-11-12", tipo: "Presenta balance", detalle: "Earnings Q4 fiscal 2026 (estimado por patrón)" }],
  PFE: [{ fecha: "2026-11-04", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  BABA: [{ fecha: "2026-11-19", tipo: "Presenta balance", detalle: "Earnings Q2 fiscal 2027 (estimado por patrón)" }],
  TSM: [{ fecha: "2026-10-16", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  PBR: [{ fecha: "2026-11-13", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  HMY: [{ fecha: "2026-11-10", tipo: "Presenta balance", detalle: "Earnings 1º semestre fiscal (estimado por patrón)" }],
  VIST: [{ fecha: "2026-11-11", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
  KEEL: [{ fecha: "2026-11-13", tipo: "Presenta balance", detalle: "Earnings Q3 2026 (estimado por patrón)" }],
};

const COUPON_SCHEDULE = {
  AL30: [
    { fecha: "2026-09-09", tipo: "Cupón", monto: 0.5 },
    { fecha: "2027-01-09", tipo: "Amortización + Cupón", monto: 4.5 },
    { fecha: "2027-07-09", tipo: "Cupón", monto: 0.5 },
    { fecha: "2028-01-09", tipo: "Amortización + Cupón", monto: 4.5 },
  ],
  // GD35/GD38/GD41 (Globales ley extranjera, canje 2020) pagan semestral el
  // 9 de enero y el 9 de julio -- el de julio 2026 ya pasó, el próximo es
  // enero 2027. Monto aproximado según la tasa "step-up" vigente, puede
  // variar levemente respecto al pago real.
  GD35: [{ fecha: "2027-01-09", tipo: "Cupón", monto: 2.06 }],
  GD38: [{ fecha: "2027-01-09", tipo: "Cupón", monto: 2.5 }],
  GD41: [{ fecha: "2027-01-09", tipo: "Cupón", monto: 1.75 }],
};

const RANGE_PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "Este mes", month: true },
  { label: "YTD", ytd: true },
  { label: "Todo", all: true },
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

// --- Datos en vivo (livianos: dólar + 3 paneles de precios + cripto) ------
// Solo el histórico de TODA la cartera junta (42 tickers de una) se cachea
// una vez al día -- eso fue lo que terminó bloqueando el sitio. Todo lo demás
// (precio actual, e histórico de UN activo puntual que estás mirando) es
// liviano y sigue en vivo, como corresponde.
const dataUrl = (name) => `${import.meta.env.BASE_URL}data/${name}`;

// FX: dolarapi.com -- API pública, formato confirmado y estable.
async function fetchFxRates() {
  const res = await fetchWithTimeout("https://dolarapi.com/v1/dolares");
  if (!res.ok) throw new Error("fx fetch failed");
  const data = await res.json();
  const byCasa = Object.fromEntries(data.map((d) => [d.casa, d]));
  const out = {};
  if (byCasa.oficial) out.oficial = { label: "Oficial", value: byCasa.oficial.venta };
  if (byCasa.bolsa) out.mep = { label: "MEP", value: byCasa.bolsa.venta };
  if (byCasa.blue) out.blue = { label: "Blue", value: byCasa.blue.venta };
  return out;
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
// Variación % contra el cierre del día anterior -- data912 ya la manda
// calculada (campo "pct_change") en la moneda propia de cada panel, así que
// para CEDEARs viene en pesos reales del CEDEAR, no en dólares del
// subyacente -- no hace falta ningún reescalado acá.
function extractPctChange(o) {
  if (typeof o.pct_change === "number") return o.pct_change;
  if (typeof o.change_percent === "number") return o.change_percent;
  if (typeof o.changePercent === "number") return o.changePercent;
  if (typeof o.variation === "number") return o.variation;
  return null;
}

// Precios en vivo: data912.com, 3 paneles nada más -- liviano, nunca causó problema.
async function fetchLivePrices() {
  const endpoints = [
    { path: "arg_stocks", cat: "Acciones AR" },
    { path: "arg_bonds", cat: "Bonos" },
    { path: "arg_cedears", cat: "CEDEARs" },
  ];
  const results = await Promise.allSettled(
    endpoints.map((e) => fetchWithTimeout(`https://data912.com/live/${e.path}`).then((r) => r.json()))
  );
  const prices = {};
  const pctChanges = {};
  const catalog = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
    for (const item of r.value) {
      const sym = extractSymbol(item);
      const price = extractPrice(item);
      const pctChange = extractPctChange(item);
      if (sym && price) prices[sym] = price;
      if (sym && pctChange != null) pctChanges[sym] = pctChange;
      if (sym) catalog.push({ symbol: sym, cat: endpoints[i].cat });
    }
  });
  return { prices, pctChanges, catalog };
}

// Histórico de TODA la cartera (42 tickers) -- este sí queda cacheado,
// generado una vez al día por .github/workflows/update-prices.yml.
async function fetchHistoryCache() {
  const res = await fetchWithTimeout(dataUrl("history.json"));
  if (!res.ok) return { history: {}, coverage: null };
  const data = await res.json();
  return { history: data.history || {}, coverage: data.coverage || null };
}

const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether",
  NEXO: "nexo", POL: "polygon-ecosystem-token", DOT: "polkadot", DOGE: "dogecoin",
  RENDER: "render-token", AVAX: "avalanche-2", LINK: "chainlink", BNB: "binancecoin",
};

// Cripto en vivo: CoinGecko, endpoint confirmado y estable.
async function fetchCryptoPricesUsd() {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const res = await fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok) throw new Error("crypto fetch failed");
  const data = await res.json();
  const out = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    if (data[id]?.usd) out[symbol] = data[id].usd;
  }
  return out;
}

async function fetchCryptoHistoryUsd(symbol, days) {
  const id = COINGECKO_IDS[symbol];
  if (!id) return null;
  const res = await fetchWithTimeout(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok) throw new Error("crypto history fetch failed");
  const data = await res.json();
  if (!Array.isArray(data.prices)) return null;
  return data.prices.map(([ts, price]) => ({ date: new Date(ts).toISOString().slice(0, 10), price }));
}

// Histórico de UN activo puntual vía data912 -- se usa on-demand en Buscar
// activo (1 pedido, liviano), nunca en bloque. Maneja los dos formatos que
// confirmamos con datos reales: lista de objetos (stocks/bonds argentinos) y
// objeto con arrays paralelos {dates, prices} (usa_stocks/CEDEARs).
const US_TICKER_ALIAS = { DISN: "DIS" };

// Finnhub: cotización real en vivo de la bolsa de EE.UU. -- necesita API key
// gratis (ver .github/workflows/deploy.yml, se inyecta como VITE_FINNHUB_KEY
// en el build, nunca queda en el código fuente del repo).
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY;
async function fetchFinnhubQuote(ticker) {
  if (!FINNHUB_KEY) return null;
  const requestTicker = US_TICKER_ALIAS[ticker] || ticker;
  try {
    const res = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=${requestTicker}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    // "c" = precio actual. Si Finnhub no tiene el símbolo, devuelve c:0.
    return typeof data.c === "number" && data.c > 0 ? data.c : null;
  } catch {
    return null;
  }
}

async function fetchAssetHistory(type, ticker, cat) {
  const requestTicker = (cat === "CEDEARs" && US_TICKER_ALIAS[ticker]) || ticker;
  try {
    const res = await fetchWithTimeout(`https://data912.com/historical/${type}/${requestTicker}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const parsed = data
        .map((row) => {
          const date = row.date || row.fecha || row.d || row.t;
          const price = row.c ?? row.close ?? row.px ?? row.price;
          if (!date || price == null) return null;
          return { date: String(date).slice(0, 10), price };
        })
        .filter(Boolean);
      return parsed.length > 0 ? parsed : null;
    }
    if (data && Array.isArray(data.dates) && Array.isArray(data.prices)) {
      const out = [];
      for (let i = 0; i < data.dates.length; i++) {
        if (data.dates[i] == null || data.prices[i] == null) continue;
        out.push({ date: String(data.dates[i]).slice(0, 10), price: data.prices[i] });
      }
      return out.length > 0 ? out : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Los bonos en ley extranjera (AL/GD) cotizan "cada 100 de nominal" y en dólares
// (ej: 84,59 = US$0,8459 por unidad), mientras que nuestro costo de compra (avgCost)
// está guardado en pesos por unidad. Confirmado con datos reales del usuario
// (Balanz: GD38 a u$s0,8466/unidad; data912: "GD38" sin sufijo = ARS 1293,60,
// cada 100 nominal) -- ya está en pesos, solo falta dividir por 100.
function liveAdjustedPrice(holding, livePrices, fx, cryptoUsd) {
  if (holding.cat === "Cripto") {
    const usd = cryptoUsd?.[holding.name];
    return usd != null ? usd * fx : holding.price; // sin dato en vivo, se mantiene el estimado
  }
  const raw = livePrices[holding.name];
  if (raw == null) return holding.price; // sin dato en vivo, se mantiene el estimado
  if (holding.cat === "Bonos") return raw / 100;
  return raw;
}

// --- Reconstrucción de histórico real de la cartera --------------------
// Cruza tus movimientos reales (sabemos cuánto tenías de cada activo en cada
// fecha) con el histórico de precio real de cada uno (ya cacheado en
// history.json). Los activos sin histórico real disponible (ej: fondos como
// CONIOLA) aportan su valor actual "plano" hacia atrás -- no es ideal, pero es
// mejor que inventar una caminata aleatoria, y queda claramente marcado.

// Si un ticker+broker no tiene NINGÚN movimiento cargado (ej: Bull Market,
// que por ahora solo tiene el snapshot de tenencias, sin órdenes históricas
// importadas), devuelve la cantidad actual de HOLDINGS para ese broker --
// mismo criterio "plano hacia atrás" que ya se usa cuando falta precio
// histórico, en vez de mostrar 0 y un salto vertical el último día.
function flatQtyFallback(ticker, broker) {
  const brokersWithTrades = new Set(
    MOVIMIENTOS.filter((m) => m.activo === ticker && (m.tipo === "Compra" || m.tipo === "Venta" || m.tipo === "Split")).map((m) => m.broker)
  );
  return HOLDINGS.filter((h) => h.name === ticker && (broker == null || h.broker === broker) && !brokersWithTrades.has(h.broker));
}

function buildQtyTimeline(ticker, broker) {
  const trades = MOVIMIENTOS.filter(
    (m) => m.activo === ticker && (broker == null || m.broker === broker) && (m.tipo === "Compra" || m.tipo === "Venta" || m.tipo === "Split")
  )
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const flatQty = flatQtyFallback(ticker, broker).reduce((s, h) => s + h.qty, 0);
  return (date) => {
    let q = flatQty;
    for (const t of trades) {
      if (t.fecha > date) break;
      // Un split suma acciones igual que una compra, pero a costo 0 (no es
      // plata nueva invertida -- ver buildCostBasisTimeline más abajo).
      q += (t.tipo === "Venta" ? -1 : 1) * t.cantidad;
    }
    return q;
  };
}

// Capital invertido real, día por día: para cada tenencia (ticker+broker,
// respetando el filtro de cartera activo), cuánto tenías comprado a esa fecha
// multiplicado por tu costo promedio real. A diferencia del valor de mercado,
// esto no es una estimación -- sale directo de tus movimientos reales.
// Costo invertido real, día por día -- reproduce el método de costo promedio
// ponderado: cada compra suma cantidad y costo; cada venta descuenta la
// proporción correspondiente del costo acumulado (no el costo total). Así el
// "invertido" de una fecha vieja refleja lo que realmente habías puesto en
// ese momento, no el promedio final aplicado hacia atrás. Los splits suman
// cantidad igual que una compra pero a precio 0 -- no mueven el costo
// invertido, solo diluyen el costo promedio por unidad (como corresponde).
function buildCostBasisTimeline(ticker, broker) {
  const trades = MOVIMIENTOS.filter(
    (m) => m.activo === ticker && (broker == null || m.broker === broker) && (m.tipo === "Compra" || m.tipo === "Venta" || m.tipo === "Split")
  )
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const flatHoldings = flatQtyFallback(ticker, broker);
  const flatQty = flatHoldings.reduce((s, h) => s + h.qty, 0);
  const flatCost = flatHoldings.reduce((s, h) => s + h.qty * h.avgCost, 0);
  return (date) => {
    let qty = flatQty, cost = flatCost;
    for (const t of trades) {
      if (t.fecha > date) break;
      if (t.tipo === "Compra" || t.tipo === "Split") {
        qty += t.cantidad;
        cost += t.cantidad * t.precio; // precio es 0 en los splits
      } else if (qty > 0) {
        const avgCostPerUnit = cost / qty;
        const soldQty = Math.min(t.cantidad, qty);
        cost -= soldQty * avgCostPerUnit;
        qty -= soldQty;
      }
    }
    return cost;
  };
}

function buildInvestedSeries(holdings, dates) {
  const perHolding = holdings.map((h) => buildCostBasisTimeline(h.name, h.broker));
  return dates.map((date) => ({
    date,
    invertido: perHolding.reduce((s, costAt) => s + costAt(date), 0),
  }));
}

// Suma N meses a una fecha "YYYY-MM-DD" (para la Calculadora de aportes periódicos).
function addMonths(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
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
// Fecha de tu primer movimiento real -- no tiene sentido mostrar histórico de
// antes de eso, tu cartera todavía no existía.
function computeEarliestTradeDate() {
  return MOVIMIENTOS.filter((m) => m.tipo === "Compra" || m.tipo === "Venta")
    .reduce((min, m) => (m.fecha < min ? m.fecha : min), MOVIMIENTOS[0]?.fecha || "2020-01-01");
}
let EARLIEST_TRADE_DATE = computeEarliestTradeDate();

function buildRealPortfolioHistory(holdings, historyCache, livePrices, cryptoUsd, fx) {
  const uniqueTickers = [...new Map(holdings.map((h) => [`${h.name}__${h.broker}`, h])).values()];
  const today = new Date();
  const start = new Date(EARLIEST_TRADE_DATE);
  const days = Math.max(1, Math.round((today - start) / 86400000));
  const dates = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  let tickersWithRealData = 0;
  const perTicker = uniqueTickers.map((h) => {
    const qtyAt = buildQtyTimeline(h.name, h.broker);
    const hist = historyCache[h.name];
    if (hist && hist.length > 1) {
      tickersWithRealData++;
      const historyMap = {};
      for (const p of hist) historyMap[p.date] = p.price;
      const sortedDates = Object.keys(historyMap).sort();
      // Las CEDEARs y las criptos (vía Coinbase) se cachean en dólares
      // reales, no en pesos -- hay que reescalar al precio ARS real de hoy
      // (mismo truco que "Buscar activo"), si no, el valor sale ~1000x más
      // chico de lo real.
      let scaleFix = 1;
      if (h.cat === "CEDEARs") {
        const livePriceArs = livePrices?.[h.name];
        const lastHistUsd = historyMap[sortedDates[sortedDates.length - 1]];
        if (livePriceArs != null && lastHistUsd > 0) scaleFix = livePriceArs / lastHistUsd;
      } else if (h.cat === "Cripto") {
        const livePriceArs = cryptoUsd?.[h.name] != null ? cryptoUsd[h.name] * fx : null;
        const lastHistUsd = historyMap[sortedDates[sortedDates.length - 1]];
        if (livePriceArs != null && lastHistUsd > 0) scaleFix = livePriceArs / lastHistUsd;
      }
      return {
        valueAt: (date) => {
          const raw = priceAt(historyMap, sortedDates, date);
          return qtyAt(date) * (raw != null ? raw * scaleFix : h.price);
        },
      };
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

// Formato corto para las etiquetas del eje (ej: "1,2M" en vez de "1234567").
function fmtCompact(n, currency, fxRate) {
  const val = currency === "USD" ? n / fxRate : n;
  const prefix = currency === "USD" ? "US$" : "$";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return prefix + (val / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "M";
  if (abs >= 1_000) return prefix + (val / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "k";
  return prefix + val.toLocaleString("es-AR", { maximumFractionDigits: abs >= 10 ? 0 : 2 });
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
  { key: "novedades", label: "Novedades de mi cartera", icon: Bell },
  { key: "calculadora", label: "Calculadora", icon: Calculator },
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

function translateFirebaseError(code) {
  const map = {
    "auth/invalid-email": "Ese email no es válido.",
    "auth/user-not-found": "No encontramos una cuenta con ese email.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
    "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en un rato.",
    "auth/network-request-failed": "No hay conexión. Revisá tu internet.",
  };
  return map[code] || "Algo salió mal. Probá de nuevo.";
}

// Pantalla previa a la app -- login/registro/recuperar contraseña. Se
// muestra cuando no hay nadie logueado todavía.
function LoginView({ C }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err) {
      setError(translateFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 380, padding: "32px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 4, textAlign: "center", color: C.text }}>Cartera Personal</div>
        <div style={{ fontSize: 13, color: C.faint, textAlign: "center", marginBottom: 24 }}>
          {mode === "login" ? "Iniciá sesión para ver tu cartera" : mode === "signup" ? "Creá tu cuenta" : "Recuperar contraseña"}
        </div>

        {mode === "reset" && resetSent ? (
          <div style={{ fontSize: 13, color: C.gain, textAlign: "center", padding: "16px 0" }}>
            Te mandamos un mail para restablecer tu contraseña. Revisá tu bandeja de entrada.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              Email
              <div style={{ position: "relative" }}>
                <Mail size={15} color={C.faint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "10px 12px 10px 36px", fontSize: 14 }}
                />
              </div>
            </label>

            {mode !== "reset" && (
              <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                Contraseña
                <div style={{ position: "relative" }}>
                  <Lock size={15} color={C.faint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "10px 12px 10px 36px", fontSize: 14 }}
                  />
                </div>
              </label>
            )}

            {error && <div style={{ fontSize: 12, color: C.loss, marginBottom: 14 }}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: C.gold, color: C.bg, fontWeight: 600, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "..." : mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Enviar mail"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 12 }}>
          {mode === "login" && (
            <>
              <button type="button" onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12, marginRight: 14 }}>
                Crear cuenta
              </button>
              <button type="button" onClick={() => { setMode("reset"); setError(""); setResetSent(false); }} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 12 }}>
                Olvidé mi contraseña
              </button>
            </>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => { setMode("login"); setError(""); setResetSent(false); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12 }}>
              Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ C, text }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.faint, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
      {text}
    </div>
  );
}

// Puerta de entrada: mientras se confirma si hay sesión, muestra un loader;
// si no hay nadie logueado, muestra el login; si hay sesión, busca los datos
// de ESE usuario en Firestore (users/{uid}) y recién ahí monta la app
// completa -- nunca con datos de otro usuario, ni por un instante. Así
// InvestmentDashboard nunca queda "a medio montar" sin datos listos.
export default function AuthGate() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [userData, setUserData] = useState(undefined); // undefined = cargando los datos de Firestore
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setAuthUser);
    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setUserData(undefined);
      return;
    }
    let cancelled = false;
    setUserData(undefined);
    setDataError(null);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", authUser.uid));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : {};
        setUserData({
          holdings: Array.isArray(data.holdings) ? data.holdings : [],
          movimientos: Array.isArray(data.movimientos) ? data.movimientos : [],
        });
      } catch (err) {
        if (!cancelled) setDataError(err.message || "No se pudieron cargar tus datos.");
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  const hour = new Date().getHours();
  const C = hour >= 7 && hour < 20 ? LIGHT : DARK;

  if (authUser === undefined) return <LoadingScreen C={C} text="Cargando..." />;
  if (authUser === null) return <LoginView C={C} />;

  if (dataError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: C.bg, color: C.loss, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, padding: 20, textAlign: "center" }}>
        <div>No pudimos cargar tus datos: {dataError}</div>
        <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, cursor: "pointer" }}>
          Cerrar sesión e intentar de nuevo
        </button>
      </div>
    );
  }

  if (userData === undefined) return <LoadingScreen C={C} text="Cargando tus datos..." />;

  // Reemplaza los arrays hardcodeados por los datos reales de ESTE usuario,
  // ya confirmados y listos -- InvestmentDashboard recién se monta después
  // de esta línea, así que todos sus hooks arrancan viendo los datos
  // correctos desde el primer render (sin problemas de orden de hooks).
  HOLDINGS = userData.holdings;
  MOVIMIENTOS = userData.movimientos;
  BROKER_LIST = computeBrokerList();
  AUTO_ASSETS = computeAutoAssets();
  ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];
  EARLIEST_TRADE_DATE = computeEarliestTradeDate();

  return <InvestmentDashboard key={authUser.uid} user={authUser} />;
}

function InvestmentDashboard({ user }) {
  const [view, setView] = useState("inicio");
  const [jumpSymbol, setJumpSymbol] = useState(null);
  const goToAsset = (symbol) => { setJumpSymbol(symbol); setView("buscar"); };
  const [hoverDot, setHoverDot] = useState(null); // { x, y, text } en píxeles del gráfico
  const [collapsed, setCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 20 ? "light" : "dark"; // de día (7-20hs) claro, de noche oscuro
  });
  const C = themeMode === "dark" ? DARK : LIGHT;
  const Cinv = themeMode === "dark" ? LIGHT : DARK; // paleta opuesta, para carteles de contraste

  const [rangeIdx, setRangeIdx] = useState(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [catFilter, setCatFilter] = useState("Todas");
  const [tenenciasSort, setTenenciasSort] = useState({ key: "value", dir: -1 }); // dir: 1 asc, -1 desc
  const [brokerFilter, setBrokerFilter] = useState("Todas"); // "Todas" o el nombre de una cartera puntual
  const [confirmandoBorradoCartera, setConfirmandoBorradoCartera] = useState(false);
  const [borrandoCartera, setBorrandoCartera] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [fxType, setFxType] = useState("mep");

  const [liveFxRates, setLiveFxRates] = useState(null); // null hasta que carguen
  const [livePrices, setLivePrices] = useState({});
  const [livePctChange, setLivePctChange] = useState({});
  const [liveCatalog, setLiveCatalog] = useState([]);
  const [cryptoUsd, setCryptoUsd] = useState({});
  const [historyCache, setHistoryCache] = useState({});
  const [historyCoverage, setHistoryCoverage] = useState(null);
  const [liveStatus, setLiveStatus] = useState("cargando"); // cargando | ok | error

  // Dólar, precios y cripto: en vivo (livianos). Histórico de la cartera
  // completa: cacheado una vez al día (ver .github/workflows/update-prices.yml)
  // porque son 42 pedidos de una, y eso sí terminó bloqueando el sitio antes.
  React.useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchFxRates(), fetchLivePrices(), fetchHistoryCache(), fetchCryptoPricesUsd()])
      .then(([fxRes, pxRes, histRes, cryptoRes]) => {
        if (cancelled) return;
        if (fxRes.status === "fulfilled" && Object.keys(fxRes.value).length > 0) {
          setLiveFxRates(fxRes.value);
        }
        if (pxRes.status === "fulfilled" && pxRes.value.prices && Object.keys(pxRes.value.prices).length > 0) {
          setLivePrices(pxRes.value.prices);
          setLivePctChange(pxRes.value.pctChanges || {});
          setLiveCatalog(pxRes.value.catalog || []);
        }
        if (histRes.status === "fulfilled") {
          setHistoryCache(histRes.value.history || {});
        }
        if (cryptoRes.status === "fulfilled" && Object.keys(cryptoRes.value).length > 0) {
          setCryptoUsd(cryptoRes.value);
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

  const activeFxRates = { ...FX_RATES, ...(liveFxRates || {}) };
  const fx = activeFxRates[fxType].value;
  const f = (n) => fmt(n, currency, fx);
  const priceFor = (h) => livePrices[h.name] ?? h.price;

  const holdingsLive = useMemo(() => HOLDINGS.map((h) => ({ ...h, price: liveAdjustedPrice(h, livePrices, fx, cryptoUsd) })), [livePrices, fx, cryptoUsd]);

  const byBroker = useMemo(
    () => (brokerFilter === "Todas" ? holdingsLive : holdingsLive.filter((h) => h.broker === brokerFilter)),
    [holdingsLive, brokerFilter]
  );
  const filteredHoldings = catFilter === "Todas" ? byBroker : byBroker.filter((h) => h.cat === catFilter);

  // Cruzar movimientos reales + histórico cacheado es sincrónico e instantáneo
  // (no hay red de por medio acá), así que se recalcula solo con useMemo.
  const { points: realHistoryPoints, coverage: realHistoryCoverage } = useMemo(
    () => buildRealPortfolioHistory(byBroker, historyCache, livePrices, cryptoUsd, fx),
    [historyCache, byBroker, livePrices, cryptoUsd, fx]
  );
  React.useEffect(() => { setHistoryCoverage(realHistoryCoverage); }, [realHistoryCoverage]);
  const realPortfolioHistory = Object.keys(historyCache).length > 0 ? realHistoryPoints : null;

  // Valor real de la cartera filtrada, calculado directo de las tenencias con precio
  // en vivo -- esta es la fuente de verdad.
  const realCurrentTotal = byBroker.reduce((s, h) => s + h.qty * h.price, 0);
  const usingRealHistory = realPortfolioHistory && realPortfolioHistory.length > 1;
  const baseSeries = usingRealHistory ? realPortfolioHistory : SERIES;
  const scaledSeries = useMemo(() => {
    if (baseSeries.length === 0) return baseSeries;
    if (usingRealHistory) {
      // Serie real: cada punto ya sale de precio histórico real x cantidad real,
      // no hace falta "estirar" toda la serie -- eso distorsiona días que sí son
      // reales. Solo se reemplaza el ÚLTIMO punto (hoy) por el valor en vivo,
      // por si el caché diario todavía no tiene un cierre propio para hoy (en
      // ese caso el último punto cacheado repetiría el de ayer).
      const last = baseSeries[baseSeries.length - 1];
      if (last.total === realCurrentTotal) return baseSeries;
      return [...baseSeries.slice(0, -1), { ...last, total: realCurrentTotal }];
    }
    // Serie simulada (sin histórico real todavía): sigue necesitando el
    // reescalado uniforme para anclarse a un valor real conocido.
    const seriesLastFull = baseSeries[baseSeries.length - 1].total;
    const scale = seriesLastFull > 0 ? realCurrentTotal / seriesLastFull : 1;
    return baseSeries.map((p) => ({ ...p, total: p.total * scale }));
  }, [baseSeries, usingRealHistory, realCurrentTotal]);

  const earliestDateForFilter = useMemo(() => {
    const relevant = MOVIMIENTOS.filter(
      (m) => (m.tipo === "Compra" || m.tipo === "Venta") && (brokerFilter === "Todas" || m.broker === brokerFilter)
    );
    return relevant.length > 0 ? relevant.reduce((min, m) => (m.fecha < min ? m.fecha : min), relevant[0].fecha) : EARLIEST_TRADE_DATE;
  }, [brokerFilter]);

  const { from, to } = useMemo(() => {
    if (useCustom && customFrom && customTo) return { from: customFrom, to: customTo };
    const preset = RANGE_PRESETS[rangeIdx];
    const last = SERIES[SERIES.length - 1];
    const lastDate = new Date(last.date);
    let fromDate;
    if (preset.month) fromDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
    else if (preset.ytd) fromDate = new Date(lastDate.getFullYear(), 0, 1);
    else if (preset.all) fromDate = new Date(earliestDateForFilter);
    else {
      fromDate = new Date(lastDate);
      fromDate.setDate(fromDate.getDate() - preset.days);
    }
    return { from: fromDate.toISOString().slice(0, 10), to: last.date };
  }, [rangeIdx, useCustom, customFrom, customTo, earliestDateForFilter]);

  const rangeStartPoint = scaledSeries.find((p) => p.date >= from) || scaledSeries[0];
  const rangeEndPoint = [...scaledSeries].reverse().find((p) => p.date <= to) || scaledSeries[scaledSeries.length - 1];
  const chartDataRaw = scaledSeries.filter((p) => p.date >= rangeStartPoint.date && p.date <= rangeEndPoint.date);
  const investedSeries = useMemo(
    () => buildInvestedSeries(byBroker, chartDataRaw.map((p) => p.date)),
    [byBroker, chartDataRaw.length ? chartDataRaw[0].date : null, chartDataRaw.length ? chartDataRaw[chartDataRaw.length - 1].date : null]
  );
  const chartData = chartDataRaw.map((p, i) => ({ ...p, invertido: investedSeries[i]?.invertido ?? null }));
  // Ganancia neta real del PERÍODO elegido: se compara la "ganancia no
  // realizada" (valor - costo invertido de lo que tenés) al final del rango
  // contra la misma foto al principio del rango. Restar así, en vez de comparar
  // directo valor final vs. costo final, es lo que hace que el número cambie
  // según elijas 7D/90D/Todo -- antes siempre anclaba al costo de HOY sin
  // importar el rango, y por eso daba igual en cualquier período.
  const investedAtStart = investedSeries[0]?.invertido || 0;
  const investedAtEnd = investedSeries[investedSeries.length - 1]?.invertido || 0;
  const netContribInRange = investedAtEnd - investedAtStart;
  const pnlAbs = (rangeEndPoint.total - investedAtEnd) - (rangeStartPoint.total - investedAtStart);
  const pnlBase = rangeStartPoint.total + Math.max(netContribInRange, 0);
  const pnlPct = pnlBase !== 0 ? (pnlAbs / pnlBase) * 100 : 0;
  const chartTrades = MOVIMIENTOS.filter(
    (m) =>
      (m.tipo === "Compra" || m.tipo === "Venta") &&
      m.precio > 0 && // splits/acciones recibidas a costo 0 no son "operaciones" visibles
      (brokerFilter === "Todas" || m.broker === brokerFilter) &&
      m.fecha >= chartData[0]?.date &&
      m.fecha <= chartData[chartData.length - 1]?.date
  ).map((m) => {
    const point = chartData.find((p) => p.date === m.fecha) || [...chartData].reverse().find((p) => p.date <= m.fecha);
    return { ...m, y: point ? point.total : null };
  }).filter((m) => m.y != null);

  const current = scaledSeries[scaledSeries.length - 1];
  // "Ayer" real: caminamos hacia atrás hasta encontrar el último punto con un
  // valor genuinamente distinto al de hoy. Esto evita un bug donde, si el
  // caché diario (una vez al día) todavía no tiene un cierre propio para la
  // fecha de HOY, el punto "hoy" cae al mismo último precio cacheado que
  // "ayer" -- y quedaban idénticos, mostrando siempre +US$0 (+0.0%) aunque
  // el mercado sí se haya movido.
  let yesterdayIdx = scaledSeries.length - 2;
  while (yesterdayIdx > 0 && scaledSeries[yesterdayIdx].total === current.total) yesterdayIdx--;
  const yesterday = scaledSeries[yesterdayIdx];

  const currentTotal = realCurrentTotal;
  const yesterdayTotal = yesterday.total;
  const dayAbs = currentTotal - yesterdayTotal;
  const dayPct = pct(currentTotal, yesterdayTotal);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .tabular { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .display { font-family: 'Fraunces', serif; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .recharts-wrapper:focus, .recharts-surface:focus { outline: none; }
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
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <select
                      value={brokerFilter}
                      onChange={(e) => { setBrokerFilter(e.target.value); setConfirmandoBorradoCartera(false); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        color: C.text,
                        cursor: "pointer",
                        fontWeight: 500,
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="Todas">Todas las carteras</option>
                      {BROKER_LIST.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {brokerFilter !== "Todas" && !confirmandoBorradoCartera && (
                      <button
                        onClick={() => setConfirmandoBorradoCartera(true)}
                        title={`Borrar todo lo de "${brokerFilter}"`}
                        style={{ display: "flex", alignItems: "center", padding: 6, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.loss, cursor: "pointer" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {confirmandoBorradoCartera && (
                    <div style={{ marginTop: 10, background: C.surface, border: `1px solid ${C.loss}`, borderRadius: 10, padding: 12, maxWidth: 320 }}>
                      <div style={{ fontSize: 12, color: C.loss, marginBottom: 8 }}>
                        Esto borra TODOS los movimientos y tenencias de "{brokerFilter}" (no toca otras carteras). No se puede deshacer.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={async () => {
                            setBorrandoCartera(true);
                            try {
                              await borrarCarteraCompleta(user.uid, brokerFilter);
                            } catch (err) {
                              setBorrandoCartera(false);
                            }
                          }}
                          disabled={borrandoCartera}
                          style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.loss, color: "#fff", fontSize: 12, cursor: borrandoCartera ? "default" : "pointer", opacity: borrandoCartera ? 0.6 : 1 }}
                        >
                          {borrandoCartera ? "Borrando..." : "Sí, borrar todo"}
                        </button>
                        <button onClick={() => setConfirmandoBorradoCartera(false)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
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
                      Ganancia neta (valor actual vs. invertido) {useCustom ? `· al ${to}` : ""}
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

                <div style={{ height: 340, marginTop: 4, position: "relative" }}>
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
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: C.faint, fontSize: 10 }}
                        tickFormatter={(v) => fmtCompact(v, currency, fx)}
                        axisLine={{ stroke: C.border }}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip content={<HomeChartTooltip C={C} f={f} />} />
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
                        {[
                          { key: "name", label: "Activo", align: "left", pad: "10px 18px" },
                          { key: "value", label: "Valor actual", align: "right", pad: "10px 12px" },
                          { key: "qty", label: "Cantidad", align: "right", pad: "10px 12px" },
                          { key: "avgCost", label: "PPC", align: "right", pad: "10px 12px" },
                          { key: "price", label: "Precio", align: "right", pad: "10px 12px" },
                          { key: "pl", label: "P&L", align: "right", pad: "10px 18px" },
                        ].map((col) => (
                          <th
                            key={col.key}
                            onClick={() =>
                              setTenenciasSort((prev) =>
                                prev.key === col.key ? { key: col.key, dir: -prev.dir } : { key: col.key, dir: -1 }
                              )
                            }
                            style={{ padding: col.pad, fontWeight: 500, textAlign: col.align, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                          >
                            {col.label}
                            {tenenciasSort.key === col.key && <span style={{ marginLeft: 4, opacity: 0.7 }}>{tenenciasSort.dir === 1 ? "↑" : "↓"}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consolidateByName(filteredHoldings)
                        .map((h) => {
                          const value = h.qty * h.price;
                          const cost = h.qty * h.avgCost;
                          const p = pct(value, cost);
                          return { ...h, value, cost, p };
                        })
                        .sort((a, b) => {
                          const { key, dir } = tenenciasSort;
                          if (key === "name") return dir * a.name.localeCompare(b.name);
                          const field = key === "pl" ? "p" : key;
                          return dir * (a[field] - b[field]);
                        })
                        .map((h) => {
                          const value = h.value;
                          const p = h.p;
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
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: C.muted }}>{h.qty.toLocaleString("es-AR", { maximumFractionDigits: 3 })}</td>
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: C.muted }}>{f(h.avgCost)}</td>
                              <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                  {enVivo && <span style={{ width: 5, height: 5, borderRadius: 999, background: C.gain, display: "inline-block" }} />}
                                  {f(h.price)}
                                </div>
                                {livePctChange[h.name] != null && (
                                  <div style={{ fontSize: 11, color: livePctChange[h.name] >= 0 ? C.gain : C.loss, marginTop: 1 }}>
                                    {livePctChange[h.name] >= 0 ? "+" : ""}{livePctChange[h.name].toFixed(1)}%
                                  </div>
                                )}
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

          {view === "novedades" && <NovedadesView C={C} f={f} fx={fx} />}
          {view === "calculadora" && <CalculadoraView currency={currency} fx={fx} f={f} C={C} livePrices={livePrices} cryptoUsd={cryptoUsd} historyCache={historyCache} />}
          {view === "importar" && <ImportarView C={C} user={user} fx={fx} />}
          {view === "buscar" && <BuscarView key={jumpSymbol || "default"} currency={currency} fx={fx} f={f} C={C} Cinv={Cinv} livePrices={livePrices} liveCatalog={liveCatalog} cryptoUsd={cryptoUsd} historyCache={historyCache} initialSymbol={jumpSymbol} />}
          {view === "pnl" && <PnlFechaView currency={currency} fx={fx} f={f} C={C} historyCache={historyCache} livePrices={livePrices} cryptoUsd={cryptoUsd} />}
          {view === "movimientos" && <MovimientosView f={f} C={C} />}
          {view === "manual" && <ManualView f={f} C={C} />}
          {view === "config" && <ConfigView currency={currency} setCurrency={setCurrency} fxType={fxType} setFxType={setFxType} C={C} fxRates={activeFxRates} liveStatus={liveStatus} livePrices={livePrices} user={user} />}
        </div>
      </div>
    </div>
  );
}

function BuscarView({ currency, fx, f, C, Cinv, livePrices, liveCatalog, cryptoUsd, historyCache, initialSymbol }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => ASSET_UNIVERSE_FULL.find((a) => a.symbol === initialSymbol) || ASSET_UNIVERSE_FULL[0]);
  const [rangeIdx, setRangeIdx] = useState(1);
  const [posExpanded, setPosExpanded] = useState(false);
  const [hoverDot, setHoverDot] = useState(null);
  const [livePriceUsd, setLivePriceUsd] = useState(null); // solo para cripto, polling propio
  const [assetMode, setAssetMode] = useState("cedear"); // "cedear" | "accion" -- solo aplica a CEDEARs
  const [accionLiveUsd, setAccionLiveUsd] = useState(null);
  const [measurePoints, setMeasurePoints] = useState([]); // hasta 2 puntos tocados en el gráfico
  const [hoverPoint, setHoverPoint] = useState(null); // circulito visual propio, no el de Recharts
  const [measurePixels, setMeasurePixels] = useState({}); // posición en píxeles de cada punto elegido, para dibujar la recta y el cartel
  const lastHoverPoint = useRef(null);

  React.useEffect(() => { setMeasurePoints([]); setMeasurePixels({}); }, [selected, rangeIdx]);

  // Modo "Acción": cotización real de EE.UU. en vivo vía Finnhub, polling cada
  // 5s mientras estás mirando ese activo (igual que hacemos con cripto).
  React.useEffect(() => {
    if (!(selected.cat === "CEDEARs" && assetMode === "accion")) { setAccionLiveUsd(null); return; }
    let cancelled = false;
    const poll = () => {
      fetchFinnhubQuote(selected.symbol).then((price) => {
        if (!cancelled && price != null) setAccionLiveUsd(price);
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selected, assetMode]);

  // Cripto: además del precio ya cargado al entrar, hace polling propio cada
  // 5s directo a CoinGecko mientras estás mirando ese activo -- así se siente
  // realmente en vivo, segundo a segundo, como pediste.
  React.useEffect(() => {
    if (selected.cat !== "Cripto") { setLivePriceUsd(null); return; }
    let cancelled = false;
    const poll = () => {
      fetchCryptoPricesUsd().then((prices) => {
        if (!cancelled && prices[selected.symbol] != null) setLivePriceUsd(prices[selected.symbol]);
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selected]);

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

  const days = CHART_RANGES[rangeIdx].days;

  // Histórico: cripto sale en vivo de CoinGecko (real, segundo a segundo).
  // Acciones/CEDEARs/bonos NO se piden en vivo por activo -- eso fue lo que
  // saturaba a data912. Salen del mismo archivo cacheado una vez al día que
  // usa el gráfico de Inicio (public/data/history.json).
  // Histórico: sale del mismo archivo cacheado una vez al día que usa el resto
  // de los activos (acciones/CEDEARs/bonos/cripto) -- ya no se le pide en vivo
  // a CoinGecko el año completo de datos, eso fue lo que disparó el límite de
  // pedidos gratis. El precio ACTUAL de cripto sigue en vivo (más abajo).
  const cachedHistory = historyCache[selected.symbol];
  const realHistory = cachedHistory;
  const historyStatus = cachedHistory && cachedHistory.length > 1 ? "ok" : "no-disponible";

  const isCedear = selected.cat === "CEDEARs";
  const mode = isCedear ? assetMode : "cedear";

  const rawSliced = historyStatus === "ok" ? realHistory.slice(-days) : series.slice(-days);

  // Precio real: cripto usa el polling propio (más fresco, cada 5s); el resto
  // sale del panel en vivo de data912 (bonos vienen cada 100 nominal, /100).
  // Modo "Acción": Finnhub en vivo si hay API key configurada; si no, cae al
  // último cierre cacheado (se avisa en la interfaz cuál de los dos es).
  const liveRaw = livePrices[selected.symbol];
  let realLivePrice = null;
  if (selected.cat === "Cripto" && livePriceUsd != null) realLivePrice = livePriceUsd * fx;
  else if (selected.cat === "Cripto" && cryptoUsd[selected.symbol] != null) realLivePrice = cryptoUsd[selected.symbol] * fx;
  else if (mode === "accion" && accionLiveUsd != null) realLivePrice = accionLiveUsd * fx;
  else if (mode === "cedear" && liveRaw != null) realLivePrice = selected.cat === "Bonos" ? liveRaw / 100 : liveRaw;

  const isLive = realLivePrice != null;

  // Modo "Acción": el histórico cacheado ya es el precio real en dólares --
  // se convierte a la escala interna (ARS-equivalente) para reutilizar todo
  // el resto del formateo/gráfico sin duplicar lógica. Si Finnhub está
  // disponible, también se reajusta al último precio en vivo real.
  // Modo "CEDEAR": los CEDEARs cotizan según una "ratio" propia (no es 1:1 con
  // la acción real), y no la tenemos. Se reajusta el histórico para que el
  // último punto coincida con el precio en vivo real del CEDEAR -- la forma
  // de la curva (% de variación) sigue siendo la real.
  let sliced;
  if (mode === "accion") {
    const rawLast = rawSliced[rawSliced.length - 1]?.price || 1;
    const scaleFix = isLive && historyStatus === "ok" && rawLast > 0 ? realLivePrice / (rawLast * fx) : 1;
    sliced = rawSliced.map((p) => ({ ...p, price: p.price * fx * scaleFix }));
  } else {
    const rawLast = rawSliced[rawSliced.length - 1]?.price || 1;
    const scaleFix = isLive && historyStatus === "ok" && rawLast > 0 ? realLivePrice / rawLast : 1;
    sliced = scaleFix !== 1 ? rawSliced.map((p) => ({ ...p, price: p.price * scaleFix })) : rawSliced;
  }
  const first = sliced[0].price;
  const lastRaw = sliced[sliced.length - 1].price;

  const last = isLive ? realLivePrice : lastRaw;
  const abs = last - first;
  const p = pct(last, first);

  const coupons = COUPON_SCHEDULE[selected.symbol] || [];
  const events = CORPORATE_EVENTS[selected.symbol] || [];
  const held = consolidateByName(HOLDINGS.filter((h) => h.name === selected.symbol))[0];
  if (held) held.price = liveAdjustedPrice(held, livePrices, fx, cryptoUsd);
  const heldQty = held?.qty || 0;
  const symbolTrades = MOVIMIENTOS.filter((m) => m.activo === selected.symbol && (m.tipo === "Compra" || m.tipo === "Venta")).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const today = SERIES[SERIES.length - 1].date;
  const daysUntil = (dateStr) => Math.round((new Date(dateStr) - new Date(today)) / 86400000);

  // Marcas de compra/venta sobre el gráfico, a partir de tus movimientos reales.
  const trades = MOVIMIENTOS.filter(
    (m) => m.activo === selected.symbol && (m.tipo === "Compra" || m.tipo === "Venta") && m.precio > 0 && m.fecha >= sliced[0].date && m.fecha <= sliced[sliced.length - 1].date
  ).map((m) => {
    const point = sliced.find((p) => p.date === m.fecha) || [...sliced].reverse().find((p) => p.date <= m.fecha);
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>{selected.symbol}</span>
              <span style={{ fontSize: 12, color: C.faint }}>{selected.name}</span>
              {isLive && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.gain, marginLeft: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: C.gain, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  en vivo
                </span>
              )}
              {isCedear && (
                <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 999, overflow: "hidden", marginLeft: 4 }}>
                  {[
                    { key: "cedear", label: "CEDEAR" },
                    { key: "accion", label: "Acción" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setAssetMode(m.key)}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        background: assetMode === m.key ? C.gold : "transparent",
                        color: assetMode === m.key ? C.bg : C.muted,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="tabular" style={{ fontSize: 28, fontWeight: 600 }}>{f(last)}</div>
            <div className="tabular" style={{ fontSize: 13, color: abs >= 0 ? C.gain : C.loss, marginTop: 2 }}>
              {abs >= 0 ? "+" : ""}{f(abs)} ({p >= 0 ? "+" : ""}{p.toFixed(2)}%) · {CHART_RANGES[rangeIdx].label}
            </div>
            {mode === "accion" && (
              <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                {isLive
                  ? "Precio real de la acción en EE.UU., en vivo vía Finnhub."
                  : "Precio real de la acción en EE.UU., en dólares — cierre del último día cacheado."}
              </div>
            )}
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
            <AreaChart
              data={sliced}
              margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
              style={{ cursor: "crosshair" }}
            >
              <defs>
                <linearGradient id="fillAsset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={abs >= 0 ? C.gain : C.loss} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={abs >= 0 ? C.gain : C.loss} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.rowLine} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.faint, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={40} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: C.faint, fontSize: 10 }}
                tickFormatter={(v) => fmtCompact(v, currency, fx)}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                width={56}
              />
              <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} formatter={(v) => [f(v), "Precio"]} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={abs >= 0 ? C.gain : C.loss}
                strokeWidth={2}
                fill="url(#fillAsset)"
                dot={false}
                activeDot={false}
              />
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
              {sliced.map((p, i) => (
                <ReferenceDot
                  key={`hit-${i}`}
                  x={p.date}
                  y={p.price}
                  r={1}
                  fill="transparent"
                  stroke="none"
                  shape={(props) => (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={9}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoverPoint({ x: props.cx, y: props.cy })}
                      onMouseLeave={() => setHoverPoint(null)}
                      onClick={() => {
                        const point = { date: p.date, price: p.price };
                        setMeasurePoints((prev) => {
                          if (prev.length >= 2) return [point];
                          if (prev.length === 1 && prev[0].date === point.date) return prev;
                          return [...prev, point];
                        });
                      }}
                    />
                  )}
                />
              ))}
              {hoverPoint && (
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={abs >= 0 ? C.gain : C.loss} stroke={C.bg} strokeWidth={2} style={{ pointerEvents: "none" }} />
              )}
              {measurePoints.map((mp, i) => (
                <ReferenceDot
                  key={`measure-${i}`}
                  x={mp.date}
                  y={mp.price}
                  r={6}
                  fill={C.gold}
                  stroke={C.bg}
                  strokeWidth={2}
                  isFront
                  shape={(props) => {
                    // Guardamos la posición en píxeles de este punto para poder
                    // dibujar la recta y ubicar el cartel flotante afuera del SVG.
                    if (measurePixels[i]?.x !== props.cx || measurePixels[i]?.y !== props.cy) {
                      setTimeout(() => setMeasurePixels((prev) => ({ ...prev, [i]: { x: props.cx, y: props.cy } })), 0);
                    }
                    return <circle cx={props.cx} cy={props.cy} r={6} fill={C.gold} stroke={C.bg} strokeWidth={2} style={{ pointerEvents: "none" }} />;
                  }}
                />
              ))}
              {measurePoints.length === 2 && (
                <ReferenceLine
                  segment={[
                    { x: measurePoints[0].date, y: measurePoints[0].price },
                    { x: measurePoints[1].date, y: measurePoints[1].price },
                  ]}
                  stroke={C.gold}
                  strokeWidth={1.5}
                />
              )}
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
          {measurePoints.length === 2 && measurePixels[0] && measurePixels[1] && (() => {
            const [pa, pb] = measurePoints[0].date <= measurePoints[1].date ? measurePoints : [measurePoints[1], measurePoints[0]];
            const [pxa, pxb] = measurePoints[0].date <= measurePoints[1].date ? [measurePixels[0], measurePixels[1]] : [measurePixels[1], measurePixels[0]];
            const diff = pb.price - pa.price;
            const diffPct = pct(pb.price, pa.price);
            const up = diff >= 0;
            const midX = (pxa.x + pxb.x) / 2;
            const midY = Math.min(pxa.y, pxb.y) - 14;
            return (
              <div
                className="tabular"
                style={{
                  position: "absolute",
                  left: midX,
                  top: midY,
                  transform: "translate(-50%, -100%)",
                  background: Cinv.bg,
                  color: Cinv.text,
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                }}
              >
                <div>{pa.date} → {pb.date}</div>
                <div style={{ color: up ? C.gain : C.loss, fontWeight: 600, marginTop: 2 }}>
                  {up ? "+" : ""}{f(diff)} ({up ? "+" : ""}{diffPct.toFixed(2)}%)
                </div>
              </div>
            );
          })()}
        </div>

        {/* El resultado de la comparación ahora se ve flotando sobre el gráfico (arriba de
            la recta dorada). Acá abajo solo queda el hint mientras elegís los puntos. */}
        {measurePoints.length === 0 && (
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>Tocá dos puntos del gráfico para comparar precios entre esas fechas.</div>
        )}
        {measurePoints.length === 1 && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            {measurePoints[0].date}: {f(measurePoints[0].price)} · tocá otro punto para comparar.
          </div>
        )}
        {measurePoints.length === 2 && (
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
            <button
              onClick={() => { setMeasurePoints([]); setMeasurePixels({}); }}
              style={{ fontSize: 11, color: C.faint, background: "none", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", cursor: "pointer" }}
            >
              limpiar comparación ×
            </button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: isLive ? C.gain : mode === "accion" && historyStatus === "ok" ? C.muted : C.faint }}>
            {isLive && <span style={{ width: 5, height: 5, borderRadius: 999, background: C.gain, display: "inline-block", animation: "pulse 1.5s infinite" }} />}
            {isLive
              ? `Precio en vivo${selected.cat === "Cripto" ? " (CoinGecko, cada 20s)" : mode === "accion" ? " (Finnhub, cada 20s)" : " (data912)"}.`
              : mode === "accion" && historyStatus === "ok"
              ? "Precio real de la acción, último cierre (no en vivo — configurá FINNHUB_API_KEY para tenerlo en vivo)."
              : historyStatus === "ok"
              ? "Precio real, último cierre disponible (se actualiza una vez al día, no en vivo)."
              : "Precio simulado — no encontramos cotización para este símbolo todavía."}
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
        {historyStatus !== "cargando" && (
          <div style={{ fontSize: 10, color: historyStatus === "ok" ? C.gain : C.faint, marginTop: 4 }}>
            {historyStatus === "ok"
              ? "Histórico real, actualizado una vez al día (caché)."
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

// --- Calculadora de aportes periódicos (DCA) -------------------------------
// "Si hubiera metido $X cada N meses en TICKER desde tal fecha, ¿cuánto
// tendría hoy?". Usa el mismo historyCache (ARS, cacheado a diario) que el
// resto de la app, reescalado para que el último punto coincida con el precio
// en vivo real -- igual truco que "Buscar activo". Limitación conocida y
// declarada en la interfaz: no tenemos tipo de cambio histórico día a día,
// así que un monto ingresado en USD se pasa a pesos con el dólar de HOY para
// cada aporte (no con el dólar del día de cada aporte). El *precio* del
// activo en cada fecha sí es el real/histórico.
function CalculadoraView({ currency, fx, f, C, livePrices, cryptoUsd, historyCache }) {
  const withData = ASSET_UNIVERSE_FULL.filter((a) => (historyCache[a.symbol] || []).length > 1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => withData.find((a) => a.symbol === "BTC") || withData[0] || ASSET_UNIVERSE_FULL[0]);
  const [montoStr, setMontoStr] = useState("100");
  const [moneda, setMoneda] = useState("USD");
  const [frecuencia, setFrecuencia] = useState(1);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });

  const results =
    query.trim() === ""
      ? []
      : ASSET_UNIVERSE_FULL.filter(
          (a) => a.symbol.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 30);

  const hist = historyCache[selected.symbol];
  const hasHistory = hist && hist.length > 1;

  const calc = useMemo(() => {
    if (!hasHistory) return null;
    const monto = parseFloat(montoStr);
    const freq = Math.max(1, Math.round(frecuencia));
    if (!monto || monto <= 0 || !fechaInicio || fechaInicio > todayStr) return null;

    // Precio en vivo real (ARS interno), igual criterio que "Buscar activo".
    let livePriceArs = null;
    if (selected.cat === "Cripto" && cryptoUsd[selected.symbol] != null) livePriceArs = cryptoUsd[selected.symbol] * fx;
    else if (livePrices[selected.symbol] != null) livePriceArs = selected.cat === "Bonos" ? livePrices[selected.symbol] / 100 : livePrices[selected.symbol];

    const lastHistPrice = hist[hist.length - 1].price;
    const scaleFix = livePriceArs != null && lastHistPrice > 0 ? livePriceArs / lastHistPrice : 1;
    const currentPriceArs = livePriceArs ?? lastHistPrice;

    const historyMap = {};
    for (const p of hist) historyMap[p.date] = p.price * scaleFix;
    const sortedDates = Object.keys(historyMap).sort();
    const firstAvailable = sortedDates[0];

    const montoArs = moneda === "USD" ? monto * fx : monto;

    const purchases = [];
    let i = 0;
    let cumQty = 0;
    let cumInvertido = 0;
    while (true) {
      const fecha = addMonths(fechaInicio, i * freq);
      if (fecha > todayStr) break;
      if (i > 1200) break; // resguardo ante frecuencia inválida
      let precio = priceAt(historyMap, sortedDates, fecha);
      let estimado = false;
      if (precio == null) {
        precio = historyMap[firstAvailable];
        estimado = true;
      }
      const cantidad = precio > 0 ? montoArs / precio : 0;
      cumQty += cantidad;
      cumInvertido += montoArs;
      purchases.push({ fecha, precio, monto: montoArs, cantidad, estimado, valorAcumulado: cumQty * precio });
      i++;
    }

    const totalQty = cumQty;
    const totalInvertidoArs = cumInvertido;
    const valorActualArs = totalQty * currentPriceArs;
    const gananciaArs = valorActualArs - totalInvertidoArs;
    const gananciaPct = pct(valorActualArs, totalInvertidoArs);
    const precioPromedio = totalQty > 0 ? totalInvertidoArs / totalQty : 0;

    const chartData = purchases.map((p) => ({ date: p.fecha, valor: p.valorAcumulado, invertido: purchases.filter((x) => x.fecha <= p.fecha).length * montoArs }));
    if (chartData.length > 0 && chartData[chartData.length - 1].date !== todayStr) {
      chartData.push({ date: todayStr, valor: valorActualArs, invertido: totalInvertidoArs });
    }

    return { purchases, totalQty, totalInvertidoArs, valorActualArs, gananciaArs, gananciaPct, precioPromedio, currentPriceArs, chartData, coverageStart: firstAvailable };
  }, [hasHistory, hist, montoStr, moneda, frecuencia, fechaInicio, todayStr, selected, livePrices, cryptoUsd, fx]);

  return (
    <div>
      <SectionTitle C={C} sub="Simulá cuánto tendrías hoy si hubieras invertido un monto fijo cada cierto tiempo en un activo, desde una fecha determinada.">
        Calculadora
      </SectionTitle>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={15} color={C.faint} style={{ position: "absolute", left: 12, top: 10 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscá el activo — ej: BTC, SPY, GGAL..."
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 12px 9px 34px", fontSize: 13 }}
        />
      </div>

      {query.trim() !== "" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {results.map((a) => {
            const dataOk = (historyCache[a.symbol] || []).length > 1;
            return (
              <button
                key={a.symbol}
                onClick={() => { setSelected(a); setQuery(""); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: `1px solid ${selected.symbol === a.symbol ? C.gold : C.border}`,
                  background: selected.symbol === a.symbol ? C.chipActive : "transparent",
                  color: selected.symbol === a.symbol ? C.gold : dataOk ? C.muted : C.faint,
                  cursor: "pointer",
                  fontWeight: 500,
                  opacity: dataOk ? 1 : 0.6,
                }}
                title={dataOk ? undefined : "Sin histórico de precios disponible todavía"}
              >
                {a.symbol} <span style={{ opacity: 0.7 }}>· {a.cat}</span>
              </button>
            );
          })}
          {results.length === 0 && <span style={{ fontSize: 13, color: C.faint }}>No encontramos nada con ese nombre.</span>}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>{selected.symbol}</span>
          <span style={{ fontSize: 12, color: C.faint }}>{selected.name}</span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Monto por aporte
            <div style={{ display: "flex" }}>
              <input
                type="number"
                min="0"
                value={montoStr}
                onChange={(e) => setMontoStr(e.target.value)}
                style={{ width: 110, background: C.bg, border: `1px solid ${C.border}`, borderRight: "none", color: C.text, borderRadius: "6px 0 0 6px", padding: "6px 10px", fontSize: 13 }}
              />
              <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: "0 6px 6px 0", overflow: "hidden" }}>
                {["USD", "ARS"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMoneda(m)}
                    style={{ padding: "0 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: moneda === m ? C.gold : "transparent", color: moneda === m ? C.bg : C.muted }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Frecuencia
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: C.text }}>cada</span>
              <input
                type="number"
                min="1"
                value={frecuencia}
                onChange={(e) => setFrecuencia(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 56, background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: C.text }}>{frecuencia === 1 ? "mes" : "meses"}</span>
            </div>
          </label>

          <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
            Desde
            <input
              type="date"
              value={fechaInicio}
              max={todayStr}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            />
          </label>
        </div>

        {!hasHistory && (
          <div style={{ marginTop: 14, fontSize: 12, color: C.loss }}>
            Todavía no tenemos histórico de precios cacheado para {selected.symbol}, así que no podemos simular aportes pasados.
          </div>
        )}
      </div>

      {calc && (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "22px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Tendrías hoy</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <span className="tabular display" style={{ fontSize: 32, fontWeight: 600 }}>{f(calc.valorActualArs)}</span>
              {calc.gananciaArs >= 0 ? <TrendingUp size={20} color={C.gain} /> : <TrendingDown size={20} color={C.loss} />}
            </div>
            <div className="tabular" style={{ fontSize: 15, color: calc.gananciaArs >= 0 ? C.gain : C.loss, marginBottom: 20 }}>
              {calc.gananciaArs >= 0 ? "+" : ""}{f(calc.gananciaArs)} ({calc.gananciaPct >= 0 ? "+" : ""}{calc.gananciaPct.toFixed(1)}%) sobre lo invertido
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14 }}>
              {[
                { label: "Invertido en total", value: f(calc.totalInvertidoArs) },
                { label: "Aportes realizados", value: calc.purchases.length },
                { label: `Cantidad de ${selected.symbol}`, value: calc.totalQty.toLocaleString("es-AR", { maximumFractionDigits: calc.totalQty < 1 ? 8 : 4 }) },
                { label: "Precio promedio de compra", value: f(calc.precioPromedio) },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{s.label}</div>
                  <div className="tabular" style={{ fontSize: 15, fontWeight: 600 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {calc.purchases.some((p) => p.estimado) && (
              <div style={{ marginTop: 16, fontSize: 11, color: C.faint }}>
                Algunos aportes caen antes de nuestro histórico real de precios ({calc.coverageStart}) y se estimaron con el primer precio disponible.
                {moneda === "USD" && " El monto en USD de cada aporte se convirtió a pesos con el tipo de cambio de hoy, no con el de cada fecha histórica (no tenemos series de tipo de cambio históricas)."}
              </div>
            )}
          </div>

          {calc.chartData.length > 1 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Evolución del valor vs. lo invertido</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={calc.chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillCalc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.rowLine} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: C.faint, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={40} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: C.faint, fontSize: 10 }} tickFormatter={(v) => fmtCompact(v, currency, fx)} axisLine={{ stroke: C.border }} tickLine={false} width={56} />
                    <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} formatter={(v, name) => [f(v), name]} />
                    <Area type="monotone" dataKey="valor" name="Valor" stroke={C.gold} strokeWidth={2} fill="url(#fillCalc)" />
                    <Line type="monotone" dataKey="invertido" name="Invertido" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>Detalle de aportes ({calc.purchases.length})</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: C.surface }}>
                    <th style={{ textAlign: "left", padding: "8px 18px", color: C.faint, fontWeight: 500, fontSize: 11 }}>Fecha</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: C.faint, fontWeight: 500, fontSize: 11 }}>Precio</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: C.faint, fontWeight: 500, fontSize: 11 }}>Aporte</th>
                    <th style={{ textAlign: "right", padding: "8px 18px", color: C.faint, fontWeight: 500, fontSize: 11 }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {[...calc.purchases].reverse().map((p, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.rowLine}` }}>
                      <td className="tabular" style={{ padding: "8px 18px", color: C.muted }}>
                        {p.fecha}{p.estimado && <span style={{ color: C.faint }}> ~</span>}
                      </td>
                      <td className="tabular" style={{ padding: "8px 12px", textAlign: "right" }}>{f(p.precio)}</td>
                      <td className="tabular" style={{ padding: "8px 12px", textAlign: "right" }}>{f(p.monto)}</td>
                      <td className="tabular" style={{ padding: "8px 18px", textAlign: "right", color: C.muted }}>
                        {p.cantidad.toLocaleString("es-AR", { maximumFractionDigits: p.cantidad < 1 ? 8 : 4 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Tooltip del gráfico de "Ganancia neta" en Inicio: además de Invertido/Valor
// actual (que ya traía el tooltip por defecto de Recharts), agrega una línea
// con el % de ganancia o pérdida entre esos dos valores para ese punto.
function HomeChartTooltip({ active, payload, label, C, f }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.find((p) => p.dataKey === "total")?.value;
  const invertido = payload.find((p) => p.dataKey === "invertido")?.value;
  const gananciaPct = invertido ? pct(total, invertido) : null;
  const isGain = gananciaPct != null && gananciaPct >= 0;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, padding: "8px 12px" }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name} : {f(p.value)}
        </div>
      ))}
      {gananciaPct != null && (
        <div style={{ color: isGain ? C.gain : C.loss, marginTop: 4, fontWeight: 600 }}>
          {isGain ? "Ganancia" : "Pérdida"} {Math.abs(gananciaPct).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// Novedades de mi cartera -- junta los eventos (balances, dividendos, cupones
// de bonos) de CORPORATE_EVENTS y COUPON_SCHEDULE, pero solo de los activos
// que REALMENTE tenés en HOLDINGS (no cualquier ticker del universo de
// búsqueda), y solo los que todavía no pasaron, ordenados por fecha.
function NovedadesView({ C, f, fx }) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const heldQty = {};
  for (const h of HOLDINGS) heldQty[h.name] = (heldQty[h.name] || 0) + h.qty;
  const heldTickers = Object.keys(heldQty).filter((t) => heldQty[t] > 0);

  const events = [];
  for (const ticker of heldTickers) {
    for (const e of CORPORATE_EVENTS[ticker] || []) {
      events.push({ ticker, fecha: e.fecha, tipo: e.tipo, detalle: e.detalle });
    }
    for (const c of COUPON_SCHEDULE[ticker] || []) {
      const qty = heldQty[ticker] || 0;
      const montoTotalUsd = (c.monto * qty) / 100; // el monto viene cada 100 nominal
      events.push({
        ticker,
        fecha: c.fecha,
        tipo: c.tipo,
        detalle: `US$${c.monto} por cada 100 nominal${qty > 0 ? ` · vos tenés ${qty.toLocaleString("es-AR")} → ~${f(montoTotalUsd * fx)}` : ""}`,
      });
    }
  }

  const upcoming = events.filter((e) => e.fecha >= todayStr).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const daysUntil = (fecha) => Math.round((new Date(fecha) - new Date(todayStr)) / 86400000);

  return (
    <div>
      <SectionTitle C={C} sub="Balances, dividendos y cupones de bonos que se vienen, de los activos que ya tenés -- ordenados por fecha.">
        Novedades de mi cartera
      </SectionTitle>

      {upcoming.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", fontSize: 13, color: C.faint, textAlign: "center" }}>
          No tenemos eventos próximos cargados para tus tenencias actuales.
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {upcoming.map((e, i) => {
            const d = daysUntil(e.fecha);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "16px 20px",
                  borderTop: i > 0 ? `1px solid ${C.rowLine}` : "none",
                }}
              >
                <div style={{ minWidth: 76, textAlign: "center" }}>
                  <div className="tabular" style={{ fontSize: 12, color: C.faint }}>{e.fecha}</div>
                  <div style={{ fontSize: 11, color: C.gold, marginTop: 2 }}>
                    {d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{e.ticker}</span>
                    <span style={{ fontSize: 11, color: C.muted, background: C.chipActive, padding: "2px 8px", borderRadius: 999 }}>{e.tipo}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.muted }}>{e.detalle}</div>
                </div>
              </div>
            );
          })}
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

// --- Importar archivos --------------------------------------------------

// Balanz: mapea "Tipo de Instrumento" de su export a nuestras categorías.
function mapBalanzCategoria(tipoInstrumento) {
  const t = (tipoInstrumento || "").trim();
  if (t === "Cedears") return "CEDEARs";
  if (t === "Acciones") return "Acciones";
  if (t === "Bonos") return "Bonos";
  return "Acciones"; // fallback razonable, no debería pasar con el export real
}

// Excel guarda fechas como objetos Date (o a veces como string) según cómo
// las haya escrito la librería que las lee -- esto normaliza ambos casos al
// formato YYYY-MM-DD que usa el resto de la app.
function normalizeFecha(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

// Lee la hoja "movimientos" del export de Balanz y separa las filas en lo
// que se puede cargar automático (Compra/Venta/Split) y lo que se ignora a
// propósito porque no cambia cantidad de acciones (dividendos, rentas,
// movimientos manuales, recibos de cobro).
// Splits reales confirmados con datos de varias cuentas distintas -- se
// aplican para brokers ARGENTINOS de CEDEARs (ver PLATAFORMAS_CEDEAR_AR más
// abajo), aunque el archivo de la persona puntual no traiga la fila de
// "Dividendo en acciones" (pasa: algunos exports no la incluyen).
// "ratioExtra" es cuánto se agrega por cada unidad que ya tenías (ej: 2 =
// split 3 a 1, terminás con el triple).
//
// Por qué solo brokers argentinos: confirmado que el ratio de conversión de
// un CEDEAR lo define acá la CNV (Comisión Nacional de Valores) o el banco
// depositario (ej. Banco COMAFI), totalmente aparte de si la acción real
// en EEUU tuvo o no un split -- es un ajuste local, no una acción
// corporativa de la empresa. No aplica a alguien que tenga la acción real
// en un broker de EEUU, ni a exchanges de cripto (Nexo, Bybit, etc.).
//
// OJO: antes de agregar un split acá, confirmar el ratio con al menos 2
// cuentas reales distintas -- si el ratio no da limpio en todas, NO es un
// split proporcional real (puede ser otra cosa, como pasó con YPFD del
// 04/08/26, que dio 0.82 en una cuenta y 9.00 en otra -- eso NO se agrega
// acá, se deja que cada archivo lo traiga por su cuenta si corresponde).
const PLATAFORMAS_CEDEAR_AR = ["Balanz", "IOL", "Bull Market"];

const KNOWN_SPLITS = [
  { ticker: "SPY", fecha: "2026-06-01", ratioExtra: 2 }, // confirmado 3 a 1 en Balanz, IOL y Bull Market
];

// Revisa si algún split conocido falta en lo que se parseó de este archivo
// puntual, y si falta, lo agrega -- calculando la cantidad en base a lo que
// esta cuenta tenía hasta esa fecha (no un número fijo, cada cuenta tiene
// su propia base). "plataforma" es el broker/exchange real (para saber si
// aplica), "cuenta" es el nombre que la persona le puso a esa cartera
// puntual (puede diferir del nombre de la plataforma).
function aplicarSplitsConocidos(cargables, plataforma, cuenta) {
  if (!PLATAFORMAS_CEDEAR_AR.includes(plataforma)) return [];
  const extra = [];
  for (const split of KNOWN_SPLITS) {
    const yaEsta = cargables.some((m) => m.activo === split.ticker && m.tipo === "Split" && m.fecha === split.fecha);
    if (yaEsta) continue;

    const trades = cargables
      .filter((m) => m.activo === split.ticker && (m.tipo === "Compra" || m.tipo === "Venta") && m.fecha < split.fecha)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    let qty = 0;
    for (const t of trades) qty += (t.tipo === "Venta" ? -1 : 1) * t.cantidad;
    if (qty <= 0) continue; // esta cuenta no tenía el activo en esa fecha, no le corresponde

    extra.push({
      fecha: split.fecha,
      activo: split.ticker,
      tipo: "Split",
      cantidad: qty * split.ratioExtra,
      precio: 0,
      broker: cuenta,
      cat: cargables.find((m) => m.activo === split.ticker)?.cat || "CEDEARs",
    });
  }
  return extra;
}

// Dólar MEP de una fecha EXACTA -- ArgentinaDatos API, pública, sin key,
// sin problemas de CORS desde el navegador. Si esa fecha puntual no tuvo
// rueda (fin de semana/feriado), reintenta con el día hábil más cercano
// hacia atrás, hasta 5 días.
async function fetchHistoricalMep(fechaISO) {
  let d = new Date(fechaISO + "T12:00:00Z");
  for (let i = 0; i < 5; i++) {
    const fechaApi = d.toISOString().slice(0, 10).replaceAll("-", "/");
    try {
      const res = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa/${fechaApi}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.venta) return data.venta;
      }
    } catch {
      // sigue probando el día anterior
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return null; // no se pudo conseguir en 5 intentos -- el llamador decide el respaldo
}

async function parseBalanzMovimientos(rows, broker = "Balanz", fxHoy = 1) {
  const cargables = [];
  const ignoradas = {}; // { "Dividendo en efectivo": count, ... }

  // Primera pasada: arma las filas crudas y junta qué fechas exactas
  // necesitan dólar histórico (una sola vez por fecha, no por fila).
  const crudo = [];
  const fechasNecesarias = new Set();
  for (const row of rows) {
    const desc = String(row["Descripcion"] ?? "").trim();
    if (!desc) continue;
    const fecha = normalizeFecha(row["Concertacion"]);
    const ticker = row["Ticker"] ? String(row["Ticker"]).trim() : null;

    if (desc.startsWith("Boleto") && ticker) {
      const esCompra = /\bCOMPRA\b/.test(desc);
      const esVenta = /\bVENTA\b/.test(desc);
      const precio = Number(row["Precio"]);
      // Cuando la operación es en moneda extranjera, Balanz exporta cada
      // boleto como DOS filas: una con el precio real, y una "sombra" en
      // Pesos con precio -1 (su forma de marcar "no aplica acá"). Sin
      // filtrar esto, cada operación se contaba el doble.
      if ((esCompra || esVenta) && fecha && precio !== -1) {
        const moneda = String(row["Moneda"] ?? "").trim();
        const esDolares = moneda !== "" && moneda !== "Pesos";
        if (esDolares) fechasNecesarias.add(fecha);
        crudo.push({
          fecha,
          activo: ticker,
          tipo: esCompra ? "Compra" : "Venta",
          // Balanz anota las ventas con cantidad negativa -- acá siempre
          // guardamos el valor absoluto, el signo ya lo da "tipo".
          cantidad: Math.abs(Number(row["Cantidad"]) || 0),
          precioOriginal: precio || 0,
          esDolares,
          broker,
          cat: mapBalanzCategoria(row["Tipo de Instrumento"]),
        });
        continue;
      }
    }

    if (desc.startsWith("Dividendo en acciones") && ticker && fecha) {
      cargables.push({
        fecha,
        activo: ticker,
        tipo: "Split",
        cantidad: Number(row["Cantidad"]) || 0,
        precio: 0,
        broker,
        cat: mapBalanzCategoria(row["Tipo de Instrumento"]),
      });
      continue;
    }

    // Todo lo demás (Dividendo en efectivo, Renta, Movimiento Manual, Recibo
    // de Cobro, Comprobante de Pago) no cambia cantidad de acciones -- se
    // cuenta para mostrarlo en el resumen, pero no se carga.
    const tipoIgnorado = desc.split("/")[0].trim();
    ignoradas[tipoIgnorado] = (ignoradas[tipoIgnorado] || 0) + 1;
  }

  // Busca el dólar MEP real de cada fecha exacta que hace falta -- una vez
  // por fecha (no por fila), y con pausa chica para no saturar la API.
  const fxPorFecha = {};
  for (const fecha of fechasNecesarias) {
    fxPorFecha[fecha] = await fetchHistoricalMep(fecha);
    await new Promise((r) => setTimeout(r, 150));
  }

  // Segunda pasada: aplica el dólar de cada fecha -- si no se consiguió (la
  // API falló, o ninguno de los 5 días previos tuvo rueda), cae al dólar de
  // hoy como respaldo, mejor que dejar el precio en dólares crudo.
  for (const m of crudo) {
    const precioFinal = m.esDolares ? m.precioOriginal * (fxPorFecha[m.fecha] || fxHoy) : m.precioOriginal;
    cargables.push({
      fecha: m.fecha,
      activo: m.activo,
      tipo: m.tipo,
      cantidad: m.cantidad,
      precio: precioFinal,
      broker: m.broker,
      cat: m.cat,
    });
  }

  const splitsFaltantes = aplicarSplitsConocidos(cargables, "Balanz", broker);
  return { cargables: [...cargables, ...splitsFaltantes], ignoradas };
}

// A partir de una lista de movimientos ya fusionada (los que ya tenías +
// los nuevos), recalcula HOLDINGS desde cero para un broker puntual --
// mismo método de costo promedio ponderado que ya usa el resto de la app
// (buildQtyTimeline/buildCostBasisTimeline), pero recibiendo el array
// directo en vez de leer el global, porque esto corre ANTES de guardar.
function recomputeHoldingsForBroker(allMovimientos, broker, prevHoldings, catByTicker) {
  const trades = allMovimientos.filter(
    (m) => m.broker === broker && (m.tipo === "Compra" || m.tipo === "Venta" || m.tipo === "Split")
  );
  const tickers = [...new Set(trades.map((m) => m.activo))];

  const result = [];
  for (const ticker of tickers) {
    const tickerTrades = trades.filter((m) => m.activo === ticker).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    let qty = 0, cost = 0;
    for (const t of tickerTrades) {
      if (t.tipo === "Compra" || t.tipo === "Split") {
        qty += t.cantidad;
        cost += t.cantidad * t.precio;
      } else if (qty > 0) {
        const avgCostPerUnit = cost / qty;
        const soldQty = Math.min(t.cantidad, qty);
        cost -= soldQty * avgCostPerUnit;
        qty -= soldQty;
      }
    }
    if (qty <= 0) continue; // posición cerrada del todo, no se lista
    const prev = prevHoldings.find((h) => h.name === ticker && h.broker === broker);
    result.push({
      name: ticker,
      cat: prev?.cat || catByTicker[ticker] || "Acciones",
      qty,
      avgCost: cost / qty,
      price: prev?.price ?? cost / qty, // sin precio en vivo todavía, usamos el costo como estimado inicial
      broker,
      manual: false,
    });
  }
  return result;
}

const BALANZ_INSTRUCTIONS = [
  { title: "Iniciá sesión en Balanz", desc: "Entrá a tu cuenta con tu usuario habitual." },
  { title: "Andá a \"Actividad\"", desc: "En el menú de la izquierda, buscá la opción \"Actividad\"." },
  { title: "Entrá a \"Movimientos\"", desc: "Dentro de Actividad, elegí la sección \"Movimientos\"." },
  { title: "Elegí el rango de fechas", desc: "Poné como \"desde\" la fecha de tu primera inversión, y como \"hasta\" hoy -- así se incluye todo tu historial." },
  { title: "Descargá el archivo", desc: "Tocá el botón de descarga. Va a bajar un archivo llamado movimientos.xlsx -- es el único que necesitás." },
  { title: "Subilo acá abajo", desc: "Arrastralo al recuadro, o hacé click para elegirlo desde tu computadora." },
];

// Borra por completo una cartera puntual (movimientos, tenencias e
// historial de importaciones) -- usable desde Importar archivos y desde
// Inicio. Recarga la página al final porque reasignar HOLDINGS/MOVIMIENTOS
// no alcanza para refrescar solas otras pantallas ya montadas.
async function borrarCarteraCompleta(uid, cuenta) {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.exists() ? snap.data() : {};
  const prevMovimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
  const prevHoldings = Array.isArray(data.holdings) ? data.holdings : [];
  const prevImportaciones = Array.isArray(data.importaciones) ? data.importaciones : [];

  const movimientosFinal = prevMovimientos.filter((m) => m.broker !== cuenta);
  const holdingsFinal = prevHoldings.filter((h) => h.broker !== cuenta);
  const importacionesFinal = prevImportaciones.filter((imp) => imp.broker !== cuenta);

  await setDoc(doc(db, "users", uid), { holdings: holdingsFinal, movimientos: movimientosFinal, importaciones: importacionesFinal });

  HOLDINGS = holdingsFinal;
  MOVIMIENTOS = movimientosFinal;
  BROKER_LIST = computeBrokerList();
  AUTO_ASSETS = computeAutoAssets();
  ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];
  EARLIEST_TRADE_DATE = computeEarliestTradeDate();

  window.location.reload();
}

function ImportarView({ C, user, fx }) {
  const [dragOver, setDragOver] = useState(false);
  const [broker, setBroker] = useState(null); // qué plataforma/parser -- ej "Balanz"
  const [cuenta, setCuenta] = useState(""); // nombre elegido para ESTA cuenta puntual, puede repetir plataforma
  const [status, setStatus] = useState("idle"); // idle | parsing | preview | guardando | listo | error
  const [preview, setPreview] = useState(null); // { fileName, cargables, ignoradas, prevMovimientos, prevHoldings, movimientosFinal, holdingsBalanz, bondsToConfirm }
  const [bondAnswers, setBondAnswers] = useState({}); // { [ticker]: {type:'keep'|'exclude'|'custom', qty?} | null }
  const [errorMsg, setErrorMsg] = useState("");
  const [importaciones, setImportaciones] = useState(null); // null = cargando, [] = sin historial todavía
  const [borrandoId, setBorrandoId] = useState(null);

  const cargarHistorial = async () => {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      setImportaciones(Array.isArray(data.importaciones) ? data.importaciones : []);
    } catch {
      setImportaciones([]);
    }
  };

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const borrarImportacion = async (importacion) => {
    setBorrandoId(importacion.id);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      const prevMovimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
      const prevHoldings = Array.isArray(data.holdings) ? data.holdings : [];
      const prevImportaciones = Array.isArray(data.importaciones) ? data.importaciones : [];

      const movimientosFinal = prevMovimientos.filter((m) => m.importId !== importacion.id);
      // Recalcula las tenencias de ese broker desde cero con lo que queda,
      // igual que al importar -- así no arrastra ningún resto del archivo
      // borrado. Los otros brokers no se tocan.
      const catByTicker = {};
      for (const h of prevHoldings) if (h.broker === importacion.broker) catByTicker[h.name] = h.cat;
      const holdingsOtroBroker = prevHoldings.filter((h) => h.broker !== importacion.broker);
      const holdingsRecalculado = recomputeHoldingsForBroker(movimientosFinal, importacion.broker, prevHoldings, catByTicker);
      const holdingsFinal = [...holdingsOtroBroker, ...holdingsRecalculado];
      const importacionesFinal = prevImportaciones.filter((imp) => imp.id !== importacion.id);

      await setDoc(doc(db, "users", user.uid), { holdings: holdingsFinal, movimientos: movimientosFinal, importaciones: importacionesFinal });

      HOLDINGS = holdingsFinal;
      MOVIMIENTOS = movimientosFinal;
      BROKER_LIST = computeBrokerList();
      AUTO_ASSETS = computeAutoAssets();
      ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];
      EARLIEST_TRADE_DATE = computeEarliestTradeDate();

      // Reasignar estas variables no alcanza para que se actualicen SOLAS
      // otras pantallas ya abiertas (Tenencias, Inicio, etc.) -- recargamos
      // la página para que todo se lea de cero, sin nada viejo en memoria.
      window.location.reload();
    } catch (err) {
      setErrorMsg(err.message || "No pudimos borrar esa importación.");
    } finally {
      setBorrandoId(null);
    }
  };

  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  // Botón de emergencia para importaciones que pasaron ANTES de que
  // existiera el borrado por importación puntual (esas no tienen importId,
  // así que no se pueden identificar una por una) -- borra TODO lo de ese
  // broker (movimientos, tenencias e historial) para poder reimportar limpio.
  const resetearBroker = async (brokerAResetear) => {
    setReseteando(true);
    setErrorMsg("");
    try {
      await borrarCarteraCompleta(user.uid, brokerAResetear);
    } catch (err) {
      setErrorMsg(err.message || "No pudimos borrar esos datos.");
    } finally {
      setReseteando(false);
    }
  };

  const handleFile = async (file) => {
    setStatus("parsing");
    setErrorMsg("");
    try {
      const { default: ExcelJS } = await import("exceljs");
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const sheet = wb.worksheets.find((s) => s.name.toLowerCase() === "movimientos") || wb.worksheets[0];
      if (!sheet) throw new Error("El archivo no tiene ninguna hoja legible.");

      const headerRow = sheet.getRow(1).values; // índice 1-based, [0] vacío
      const headers = headerRow.slice(1).map((h) => String(h ?? "").trim());
      const rows = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        row.values.slice(1).forEach((val, i) => {
          obj[headers[i]] = val && typeof val === "object" && "result" in val ? val.result : val;
        });
        rows.push(obj);
      });

      if (broker !== "Balanz") throw new Error("Todavía no armamos el lector para ese broker.");
      const nombreCartera = cuenta.trim() || broker;

      const result = await parseBalanzMovimientos(rows, nombreCartera, fx);

      // Buscamos tus datos actuales ahora (no recién al confirmar) para
      // poder mostrarte una vista previa real de cómo quedarían tus
      // tenencias de esta cartera después de esta importación.
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      const prevMovimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
      const prevHoldings = Array.isArray(data.holdings) ? data.holdings : [];

      const existingKeys = new Set(prevMovimientos.map((m) => `${m.fecha}|${m.activo}|${m.tipo}|${m.cantidad}|${m.precio}|${m.broker}`));
      const nuevos = result.cargables.filter((m) => !existingKeys.has(`${m.fecha}|${m.activo}|${m.tipo}|${m.cantidad}|${m.precio}|${m.broker}`));
      const nuevosSinCat = nuevos.map(({ cat, ...m }) => m);
      const movimientosFinal = [...prevMovimientos, ...nuevosSinCat];

      const catByTicker = {};
      for (const m of result.cargables) catByTicker[m.activo] = m.cat;
      const holdingsBalanz = recomputeHoldingsForBroker(movimientosFinal, nombreCartera, prevHoldings, catByTicker);

      // Los bonos se usan seguido para comprar dólar MEP (comprar hoy,
      // vender al día siguiente) -- si el archivo tiene el ciclo completo,
      // esto ya da 0 solo. Pero si queda un resto, mejor confirmarlo con
      // la persona en vez de asumir que es una tenencia real.
      const bondsToConfirm = holdingsBalanz.filter((h) => h.cat === "Bonos" && h.qty > 0);
      const initialAnswers = {};
      for (const b of bondsToConfirm) initialAnswers[b.name] = null;

      setPreview({ fileName: file.name, nombreCartera, cargables: result.cargables, ignoradas: result.ignoradas, prevMovimientos, prevHoldings, nuevosSinCat, movimientosFinal, holdingsBalanz, bondsToConfirm });
      setBondAnswers(initialAnswers);
      setStatus("preview");
    } catch (err) {
      setErrorMsg(err.message || "No pudimos leer el archivo.");
      setStatus("error");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const faltaResponderBonos = preview?.bondsToConfirm.some((b) => !bondAnswers[b.name]);

  const confirmarImportacion = async () => {
    if (!preview) return;
    setStatus("guardando");
    setErrorMsg("");
    try {
      const holdingsBalanzFinal = preview.holdingsBalanz
        .map((h) => {
          if (h.cat !== "Bonos") return h;
          const answer = bondAnswers[h.name];
          if (!answer || answer.type === "keep") return h;
          if (answer.type === "exclude") return null;
          if (answer.type === "custom") return { ...h, qty: answer.qty, avgCost: h.avgCost };
          return h;
        })
        .filter(Boolean);

      const holdingsOtrosBrokers = preview.prevHoldings.filter((h) => h.broker !== preview.nombreCartera);
      const holdingsFinal = [...holdingsOtrosBrokers, ...holdingsBalanzFinal];

      // Cada movimiento nuevo queda marcado con el ID de esta importación,
      // para poder identificarlos y borrarlos juntos si hace falta.
      const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nuevosConImportId = preview.nuevosSinCat.map((m) => ({ ...m, importId }));
      const movimientosFinal = [...preview.prevMovimientos, ...nuevosConImportId];

      const snap = await getDoc(doc(db, "users", user.uid));
      const prevImportaciones = Array.isArray(snap.data()?.importaciones) ? snap.data().importaciones : [];
      const nuevaImportacion = {
        id: importId,
        fileName: preview.fileName,
        broker: preview.nombreCartera,
        fecha: new Date().toISOString().slice(0, 10),
        cantidad: nuevosConImportId.length,
      };
      const importacionesFinal = [nuevaImportacion, ...prevImportaciones];

      await setDoc(doc(db, "users", user.uid), { holdings: holdingsFinal, movimientos: movimientosFinal, importaciones: importacionesFinal });

      HOLDINGS = holdingsFinal;
      MOVIMIENTOS = movimientosFinal;
      BROKER_LIST = computeBrokerList();
      AUTO_ASSETS = computeAutoAssets();
      ASSET_UNIVERSE_FULL = [...ASSET_UNIVERSE, ...AUTO_ASSETS];
      EARLIEST_TRADE_DATE = computeEarliestTradeDate();

      setImportaciones(importacionesFinal);
      setStatus("listo");
    } catch (err) {
      setErrorMsg(err.message || "No pudimos guardar los datos.");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setPreview(null);
    setBondAnswers({});
    setErrorMsg("");
  };


  return (
    <div>
      <SectionTitle C={C} sub="Subí el estado de cuenta o histórico de movimientos exportado desde tu broker o exchange.">Importar archivos</SectionTitle>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Origen del archivo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Balanz"].map((b) => (
            <span
              key={b}
              onClick={() => { setBroker(b); setCuenta(""); reset(); }}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${broker === b ? C.gold : C.border}`,
                fontSize: 12,
                color: broker === b ? C.gold : C.muted,
                background: broker === b ? C.chipActive : "transparent",
                cursor: "pointer",
              }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {!broker && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", fontSize: 13, color: C.faint, textAlign: "center" }}>
          Elegí de qué broker es tu archivo para ver las instrucciones.
        </div>
      )}

      {broker === "Balanz" && status === "idle" && (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
            {BALANZ_INSTRUCTIONS.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "14px 18px", borderTop: i > 0 ? `1px solid ${C.rowLine}` : "none" }}>
                <div style={{ minWidth: 22, height: 22, borderRadius: 999, background: C.chipActive, color: C.gold, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 6 }}>
              Nombre de esta cartera
              <input
                type="text"
                value={cuenta}
                onChange={(e) => setCuenta(e.target.value)}
                placeholder={broker}
                style={{ width: "100%", maxWidth: 320, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
              />
            </label>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
              Si tenés más de una cuenta en {broker} (ej: titular y cotitular), ponele un nombre distinto a cada una -- así podés seguirlas por separado. Si la dejás vacía, se usa "{broker}".
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("import-file-input").click()}
            style={{
              border: `2px dashed ${dragOver ? C.gold : C.border}`,
              borderRadius: 12,
              padding: "40px 20px",
              textAlign: "center",
              background: dragOver ? C.rowLine : C.surface,
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
          >
            <input id="import-file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFileInput} />
            <FileSpreadsheet size={28} color={C.muted} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, marginBottom: 4 }}>Arrastrá el archivo movimientos.xlsx acá, o hacé click para elegirlo</div>
            <div style={{ fontSize: 12, color: C.faint }}>.xlsx — máx. 10MB</div>
          </div>

          <div style={{ marginTop: 18, textAlign: "right" }}>
            {!confirmandoReset ? (
              <button
                onClick={() => setConfirmandoReset(true)}
                style={{ fontSize: 11, color: C.faint, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                ¿Un archivo se cargó mal? Borrar todo lo de "{cuenta.trim() || broker}" y empezar de nuevo
              </button>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.loss}`, borderRadius: 10, padding: 14, textAlign: "left" }}>
                <div style={{ fontSize: 12, color: C.loss, marginBottom: 10 }}>
                  Esto borra TODOS los movimientos y tenencias de "{cuenta.trim() || broker}" (no toca otras carteras). No se puede deshacer. ¿Confirmás?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => resetearBroker(cuenta.trim() || broker)}
                    disabled={reseteando}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.loss, color: "#fff", fontSize: 12, cursor: reseteando ? "default" : "pointer", opacity: reseteando ? 0.6 : 1 }}
                  >
                    {reseteando ? "Borrando..." : "Sí, borrar todo"}
                  </button>
                  <button onClick={() => setConfirmandoReset(false)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {status === "parsing" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", fontSize: 13, color: C.faint, textAlign: "center" }}>
          Leyendo el archivo y buscando el dólar de cada fecha con operaciones en dólares... puede tardar unos segundos.
        </div>
      )}

      {status === "error" && (
        <div style={{ background: C.surface, border: `1px solid ${C.loss}`, borderRadius: 12, padding: "18px", fontSize: 13, color: C.loss }}>
          {errorMsg}
          <div style={{ marginTop: 12 }}>
            <button onClick={reset} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, cursor: "pointer" }}>Probar de nuevo</button>
          </div>
        </div>
      )}

      {status === "preview" && preview && (
        <div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>
              Se van a cargar {preview.cargables.length} movimientos de {preview.fileName}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {preview.cargables.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 18px", borderTop: `1px solid ${C.rowLine}`, fontSize: 12 }}>
                  <span className="tabular" style={{ color: C.faint }}>{m.fecha}</span>
                  <span style={{ fontWeight: 600 }}>{m.activo}</span>
                  <span style={{ color: m.tipo === "Venta" ? C.loss : m.tipo === "Split" ? C.gold : C.gain }}>{m.tipo}</span>
                  <span className="tabular">{m.cantidad}</span>
                  <span className="tabular" style={{ color: C.faint }}>{m.precio > 0 ? `$${m.precio}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {Object.keys(preview.ignoradas).length > 0 && (
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 16, padding: "0 4px" }}>
              También encontramos {Object.entries(preview.ignoradas).map(([tipo, n]) => `${n} ${tipo.toLowerCase()}`).join(", ")} — no se cargan porque no cambian tu cantidad de acciones.
            </div>
          )}

          {preview.bondsToConfirm.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Confirmá estos bonos antes de seguir</div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 14 }}>
                Los bonos como estos se usan seguido para comprar dólar MEP (se compran y se venden al día siguiente). Según tus movimientos, te quedarían estas cantidades sin vender -- confirmanos si realmente las tenés hoy.
              </div>
              {preview.bondsToConfirm.map((b) => {
                const answer = bondAnswers[b.name];
                return (
                  <div key={b.name} style={{ padding: "12px 0", borderTop: `1px solid ${C.rowLine}` }}>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      Encontramos <strong>{b.name}</strong> con <span className="tabular">{b.qty.toLocaleString("es-AR", { maximumFractionDigits: 3 })}</span> unidades sin vender. ¿Actualmente las tenés?
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        onClick={() => setBondAnswers((prev) => ({ ...prev, [b.name]: { type: "keep" } }))}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${answer?.type === "keep" ? C.gold : C.border}`, background: answer?.type === "keep" ? C.chipActive : "transparent", color: answer?.type === "keep" ? C.gold : C.text, fontSize: 12, cursor: "pointer" }}
                      >
                        Sí, la tengo
                      </button>
                      <button
                        onClick={() => setBondAnswers((prev) => ({ ...prev, [b.name]: { type: "exclude" } }))}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${answer?.type === "exclude" ? C.gold : C.border}`, background: answer?.type === "exclude" ? C.chipActive : "transparent", color: answer?.type === "exclude" ? C.gold : C.text, fontSize: 12, cursor: "pointer" }}
                      >
                        No, era para dólares
                      </button>
                      <span style={{ fontSize: 12, color: C.faint }}>o escribí la cantidad real:</span>
                      <input
                        type="number"
                        placeholder="cantidad"
                        value={answer?.type === "custom" ? answer.qty : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBondAnswers((prev) => ({ ...prev, [b.name]: val === "" ? null : { type: "custom", qty: Number(val) } }));
                        }}
                        style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: `1px solid ${answer?.type === "custom" ? C.gold : C.border}`, background: C.bg, color: C.text, fontSize: 12 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={confirmarImportacion}
              disabled={faltaResponderBonos}
              title={faltaResponderBonos ? "Respondé sobre los bonos antes de continuar" : ""}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: C.gold, color: C.bg, fontWeight: 600, fontSize: 13, cursor: faltaResponderBonos ? "not-allowed" : "pointer", opacity: faltaResponderBonos ? 0.5 : 1 }}
            >
              Confirmar e importar
            </button>
            <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status === "guardando" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", fontSize: 13, color: C.faint, textAlign: "center" }}>
          Guardando en tu cuenta...
        </div>
      )}

      {status === "listo" && (
        <div style={{ background: C.surface, border: `1px solid ${C.gain}`, borderRadius: 12, padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.gain, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            <CheckCircle2 size={16} />
            Listo, se importó correctamente
          </div>
          <button onClick={reset} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 12, cursor: "pointer" }}>
            Importar otro archivo
          </button>
        </div>
      )}

      <div style={{ marginTop: 28, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>Importaciones recientes</div>
        {importaciones === null && (
          <div style={{ padding: "18px", fontSize: 12, color: C.faint, textAlign: "center" }}>Cargando...</div>
        )}
        {importaciones && importaciones.length === 0 && (
          <div style={{ padding: "18px", fontSize: 12, color: C.faint, textAlign: "center" }}>Todavía no importaste ningún archivo.</div>
        )}
        {importaciones && importaciones.map((imp) => (
          <div key={imp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: `1px solid ${C.rowLine}`, fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={14} color={C.gain} />
              {imp.fileName}
              <span style={{ fontSize: 11, color: C.faint }}>({imp.broker})</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: C.faint, fontSize: 12 }}>{imp.cantidad} movimientos · {imp.fecha}</span>
              <button
                onClick={() => borrarImportacion(imp)}
                disabled={borrandoId === imp.id}
                title="Borrar esta importación"
                style={{ display: "flex", alignItems: "center", padding: 4, borderRadius: 6, border: "none", background: "transparent", color: C.loss, cursor: borrandoId === imp.id ? "default" : "pointer", opacity: borrandoId === imp.id ? 0.5 : 1 }}
              >
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// P&L de fecha específica -- a diferencia de simplemente restar "valor hoy -
// valor antes" (que cuenta cualquier plata que hayas metido en el medio como
// si fuera ganancia), acá se resta el aporte neto real (compras - ventas)
// que hiciste ENTRE las dos fechas. Así, si tenías $50, metiste $100 más, y
// terminaste con $145, el resultado es -$5 (pérdida), no +$95.
// Excepciones manuales de categoría para tickers que ya no están en HOLDINGS
// (posiciones totalmente cerradas) y por eso no se pueden inferir de ahí.
// AL30D es el mismo bono que AL30, solo que se liquida en dólares -- durante
// el cepo era común comprar AL30 un día y venderlo como AL30D al siguiente
// para "pasarse a dólares" (dólar MEP/bono). Sigue siendo un bono.
const TICKER_CAT_OVERRIDES = { AL30D: "Bonos" };

function tickerCatMap() {
  const m = {};
  for (const h of HOLDINGS) m[h.name] = h.cat;
  return { ...m, ...TICKER_CAT_OVERRIDES };
}

function PnlFechaView({ f, C, fx, historyCache, livePrices, cryptoUsd }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateA, setDateA] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    const iso = d.toISOString().slice(0, 10);
    return iso < EARLIEST_TRADE_DATE ? EARLIEST_TRADE_DATE : iso;
  });
  const [dateB, setDateB] = useState(todayStr);
  const [brokerFilter, setBrokerFilter] = useState("Todas");

  const TICKER_CAT = useMemo(tickerCatMap, []);
  // Todos los tickers que aparecieron alguna vez en movimientos -- incluye
  // posiciones ya cerradas del todo, que no estarían en HOLDINGS actual.
  // Incluye tickers de HOLDINGS también, no solo los que tienen movimientos
  // cargados -- si no, una tenencia sin historial de compras real (ej:
  // CONIOLA, del cual no tenemos el detalle) queda directamente afuera del
  // cálculo entero, en vez de contar con su valor actual "plano".
  const allTickers = useMemo(() => [...new Set([...MOVIMIENTOS.map((m) => m.activo), ...HOLDINGS.map((h) => h.name)])], []);

  const qtyAtDate = useMemo(() => {
    const cache = {};
    const brokerArg = brokerFilter === "Todas" ? null : brokerFilter;
    return (ticker, date) => {
      if (!cache[ticker]) cache[ticker] = buildQtyTimeline(ticker, brokerArg);
      return cache[ticker](date);
    };
  }, [brokerFilter]);

  const priceAtDate = useMemo(() => {
    const cache = {};
    return (ticker, date, cat) => {
      if (!(ticker in cache)) {
        const hist = historyCache[ticker];
        if (hist && hist.length > 1) {
          const historyMap = {};
          for (const p of hist) historyMap[p.date] = p.price;
          const sortedDates = Object.keys(historyMap).sort();
          // Las CEDEARs y las criptos (vía Coinbase) se cachean en dólares
          // reales, no en pesos -- hay que reescalar al precio ARS real de
          // hoy (mismo truco que "Buscar activo" y buildRealPortfolioHistory),
          // o el valor sale ~1000x más chico de lo real.
          let scaleFix = 1;
          if (cat === "CEDEARs") {
            const livePriceArs = livePrices[ticker];
            const lastHistUsd = historyMap[sortedDates[sortedDates.length - 1]];
            if (livePriceArs != null && lastHistUsd > 0) scaleFix = livePriceArs / lastHistUsd;
          } else if (cat === "Cripto") {
            const livePriceArs = cryptoUsd?.[ticker] != null ? cryptoUsd[ticker] * fx : null;
            const lastHistUsd = historyMap[sortedDates[sortedDates.length - 1]];
            if (livePriceArs != null && lastHistUsd > 0) scaleFix = livePriceArs / lastHistUsd;
          }
          cache[ticker] = { map: historyMap, dates: sortedDates, scaleFix };
        } else {
          cache[ticker] = null;
        }
      }
      const entry = cache[ticker];
      if (entry) {
        const p = priceAt(entry.map, entry.dates, date);
        if (p != null) return p * entry.scaleFix;
      }
      // Sin histórico real cacheado para este ticker -- se usa el precio en
      // vivo/actual "hacia atrás" como mejor aproximación disponible.
      const h = HOLDINGS.find((x) => x.name === ticker);
      return h ? liveAdjustedPrice(h, livePrices, fx, cryptoUsd) : 0;
    };
  }, [historyCache, livePrices, cryptoUsd, fx]);

  const CATEGORIES = ["Acciones", "CEDEARs", "Bonos", "Fondos", "Cripto"];

  const valuesAtDate = (date) => {
    const out = { Acciones: 0, CEDEARs: 0, Bonos: 0, Fondos: 0, Cripto: 0, total: 0 };
    for (const ticker of allTickers) {
      const qty = qtyAtDate(ticker, date);
      if (!qty) continue;
      const cat = TICKER_CAT[ticker] || "Acciones";
      const val = qty * priceAtDate(ticker, date, cat);
      out[cat] = (out[cat] || 0) + val;
      out.total += val;
    }
    return out;
  };

  const contributionsBetween = (from, to) => {
    const out = { Acciones: 0, CEDEARs: 0, Bonos: 0, Fondos: 0, Cripto: 0, total: 0 };
    for (const m of MOVIMIENTOS) {
      if (m.tipo !== "Compra" && m.tipo !== "Venta") continue;
      if (brokerFilter !== "Todas" && m.broker !== brokerFilter) continue;
      if (!(m.fecha > from && m.fecha <= to)) continue;
      const cat = TICKER_CAT[m.activo] || "Acciones";
      const amount = m.cantidad * m.precio * (m.tipo === "Compra" ? 1 : -1);
      out[cat] = (out[cat] || 0) + amount;
      out.total += amount;
    }
    return out;
  };

  // Detalle de movimientos por categoría en el período, para el desplegable
  // que se abre al tocar la columna "Compras/ventas" de cada fila.
  const movementsBetween = (from, to) => {
    const out = { Acciones: [], CEDEARs: [], Bonos: [], Fondos: [], Cripto: [] };
    for (const m of MOVIMIENTOS) {
      if (m.tipo !== "Compra" && m.tipo !== "Venta") continue;
      if (brokerFilter !== "Todas" && m.broker !== brokerFilter) continue;
      if (!(m.fecha > from && m.fecha <= to)) continue;
      const cat = TICKER_CAT[m.activo] || "Acciones";
      (out[cat] || (out[cat] = [])).push(m);
    }
    for (const cat of Object.keys(out)) out[cat].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    return out;
  };

  const hasBothDates = !!dateA && !!dateB;
  const [from, to] = hasBothDates ? (dateA <= dateB ? [dateA, dateB] : [dateB, dateA]) : [null, null];

  const [expandedCats, setExpandedCats] = useState(() => new Set());
  const toggleCat = (cat) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const result = useMemo(() => {
    if (!hasBothDates) return null;
    const valFrom = valuesAtDate(from);
    const valTo = valuesAtDate(to);
    const contrib = contributionsBetween(from, to);
    const movs = movementsBetween(from, to);
    const rows = CATEGORIES.map((cat) => {
      const start = valFrom[cat] || 0;
      const end = valTo[cat] || 0;
      const net = contrib[cat] || 0;
      const gain = end - start - net;
      const base = start + Math.max(net, 0);
      return { cat, start, end, net, gain, gainPct: base !== 0 ? (gain / base) * 100 : 0, movs: movs[cat] || [] };
    });
    const gainTotal = valTo.total - valFrom.total - contrib.total;
    const baseTotal = valFrom.total + Math.max(contrib.total, 0);
    const totalStart = valFrom.total, totalEnd = valTo.total;
    return { rows, valFrom, valTo, gainTotal, gainPctTotal: baseTotal !== 0 ? (gainTotal / baseTotal) * 100 : 0, totalStart, totalEnd, totalNet: contrib.total };
  }, [from, to, brokerFilter, historyCache, livePrices]);

  return (
    <div>
      <SectionTitle C={C} sub="Elegí dos fechas cualquiera y calculamos el resultado real entre esos dos momentos (descontando lo que hayas metido o sacado en el medio, no solo la diferencia de valor).">
        P&L de fecha específica
      </SectionTitle>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Desde
          <input
            type="date"
            value={dateA}
            min={EARLIEST_TRADE_DATE}
            max={todayStr}
            onChange={(e) => { if (e.target.value) setDateA(e.target.value); }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }}
          />
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Hasta
          <input
            type="date"
            value={dateB}
            min={EARLIEST_TRADE_DATE}
            max={todayStr}
            onChange={(e) => { if (e.target.value) setDateB(e.target.value); }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }}
          />
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Cartera
          <select
            value={brokerFilter}
            onChange={(e) => setBrokerFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="Todas">Todas las carteras</option>
            {BROKER_LIST.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
      </div>

      {!result ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "22px", fontSize: 13, color: C.faint }}>
          Elegí las dos fechas para ver el resultado.
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "22px" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            Resultado del período{brokerFilter !== "Todas" ? ` · ${brokerFilter}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            {result.gainTotal >= 0 ? <TrendingUp size={24} color={C.gain} /> : <TrendingDown size={24} color={C.loss} />}
            <span className="tabular" style={{ fontSize: 30, fontWeight: 600, color: result.gainTotal >= 0 ? C.gain : C.loss }}>
              {result.gainTotal >= 0 ? "+" : ""}{f(result.gainTotal)}
            </span>
            <span className="tabular" style={{ fontSize: 16, color: result.gainTotal >= 0 ? C.gain : C.loss, opacity: 0.85 }}>
              ({result.gainPctTotal >= 0 ? "+" : ""}{result.gainPctTotal.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.1fr", gap: 10, fontSize: 12, color: C.faint, marginBottom: 6 }}>
            <span>Categoría</span>
            <span style={{ textAlign: "right" }}>{from}</span>
            <span style={{ textAlign: "right" }}>Compras/ventas</span>
            <span style={{ textAlign: "right" }}>{to}</span>
            <span style={{ textAlign: "right" }}>Resultado</span>
          </div>
          {result.rows.map((r) => {
            const isOpen = expandedCats.has(r.cat);
            return (
              <div key={r.cat}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.1fr", gap: 10, fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.rowLine}`, alignItems: "center" }}>
                  <span>{r.cat}</span>
                  <span className="tabular" style={{ textAlign: "right", fontWeight: 600 }}>{f(r.start)}</span>
                  {r.movs.length > 0 ? (
                    <button
                      onClick={() => toggleCat(r.cat)}
                      className="tabular"
                      style={{
                        textAlign: "right",
                        color: C.faint,
                        fontSize: 12,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 4,
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: 3,
                      }}
                      title="Ver movimientos de este período"
                    >
                      <ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                      {r.net >= 0 ? "+" : ""}{f(r.net)} ({r.movs.length})
                    </button>
                  ) : (
                    <span className="tabular" style={{ textAlign: "right", color: C.faint, fontSize: 12 }}>—</span>
                  )}
                  <span className="tabular" style={{ textAlign: "right", fontWeight: 600 }}>{f(r.end)}</span>
                  <span className="tabular" style={{ textAlign: "right", color: r.gain >= 0 ? C.gain : C.loss, fontWeight: 600 }}>
                    {r.gain >= 0 ? "+" : ""}{f(r.gain)} <span style={{ fontWeight: 400, opacity: 0.85 }}>({r.gainPct >= 0 ? "+" : ""}{r.gainPct.toFixed(1)}%)</span>
                  </span>
                </div>
                {isOpen && r.movs.length > 0 && (
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 8, fontSize: 11, color: C.faint, marginBottom: 4 }}>
                      <span>Fecha</span>
                      <span>Activo</span>
                      <span>Tipo</span>
                      <span style={{ textAlign: "right" }}>Cantidad</span>
                      <span style={{ textAlign: "right" }}>PPC</span>
                      <span style={{ textAlign: "right" }}>Total</span>
                    </div>
                    {r.movs.map((m, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 8, fontSize: 12, padding: "4px 0", borderTop: i > 0 ? `1px solid ${C.rowLine}` : "none" }}>
                        <span className="tabular" style={{ color: C.muted }}>{m.fecha}</span>
                        <span style={{ fontWeight: 500 }}>{m.activo}</span>
                        <span style={{ color: m.tipo === "Venta" ? C.loss : C.gain }}>{m.tipo}</span>
                        <span className="tabular" style={{ textAlign: "right" }}>{m.cantidad}</span>
                        <span className="tabular" style={{ textAlign: "right" }}>{f(m.precio)}</span>
                        <span className="tabular" style={{ textAlign: "right", fontWeight: 600 }}>{f(m.cantidad * m.precio)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.1fr", gap: 10, fontSize: 14, padding: "12px 0 4px", marginTop: 4, borderTop: `2px solid ${C.gold}` }}>
            <span style={{ fontWeight: 700 }}>TOTAL</span>
            <span className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>{f(result.totalStart)}</span>
            <span className="tabular" style={{ textAlign: "right", color: C.faint, fontSize: 12, fontWeight: 700 }}>
              {result.totalNet !== 0 ? `${result.totalNet >= 0 ? "+" : ""}${f(result.totalNet)}` : "—"}
            </span>
            <span className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>{f(result.totalEnd)}</span>
            <span className="tabular" style={{ textAlign: "right", color: result.gainTotal >= 0 ? C.gain : C.loss, fontWeight: 700 }}>
              {result.gainTotal >= 0 ? "+" : ""}{f(result.gainTotal)} <span style={{ fontWeight: 500, opacity: 0.85 }}>({result.gainPctTotal >= 0 ? "+" : ""}{result.gainPctTotal.toFixed(1)}%)</span>
            </span>
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: C.faint }}>
            "Resultado" ya descuenta lo que compraste o vendiste entre esas dos fechas -- es la ganancia o pérdida real de lo que ya tenías más lo que fuiste sumando, valuado a precio de mercado de cada categoría.
          </div>
        </div>
      )}
    </div>
  );
}

function MovimientosView({ f, C }) {
  const [brokerFilter, setBrokerFilter] = useState("Todas");
  const [tipoFilter, setTipoFilter] = useState("Ambos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = MOVIMIENTOS.filter((m) => {
    if (brokerFilter !== "Todas" && m.broker !== brokerFilter) return false;
    if (tipoFilter !== "Ambos" && m.tipo !== tipoFilter) return false;
    if (dateFrom && m.fecha < dateFrom) return false;
    if (dateTo && m.fecha > dateTo) return false;
    return true;
  }).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const totalComprado = filtered.filter((m) => m.tipo === "Compra").reduce((s, m) => s + m.cantidad * m.precio, 0);
  const totalVendido = filtered.filter((m) => m.tipo === "Venta").reduce((s, m) => s + m.cantidad * m.precio, 0);

  return (
    <div>
      <SectionTitle C={C} sub="Todas las compras, ventas y rentas registradas, en un solo lugar.">Movimientos</SectionTitle>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Cartera
          <select
            value={brokerFilter}
            onChange={(e) => setBrokerFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="Todas">Todas las carteras</option>
            {BROKER_LIST.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Tipo
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="Ambos">Todos los movimientos</option>
            <option value="Compra">Solo compras</option>
            <option value="Venta">Solo ventas</option>
            <option value="Split">Solo splits</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }}
          />
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 10px" }}
          />
        </label>
        {(dateFrom || dateTo || brokerFilter !== "Todas" || tipoFilter !== "Ambos") && (
          <button
            onClick={() => { setBrokerFilter("Todas"); setTipoFilter("Ambos"); setDateFrom(""); setDateTo(""); }}
            style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.faint, cursor: "pointer" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.faint, marginBottom: 2 }}>Total comprado</div>
          <div className="tabular" style={{ fontSize: 16, fontWeight: 600, color: C.gain }}>{f(totalComprado)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.faint, marginBottom: 2 }}>Total vendido</div>
          <div className="tabular" style={{ fontSize: 16, fontWeight: 600, color: C.loss }}>{f(totalVendido)}</div>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.faint, textAlign: "left" }}>
              <th style={{ padding: "10px 18px", fontWeight: 500 }}>Fecha</th>
              <th style={{ padding: "10px 12px", fontWeight: 500 }}>Activo</th>
              <th style={{ padding: "10px 12px", fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>Cantidad</th>
              <th style={{ padding: "10px 12px", fontWeight: 500, textAlign: "right" }}>PPC</th>
              <th style={{ padding: "10px 18px", fontWeight: 500 }}>Origen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px 18px", textAlign: "center", color: C.faint, fontSize: 13 }}>
                  No hay movimientos que coincidan con estos filtros.
                </td>
              </tr>
            ) : (
              filtered.map((m, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.rowLine}` }}>
                  <td className="tabular" style={{ padding: "10px 18px", color: C.muted }}>{m.fecha}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{m.activo}</td>
                  <td style={{ padding: "10px 12px", color: m.tipo === "Venta" ? C.loss : m.tipo === "Compra" ? C.gain : C.gold }}>{m.tipo}</td>
                  <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>{m.cantidad}</td>
                  <td className="tabular" style={{ padding: "10px 12px", textAlign: "right" }}>{f(m.precio)}</td>
                  <td style={{ padding: "10px 18px", color: C.muted }}>{m.broker}</td>
                </tr>
              ))
            )}
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

function ConfigView({ currency, setCurrency, fxType, setFxType, C, fxRates, liveStatus, livePrices, user }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [seedStatus, setSeedStatus] = useState("idle"); // idle | cargando | ok | error
  const [seedError, setSeedError] = useState("");

  // Botón temporal, solo para la carga inicial de tus datos reales a
  // Firestore -- chequea tu UID puntual para que no le aparezca a nadie
  // más que se registre después. Se puede borrar una vez usado.
  const isOwner = user?.uid === "hgKMkrqta4RIy0sSCAGSDbDUCzX2";

  const cargarDatosIniciales = async () => {
    setSeedStatus("cargando");
    setSeedError("");
    try {
      await setDoc(doc(db, "users", user.uid), { holdings: HOLDINGS, movimientos: MOVIMIENTOS });
      setSeedStatus("ok");
    } catch (err) {
      setSeedStatus("error");
      setSeedError(err.message || "Error desconocido");
    }
  };

  return (
    <div>
      <SectionTitle C={C} sub="Moneda por defecto, fuente del tipo de cambio y qué cuentas están conectadas.">Configuración</SectionTitle>

      {isOwner && (
        <div style={{ background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Carga inicial a Firestore (temporal)</div>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>
            Empuja tus {HOLDINGS.length} tenencias y {MOVIMIENTOS.length} movimientos actuales a tu documento en Firestore. Solo hace falta usarlo una vez.
          </div>
          <button
            onClick={cargarDatosIniciales}
            disabled={seedStatus === "cargando"}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.gold, color: C.bg, fontWeight: 600, fontSize: 12, cursor: seedStatus === "cargando" ? "default" : "pointer", opacity: seedStatus === "cargando" ? 0.6 : 1 }}
          >
            {seedStatus === "cargando" ? "Cargando..." : seedStatus === "ok" ? "Listo ✓ -- volver a cargar" : "Cargar mis datos"}
          </button>
          {seedStatus === "ok" && <div style={{ fontSize: 12, color: C.gain, marginTop: 10 }}>Se guardaron correctamente en Firestore.</div>}
          {seedStatus === "error" && <div style={{ fontSize: 12, color: C.loss, marginTop: 10 }}>Error: {seedError}</div>}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Cuenta</div>
          <div style={{ fontSize: 12, color: C.faint }}>{user?.email}</div>
        </div>
        <button
          onClick={async () => { setLoggingOut(true); await signOut(auth); }}
          disabled={loggingOut}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.loss, fontSize: 12, cursor: loggingOut ? "default" : "pointer", opacity: loggingOut ? 0.6 : 1 }}
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>

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
