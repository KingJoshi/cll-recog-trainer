// Theme & 3BLD Color Palette Customization, Presets, Sanitization, and CSS Variable Sync

export const DEFAULT_THEME_COLORS = {
  light: {
    bg: "#eef1f5",
    surface: "#ffffff",
    text: "#1f2933",
    muted: "#667085",
    border: "#d5dbe3",
    primary: "#007bff"
  },
  dark: {
    bg: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    muted: "#94a3b8",
    border: "#334155",
    primary: "#3b82f6"
  },
  bld: {
    buffer: "#7c3aed",
    target: "#059669",
    pair: "#2563eb",
    parity: "#d97706"
  }
};

export const THEME_COLOR_FIELDS = {
  light: [
    { key: "bg", label: "Page Background" },
    { key: "surface", label: "Card & Panel Surface" },
    { key: "text", label: "Primary Text" },
    { key: "muted", label: "Muted Text" },
    { key: "border", label: "Borders & Dividers" },
    { key: "primary", label: "Primary Accent" }
  ],
  dark: [
    { key: "bg", label: "Page Background" },
    { key: "surface", label: "Card & Panel Surface" },
    { key: "text", label: "Primary Text" },
    { key: "muted", label: "Muted Text" },
    { key: "border", label: "Borders & Dividers" },
    { key: "primary", label: "Primary Accent" }
  ],
  bld: [
    { key: "buffer", label: "Buffer Highlight" },
    { key: "target", label: "Target Highlight" },
    { key: "pair", label: "Letter Pair Chip" },
    { key: "parity", label: "Parity / Ra-Perm" }
  ]
};

export const THEME_COLOR_PRESETS = {
  light: {
    classic: { ...DEFAULT_THEME_COLORS.light },
    paper: {
      bg: "#f5f1e8",
      surface: "#fffdf9",
      text: "#292524",
      muted: "#78716c",
      border: "#dfd7c8",
      primary: "#4f46e5"
    },
    mint: {
      bg: "#edf5f2",
      surface: "#ffffff",
      text: "#132a23",
      muted: "#4d6b61",
      border: "#c7ded5",
      primary: "#059669"
    }
  },
  dark: {
    slate: { ...DEFAULT_THEME_COLORS.dark },
    oled: {
      bg: "#090d16",
      surface: "#111827",
      text: "#f8fafc",
      muted: "#9ca3af",
      border: "#263042",
      primary: "#06b6d4"
    },
    nord: {
      bg: "#1c2029",
      surface: "#272d3a",
      text: "#eceff4",
      muted: "#a5b1c2",
      border: "#3b4252",
      primary: "#8b5cf6"
    }
  },
  bld: {
    classic: { ...DEFAULT_THEME_COLORS.bld },
    "high-contrast": {
      buffer: "#d946ef",
      target: "#16a34a",
      pair: "#0284c7",
      parity: "#ea580c"
    },
    oceanic: {
      buffer: "#6366f1",
      target: "#0d9488",
      pair: "#0ea5e9",
      parity: "#eab308"
    }
  }
};

/**
 * Normalize #RGB or #RRGGBB hex strings to lowercase #rrggbb; return null if invalid.
 */
export function sanitizeThemeHex(val) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function hexToRgbTuple(hex) {
  const clean = sanitizeThemeHex(hex) || "#007bff";
  const num = parseInt(clean.slice(1), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function sanitizeSection(rawSection, defaults) {
  const out = {};
  const src = rawSection && typeof rawSection === "object" ? rawSection : {};
  for (const [k, fallback] of Object.entries(defaults)) {
    out[k] = sanitizeThemeHex(src[k]) || fallback;
  }
  return out;
}

/**
 * Return a deep-cloned, validated themeColors object filling any missing/invalid keys from defaults.
 */
export function sanitizeThemeColors(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    light: sanitizeSection(src.light, DEFAULT_THEME_COLORS.light),
    dark: sanitizeSection(src.dark, DEFAULT_THEME_COLORS.dark),
    bld: sanitizeSection(src.bld, DEFAULT_THEME_COLORS.bld)
  };
}

/**
 * Apply customized Light/Dark theme tokens and 3BLD highlight tokens to :root CSS variables.
 */
export function applyThemeColorsToCss(themeColors = DEFAULT_THEME_COLORS, darkMode = false) {
  if (typeof document === "undefined" || !document.documentElement?.style) return;
  const clean = sanitizeThemeColors(themeColors);
  const active = darkMode ? clean.dark : clean.light;
  const { bld } = clean;
  const style = document.documentElement.style;
  const [pr, pg, pb] = hexToRgbTuple(active.primary);

  style.setProperty("--bg", active.bg);
  style.setProperty("--surface", active.surface);
  style.setProperty("--bg-panel", active.surface);
  style.setProperty("--bg-card", active.surface);

  const surface2 = darkMode
    ? `color-mix(in srgb, ${active.surface} 90%, ${active.text})`
    : `color-mix(in srgb, ${active.surface} 55%, ${active.bg})`;
  const bgSubtle = darkMode
    ? `color-mix(in srgb, ${active.surface} 55%, ${active.bg})`
    : `color-mix(in srgb, ${active.surface} 75%, ${active.bg})`;

  style.setProperty("--surface-2", surface2);
  style.setProperty("--bg-surface", surface2);
  style.setProperty("--bg-subtle", bgSubtle);

  style.setProperty("--text", active.text);
  style.setProperty("--ink", active.text);
  style.setProperty("--muted", active.muted);
  style.setProperty("--text-muted", active.muted);

  style.setProperty("--border", active.border);
  style.setProperty("--border-subtle", `color-mix(in srgb, ${active.border} 65%, ${active.surface})`);

  style.setProperty("--primary", active.primary);
  style.setProperty("--accent", active.primary);
  style.setProperty(
    "--primary-dark",
    darkMode
      ? `color-mix(in srgb, ${active.primary} 74%, #ffffff)`
      : `color-mix(in srgb, ${active.primary} 82%, #000000)`
  );
  style.setProperty("--primary-soft", `rgba(${pr}, ${pg}, ${pb}, ${darkMode ? 0.2 : 0.12})`);
  style.setProperty("--accent-soft", `rgba(${pr}, ${pg}, ${pb}, ${darkMode ? 0.2 : 0.12})`);
  style.setProperty("--accent-subtle", `rgba(${pr}, ${pg}, ${pb}, ${darkMode ? 0.14 : 0.08})`);

  style.setProperty("--bld-buffer", bld.buffer);
  style.setProperty("--bld-target", bld.target);
  style.setProperty("--bld-pair", bld.pair);
  style.setProperty("--bld-parity", bld.parity);

  if (typeof document.querySelector === "function") {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", darkMode ? active.bg : active.primary);
    }
  }
}
