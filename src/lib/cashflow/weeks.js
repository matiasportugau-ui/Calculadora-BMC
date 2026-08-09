import { format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { getMergedTransactions } from "./project.js";

export function getWeekStartKey(d) {
  return format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function formatWeekLabel(k) {
  return `Sem ${format(parseISO(k), "dd MMM", { locale: es })}`;
}

export function groupPendingByWeek(state, n = 4) {
  const map = new Map();
  getMergedTransactions(state).filter((t) => t.status === "pending").forEach((t) => {
    const k = getWeekStartKey(t.date);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  });
  const keys = [...map.keys()].sort().slice(0, n);
  while (keys.length < n) {
    const d = keys.length ? parseISO(keys[keys.length - 1]) : new Date();
    d.setDate(d.getDate() + 7);
    const k = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (!keys.includes(k)) keys.push(k);
  }
  return keys.map((weekKey) => ({ weekKey, label: formatWeekLabel(weekKey), transactions: (map.get(weekKey) || []).sort((a, b) => a.date.localeCompare(b.date)) }));
}
