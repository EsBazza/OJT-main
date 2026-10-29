"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useDismiss } from "./use-dismiss";

type Theme = "system" | "light" | "dark";
const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match device", icon: Monitor },
];

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

// A small menu with explicit choices instead of a button that cycles through hidden states.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const menu = useRef<HTMLDetailsElement>(null);
  useDismiss(menu);
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" || current === "dark" ? current : "system");
  }, []);
  const active = options.find((option) => option.value === theme) ?? options[2];
  return (
    <details className="theme-menu" ref={menu}>
      <summary className="icon-button theme-toggle" aria-label={`Theme: ${active.label}`} title={`Theme: ${active.label}`}>
        {options.map(({ value, icon: Icon }) => <Icon key={value} aria-hidden="true" size={18} data-active={value === theme} />)}
      </summary>
      <div className="theme-menu-list" role="group" aria-label="Theme">
        {options.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" className="theme-option" aria-pressed={value === theme} onClick={() => { apply(value); setTheme(value); if (menu.current) menu.current.open = false; }}>
            <Icon aria-hidden="true" size={16} />{label}{value === theme && <Check className="theme-check" aria-hidden="true" size={16} />}
          </button>
        ))}
      </div>
    </details>
  );
}
