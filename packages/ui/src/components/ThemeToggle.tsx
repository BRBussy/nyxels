import { useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Switch } from "@/components/ui/switch";

/** (Const object + union — see lib/network.ts.) */
const Theme = {
  Light: "light",
  Dark: "dark",
} as const;
type Theme = (typeof Theme)[keyof typeof Theme];

// Read by the pre-paint script in index.html so the chosen theme applies
// before first render (no flash).
const THEME_STORAGE_KEY = "nyxels:theme";

/**
 * Sun ⇄ moon switch driving the app theme: toggles the `dark` class on <html>
 * (which the shadcn variables and all theme-aware CSS key off) and persists the
 * choice. The initial state comes from the document class, already set by the
 * index.html pre-paint script.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const handleChange = (checked: boolean) => {
    setDark(checked);
    document.documentElement.classList.toggle("dark", checked);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, checked ? Theme.Dark : Theme.Light);
    } catch {
      // Storage unavailable — the choice just won't survive a reload.
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <SunIcon className="text-muted-foreground size-3.5" />
      <Switch checked={dark} onCheckedChange={handleChange} aria-label="Dark mode" />
      <MoonIcon className="text-muted-foreground size-3.5" />
    </div>
  );
}
