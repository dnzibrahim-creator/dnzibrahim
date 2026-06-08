import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Check {
  id: string;
  checkType?: "received" | "given";
  bankName: string;
  customerName: string;
  serialNumber?: string;
  amount: number;
  dueDate: string;
  note?: string;
  givenTo?: string;
  status: "pending" | "paid" | "endorsed";
  createdAt: string;
  imageUri?: string;
}

export interface CheckTotals {
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  endorsedCount: number;
  pendingAmount: number;
  overdueAmount: number;
  totalCount: number;
}

interface ChecksContextType {
  checks: Check[];
  loading: boolean;
  addCheck: (check: Omit<Check, "id" | "createdAt" | "status">) => { isDuplicate: boolean; existing?: Check };
  forceAddCheck: (check: Omit<Check, "id" | "createdAt" | "status">) => void;
  updateCheck: (id: string, data: Partial<Omit<Check, "id" | "createdAt">>) => void;
  deleteCheck: (id: string) => void;
  markAsPaid: (id: string) => void;
  markAsEndorsed: (id: string) => void;
  getPendingChecks: () => Check[];
  getOverdueChecks: () => Check[];
  getCompletedChecks: () => Check[];
  getMonthlyChecks: (year: number, month: number) => Check[];
  getUpcomingChecks: (days: number) => Check[];
  getTopChecks: (n: number) => Check[];
  searchChecks: (query: string) => Check[];
  getTotals: () => CheckTotals;
  getTotalPendingAmount: () => number;
  getMonthlyAmount: (year: number, month: number) => number;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const ChecksContext = createContext<ChecksContextType | null>(null);
const STORAGE_KEY = "@cek_yonetimi_v1";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectDuplicate(existing: Check[], data: Omit<Check, "id" | "createdAt" | "status">): Check | undefined {
  return existing.find((c) =>
    c.status !== "paid" &&
    c.status !== "endorsed" &&
    Math.abs(c.amount - data.amount) < 0.01 &&
    c.dueDate === data.dueDate &&
    normalize(c.customerName) === normalize(data.customerName) &&
    (!data.serialNumber || !c.serialNumber || c.serialNumber === data.serialNumber)
  );
}

const MONTH_NAMES = ["ocak","şubat","mart","nisan","mayıs","haziran","temmuz","ağustos","eylül","ekim","kasım","aralık"];
const MONTH_SHORT = ["oca","şub","mar","nis","may","haz","tem","ağu","eyl","eki","kas","ara"];

function parseNaturalQuery(query: string): (c: Check) => boolean {
  const q = query.toLowerCase();
  const today = todayStr();
  const filters: Array<(c: Check) => boolean> = [];

  const monthIdx = MONTH_NAMES.findIndex((m) => q.includes(m));
  const monthShortIdx = monthIdx === -1 ? MONTH_SHORT.findIndex((m) => q.includes(m)) : -1;
  const mi = monthIdx !== -1 ? monthIdx : monthShortIdx;
  if (mi !== -1) {
    const yearMatch = q.match(/20\d\d/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    const prefix = `${year}-${String(mi + 1).padStart(2, "0")}`;
    filters.push((c) => c.dueDate.startsWith(prefix));
  }

  const amountAbove = q.match(/(\d[\d.,]*)\s*(bin|k|lira|tl|₺)?\s*(üzeri|üstü|büyük|fazla)/);
  if (amountAbove) {
    const raw = amountAbove[1].replace(/[.,]/g, "");
    let threshold = parseInt(raw, 10);
    if (q.includes("bin") || q.includes("k")) threshold *= 1000;
    filters.push((c) => c.amount > threshold);
  }

  const amountBelow = q.match(/(\d[\d.,]*)\s*(bin|k|lira|tl|₺)?\s*(altı|aşağı|küçük|az)/);
  if (amountBelow) {
    const raw = amountBelow[1].replace(/[.,]/g, "");
    let threshold = parseInt(raw, 10);
    if (q.includes("bin") || q.includes("k")) threshold *= 1000;
    filters.push((c) => c.amount < threshold);
  }

  if (q.includes("vadesi geç") || q.includes("gecikmiş")) {
    filters.push((c) => c.status === "pending" && c.dueDate < today);
  } else if (q.includes("bekle") || q.includes("ödenmemiş")) {
    filters.push((c) => c.status === "pending");
  } else if (q.includes("ödendi") || q.includes("tahsil")) {
    filters.push((c) => c.status === "paid");
  } else if (q.includes("arkası yazıl") || q.includes("ciro")) {
    filters.push((c) => c.status === "endorsed");
  }

  if (q.includes("alınan")) filters.push((c) => c.checkType === "received");
  if (q.includes("verilen")) filters.push((c) => c.checkType === "given");

  const topMatch = q.match(/en\s*(büyük|yüksek|değerli)\s*(\d+)/);
  if (topMatch) {
    return (c) => {
      const all = filters.every((f) => f(c));
      return all;
    };
  }

  if (filters.length === 0) {
    const words = q.split(/\s+/).filter((w) => w.length > 2 && !["çek","için","ile","bir","bu","şu","da","de","çeki","veya","ve"].includes(w));
    if (words.length > 0) {
      filters.push((c) =>
        words.some((w) =>
          normalize(c.customerName).includes(w) ||
          normalize(c.bankName).includes(w) ||
          (c.serialNumber && c.serialNumber.toLowerCase().includes(w)) ||
          (c.note && normalize(c.note).includes(w)) ||
          (c.givenTo && normalize(c.givenTo).includes(w))
        )
      );
    }
  }

  if (filters.length === 0) return () => true;
  return (c) => filters.every((f) => f(c));
}

export function ChecksProvider({ children }: { children: React.ReactNode }) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((d) => { if (d) setChecks(JSON.parse(d)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = (list: Check[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  };

  const addCheck = useCallback((data: Omit<Check, "id" | "createdAt" | "status">): { isDuplicate: boolean; existing?: Check } => {
    const existing = detectDuplicate(checks, data);
    if (existing) return { isDuplicate: true, existing };
    const c: Check = { ...data, id: generateId(), status: "pending", createdAt: new Date().toISOString() };
    setChecks((prev) => { const next = [c, ...prev]; persist(next); return next; });
    return { isDuplicate: false };
  }, [checks]);

  const forceAddCheck = useCallback((data: Omit<Check, "id" | "createdAt" | "status">): void => {
    const c: Check = { ...data, id: generateId(), status: "pending", createdAt: new Date().toISOString() };
    setChecks((prev) => { const next = [c, ...prev]; persist(next); return next; });
  }, []);

  const updateCheck = useCallback((id: string, data: Partial<Omit<Check, "id" | "createdAt">>) => {
    setChecks((prev) => { const next = prev.map((c) => (c.id === id ? { ...c, ...data } : c)); persist(next); return next; });
  }, []);

  const deleteCheck = useCallback((id: string) => {
    setChecks((prev) => { const next = prev.filter((c) => c.id !== id); persist(next); return next; });
  }, []);

  const markAsPaid = useCallback((id: string) => updateCheck(id, { status: "paid" }), [updateCheck]);
  const markAsEndorsed = useCallback((id: string) => updateCheck(id, { status: "endorsed" }), [updateCheck]);

  const getPendingChecks = useCallback((): Check[] => {
    const today = todayStr();
    return checks.filter((c) => c.status === "pending" && c.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks]);

  const getOverdueChecks = useCallback((): Check[] => {
    const today = todayStr();
    return checks.filter((c) => c.status === "pending" && c.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks]);

  const getCompletedChecks = useCallback((): Check[] => {
    return checks.filter((c) => c.status === "paid" || c.status === "endorsed").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [checks]);

  const getMonthlyChecks = useCallback((year: number, month: number): Check[] => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return checks.filter((c) => c.dueDate.startsWith(prefix)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks]);

  const getUpcomingChecks = useCallback((days: number): Check[] => {
    const today = todayStr();
    const future = new Date(); future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().split("T")[0];
    return checks.filter((c) => c.status === "pending" && c.dueDate >= today && c.dueDate <= futureStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks]);

  const getTopChecks = useCallback((n: number): Check[] => {
    return [...checks].sort((a, b) => b.amount - a.amount).slice(0, n);
  }, [checks]);

  const searchChecks = useCallback((query: string): Check[] => {
    if (!query.trim()) return checks;
    const filter = parseNaturalQuery(query);
    const results = checks.filter(filter);
    const q = query.toLowerCase();
    const topMatch = q.match(/en\s*(büyük|yüksek|değerli)\s*(\d+)/);
    if (topMatch) {
      const n = parseInt(topMatch[2], 10);
      return results.sort((a, b) => b.amount - a.amount).slice(0, n);
    }
    return results;
  }, [checks]);

  const getTotals = useCallback((): CheckTotals => {
    const today = todayStr();
    const pending = checks.filter((c) => c.status === "pending" && c.dueDate >= today);
    const overdue = checks.filter((c) => c.status === "pending" && c.dueDate < today);
    const paid = checks.filter((c) => c.status === "paid");
    const endorsed = checks.filter((c) => c.status === "endorsed");
    return {
      pendingCount: pending.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      endorsedCount: endorsed.length,
      pendingAmount: pending.reduce((s, c) => s + c.amount, 0),
      overdueAmount: overdue.reduce((s, c) => s + c.amount, 0),
      totalCount: checks.length,
    };
  }, [checks]);

  const getTotalPendingAmount = useCallback((): number => {
    const today = todayStr();
    return checks.filter((c) => c.status === "pending" && c.dueDate >= today).reduce((s, c) => s + c.amount, 0);
  }, [checks]);

  const getMonthlyAmount = useCallback((year: number, month: number): number => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return checks.filter((c) => c.status === "pending" && c.dueDate.startsWith(prefix)).reduce((s, c) => s + c.amount, 0);
  }, [checks]);

  const exportData = useCallback(() => JSON.stringify({ version: 1, checks, exportedAt: new Date().toISOString() }), [checks]);

  const importData = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      const list: Check[] = parsed.checks ?? parsed;
      if (!Array.isArray(list) || list.length === 0) return false;
      setChecks(list);
      persist(list);
      return true;
    } catch { return false; }
  }, []);

  return (
    <ChecksContext.Provider value={{ checks, loading, addCheck, forceAddCheck, updateCheck, deleteCheck, markAsPaid, markAsEndorsed, getPendingChecks, getOverdueChecks, getCompletedChecks, getMonthlyChecks, getUpcomingChecks, getTopChecks, searchChecks, getTotals, getTotalPendingAmount, getMonthlyAmount, exportData, importData }}>
      {children}
    </ChecksContext.Provider>
  );
}

export function useChecks(): ChecksContextType {
  const ctx = useContext(ChecksContext);
  if (!ctx) throw new Error("useChecks must be inside ChecksProvider");
  return ctx;
}
