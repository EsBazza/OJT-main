"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

function currentTheme(): "light" | "dark" {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Follows the app's theme switch as well as the device setting.
export function Toaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => { observer.disconnect(); media.removeEventListener("change", update); };
  }, []);
  return <Sonner theme={theme} position="top-center" richColors closeButton duration={4000} toastOptions={{ style: { fontFamily: "var(--font-sans)", fontSize: "15px" } }} />;
}
