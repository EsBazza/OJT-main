"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const order: Theme[] = ["system", "light", "dark"];
const labels: Record<Theme, string> = { system: "Theme: match device", light: "Theme: light", dark: "Theme: dark" };

function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("ojt-theme");
    else localStorage.setItem("ojt-theme", theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" || current === "dark" ? current : "system");
  }, []);
  const next = order[(order.indexOf(theme) + 1) % order.length];
  return (
    <button type="button" className="icon-button theme-toggle" aria-label={`${labels[theme]}. Switch to ${next}.`} title={labels[theme]} onClick={() => { apply(next); setTheme(next); }}>
      <Monitor aria-hidden="true" size={18} data-active={theme === "system"} />
      <Sun aria-hidden="true" size={18} data-active={theme === "light"} />
      <Moon aria-hidden="true" size={18} data-active={theme === "dark"} />
    </button>
  );
}
