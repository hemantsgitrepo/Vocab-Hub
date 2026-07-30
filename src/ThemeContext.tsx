import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppColors, darkColors, lightColors, navThemeFor, paperThemeFor } from './theme';
import { getDarkMode, setDarkMode } from './db/settings';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  setDark: (dark: boolean) => void;
  paperTheme: ReturnType<typeof paperThemeFor>;
  navTheme: ReturnType<typeof navThemeFor>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    getDarkMode().then(setIsDark);
  }, []);

  const setDark = (dark: boolean) => {
    setIsDark(dark);
    setDarkMode(dark);
  };

  const value = useMemo<ThemeContextValue>(() => {
    const colors = isDark ? darkColors : lightColors;
    return {
      colors,
      isDark,
      setDark,
      paperTheme: paperThemeFor(colors, isDark),
      navTheme: navThemeFor(colors, isDark),
    };
  }, [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
