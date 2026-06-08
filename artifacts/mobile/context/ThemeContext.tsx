import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import baseColors from "@/constants/colors";

type ColorPalette = typeof baseColors.light & { radius: number };

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  forceDark: boolean | null;
  setForceDark: (v: boolean | null) => void;
  isDark: boolean;
  colors: ColorPalette;
}

export const PRESET_COLORS = [
  "#1B4F8A", "#2563EB", "#7C3AED", "#9333EA",
  "#DC2626", "#EA580C", "#16A34A", "#0891B2",
  "#DB2777", "#854D0E",
];

const THEME_KEY = "@cek_theme_v1";
const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [primaryColor, setPrimaryColorState] = useState("#1B4F8A");
  const [forceDark, setForceDarkState] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((d) => {
      if (d) {
        const p = JSON.parse(d);
        if (p.primaryColor) setPrimaryColorState(p.primaryColor);
        if (p.forceDark !== undefined) setForceDarkState(p.forceDark);
      }
    }).catch(() => {});
  }, []);

  const save = (primary: string, dark: boolean | null) => {
    AsyncStorage.setItem(THEME_KEY, JSON.stringify({ primaryColor: primary, forceDark: dark })).catch(() => {});
  };

  const setPrimaryColor = (c: string) => { setPrimaryColorState(c); save(c, forceDark); };
  const setForceDark = (v: boolean | null) => { setForceDarkState(v); save(primaryColor, v); };

  const isDark = forceDark !== null ? forceDark : system === "dark";
  const base = isDark ? baseColors.dark : baseColors.light;
  const colors: ColorPalette = { ...base, primary: primaryColor, tint: primaryColor, radius: baseColors.radius };

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, forceDark, setForceDark, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
