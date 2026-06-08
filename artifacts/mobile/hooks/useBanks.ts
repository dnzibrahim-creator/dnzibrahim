import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_BANKS = [
  "Ziraat Bankası", "İş Bankası", "Halkbank", "Vakıfbank", "Garanti BBVA",
  "Yapı Kredi", "Akbank", "QNB Finansbank", "Denizbank", "TEB",
  "HSBC", "ING Bank", "Şekerbank", "Odeabank", "Alternatifbank",
];

const BANKS_KEY = "@cek_banks_v1";

export function useBanks() {
  const [banks, setBanks] = useState<string[]>(DEFAULT_BANKS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BANKS_KEY)
      .then((d) => { if (d) setBanks(JSON.parse(d)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = (list: string[]) => {
    AsyncStorage.setItem(BANKS_KEY, JSON.stringify(list)).catch(() => {});
  };

  const addBank = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return false;
    let added = false;
    setBanks((prev) => {
      if (prev.some((b) => b.toLowerCase() === n.toLowerCase())) return prev;
      const next = [...prev, n];
      persist(next);
      added = true;
      return next;
    });
    return added;
  }, []);

  const removeBank = useCallback((name: string) => {
    setBanks((prev) => {
      const next = prev.filter((b) => b !== name);
      persist(next);
      return next;
    });
  }, []);

  const renameBank = useCallback((oldName: string, newName: string) => {
    const n = newName.trim();
    if (!n) return;
    setBanks((prev) => {
      const next = prev.map((b) => (b === oldName ? n : b));
      persist(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setBanks(DEFAULT_BANKS);
    persist(DEFAULT_BANKS);
  }, []);

  return { banks, loaded, addBank, removeBank, renameBank, resetToDefaults };
}
