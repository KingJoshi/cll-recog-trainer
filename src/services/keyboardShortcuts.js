// Pure keyboard shortcut registry, combo formatting, and conflict-free normalization helpers.
// Zero DOM dependencies so it runs cleanly in Node unit tests and browser controllers.

export const SHORTCUT_CATEGORIES = [
  {
    id: "puzzles",
    title: "Puzzles",
    description: "Switch active puzzle size or event"
  },
  {
    id: "modes",
    title: "Modes",
    description: "Switch between Learn, Train, Solve, and Simulate tabs"
  },
  {
    id: "targets",
    title: "Submenus & Focus Targets",
    description: "Jump to a Learn/Train track, Timed Drill, or Full Solve when available for the current puzzle"
  },
  {
    id: "actions",
    title: "Quick Actions & Settings",
    description: "Control scrambles, cube visibility, inspection, penalties, theme, and modals"
  },
  {
    id: "moves_outer",
    title: "Outer Turns (Free Turns & Virtual Cube)",
    description: "Assign separate keys for clockwise, prime ('), and double (2) outer turns. Custom move keys also control the Virtual Smart Cube."
  },
  {
    id: "moves_wide_slice",
    title: "Wide, Slice & Rotation Moves",
    description: "Assign shortcuts for wide turns (4x4/5x5), M/E/S slices, and cube rotations"
  }
];

export const SHORTCUT_ACTIONS = [
  // Puzzles
  { id: "puzzle:222", category: "puzzles", label: "Switch to 2x2" },
  { id: "puzzle:333", category: "puzzles", label: "Switch to 3x3" },
  { id: "puzzle:333oh", category: "puzzles", label: "Switch to 3x3 OH" },
  { id: "puzzle:444", category: "puzzles", label: "Switch to 4x4" },
  { id: "puzzle:555", category: "puzzles", label: "Switch to 5x5" },
  { id: "puzzle:666", category: "puzzles", label: "Switch to 6x6" },
  { id: "puzzle:777", category: "puzzles", label: "Switch to 7x7" },
  { id: "puzzle:fto", category: "puzzles", label: "Switch to FTO" },

  // Modes
  { id: "mode:study", category: "modes", label: "Mode: Learn" },
  { id: "mode:practice", category: "modes", label: "Mode: Train" },
  { id: "mode:solve", category: "modes", label: "Mode: Solve" },
  { id: "mode:simulate", category: "modes", label: "Mode: Simulate" },

  // Submenus / Targets
  { id: "target:timer-drill", category: "targets", label: "Drill: Timer Drill" },
  { id: "target:face", category: "targets", label: "Track / Drill: 1st Face (2x2)" },
  { id: "target:layer", category: "targets", label: "Track / Drill: 1st Layer (2x2)" },
  { id: "target:lbl", category: "targets", label: "Track / Drill: LBL (2x2)" },
  { id: "target:ortega", category: "targets", label: "Track: Ortega (2x2 Learn/Train)" },
  { id: "target:cll", category: "targets", label: "Track / Drill: CLL (2x2)" },
  { id: "target:eg1", category: "targets", label: "Track / Drill: EG-1 (2x2)" },
  { id: "target:eg2", category: "targets", label: "Track / Drill: EG-2 (2x2)" },
  { id: "target:cross", category: "targets", label: "Track: White Cross (3x3 Learn/Train)" },
  { id: "target:f2l", category: "targets", label: "Track / Drill: F2L (3x3 / OH)" },
  { id: "target:oll", category: "targets", label: "Track / Drill: OLL (3x3 / OH)" },
  { id: "target:pll", category: "targets", label: "Track / Drill: PLL (3x3 / OH)" },
  { id: "target:parity", category: "targets", label: "Track / Drill: Parity (4x4 / 5x5)" },
  { id: "target:full", category: "targets", label: "Mode: Full Solve" },

  // Quick Actions & Settings
  { id: "action:newScramble", category: "actions", label: "Generate New Scramble" },
  { id: "action:toggleCube", category: "actions", label: "Toggle 3D Cube (Solve Mode)" },
  { id: "action:toggleInspection", category: "actions", label: "Toggle 15s Inspection (Solve Mode)" },
  { id: "action:toggleAlwaysWhiteBottom", category: "actions", label: "Toggle Always White Bottom (z2)" },
  { id: "action:toggleAllowAUF", category: "actions", label: "Toggle Allow AUF" },
  { id: "action:toggleShowReflection", category: "actions", label: "Toggle Reflection Facelets" },
  { id: "action:toggleOhHand", category: "actions", label: "Switch 3x3 OH Hand (Left/Right)" },
  { id: "action:toggleDark", category: "actions", label: "Toggle Dark Theme" },
  { id: "action:toggleAdvancedMode", category: "actions", label: "Toggle Basic / Advanced Stats Mode" },
  { id: "action:toggleFocusMode", category: "actions", label: "Toggle Zen / Focus Mode" },
  { id: "action:openSettings", category: "actions", label: "Open Trainer Settings" },
  { id: "action:openShortcuts", category: "actions", label: "Open Keyboard Shortcuts" },
  { id: "action:resetAngle", category: "actions", label: "Reset 3D Cube Angle" },
  { id: "action:penaltyPlus2", category: "actions", label: "Toggle +2 on Last Solve" },
  { id: "action:penaltyDnf", category: "actions", label: "Toggle DNF on Last Solve" },
  { id: "action:undoFreeMove", category: "actions", label: "Undo Last Free Turn" },
  { id: "action:resetFreeMoves", category: "actions", label: "Reset Free Turns to Scramble" },
  { id: "action:resetFreeSolved", category: "actions", label: "Reset Free Cube to Solved" },

  // Outer Turns (Clockwise, Prime, Double)
  { id: "move:U", category: "moves_outer", label: "Turn U" },
  { id: "move:U'", category: "moves_outer", label: "Turn U'" },
  { id: "move:U2", category: "moves_outer", label: "Turn U2" },
  { id: "move:D", category: "moves_outer", label: "Turn D" },
  { id: "move:D'", category: "moves_outer", label: "Turn D'" },
  { id: "move:D2", category: "moves_outer", label: "Turn D2" },
  { id: "move:L", category: "moves_outer", label: "Turn L" },
  { id: "move:L'", category: "moves_outer", label: "Turn L'" },
  { id: "move:L2", category: "moves_outer", label: "Turn L2" },
  { id: "move:R", category: "moves_outer", label: "Turn R" },
  { id: "move:R'", category: "moves_outer", label: "Turn R'" },
  { id: "move:R2", category: "moves_outer", label: "Turn R2" },
  { id: "move:F", category: "moves_outer", label: "Turn F" },
  { id: "move:F'", category: "moves_outer", label: "Turn F'" },
  { id: "move:F2", category: "moves_outer", label: "Turn F2" },
  { id: "move:B", category: "moves_outer", label: "Turn B" },
  { id: "move:B'", category: "moves_outer", label: "Turn B'" },
  { id: "move:B2", category: "moves_outer", label: "Turn B2" },

  // Wide, Slice & Rotation Moves
  { id: "move:Uw", category: "moves_wide_slice", label: "Wide Turn Uw" },
  { id: "move:Uw'", category: "moves_wide_slice", label: "Wide Turn Uw'" },
  { id: "move:Dw", category: "moves_wide_slice", label: "Wide Turn Dw" },
  { id: "move:Dw'", category: "moves_wide_slice", label: "Wide Turn Dw'" },
  { id: "move:Lw", category: "moves_wide_slice", label: "Wide Turn Lw" },
  { id: "move:Lw'", category: "moves_wide_slice", label: "Wide Turn Lw'" },
  { id: "move:Rw", category: "moves_wide_slice", label: "Wide Turn Rw" },
  { id: "move:Rw'", category: "moves_wide_slice", label: "Wide Turn Rw'" },
  { id: "move:Fw", category: "moves_wide_slice", label: "Wide Turn Fw" },
  { id: "move:Fw'", category: "moves_wide_slice", label: "Wide Turn Fw'" },
  { id: "move:Bw", category: "moves_wide_slice", label: "Wide Turn Bw" },
  { id: "move:Bw'", category: "moves_wide_slice", label: "Wide Turn Bw'" },
  { id: "move:M", category: "moves_wide_slice", label: "Slice M" },
  { id: "move:M'", category: "moves_wide_slice", label: "Slice M'" },
  { id: "move:E", category: "moves_wide_slice", label: "Slice E" },
  { id: "move:E'", category: "moves_wide_slice", label: "Slice E'" },
  { id: "move:S", category: "moves_wide_slice", label: "Slice S" },
  { id: "move:S'", category: "moves_wide_slice", label: "Slice S'" },
  { id: "move:x", category: "moves_wide_slice", label: "Rotation x" },
  { id: "move:x'", category: "moves_wide_slice", label: "Rotation x'" },
  { id: "move:y", category: "moves_wide_slice", label: "Rotation y" },
  { id: "move:y'", category: "moves_wide_slice", label: "Rotation y'" },
  { id: "move:z", category: "moves_wide_slice", label: "Rotation z" },
  { id: "move:z'", category: "moves_wide_slice", label: "Rotation z'" }
];

export const SHORTCUT_ACTION_IDS = new Set(SHORTCUT_ACTIONS.map(a => a.id));

// Standard Free Face Turns defaults (overrides can rebind or unbind with "")
export const DEFAULT_SHORTCUTS = {
  "move:U": "KeyU",
  "move:U'": "Shift+KeyU",
  "move:D": "KeyD",
  "move:D'": "Shift+KeyD",
  "move:L": "KeyL",
  "move:L'": "Shift+KeyL",
  "move:R": "KeyR",
  "move:R'": "Shift+KeyR",
  "move:F": "KeyF",
  "move:F'": "Shift+KeyF",
  "move:B": "KeyB",
  "move:B'": "Shift+KeyB",
  "action:undoFreeMove": "Backspace",
  "action:toggleFocusMode": "Shift+KeyZ"
};

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);
const MODIFIER_CODES = new Set([
  "ShiftLeft", "ShiftRight",
  "ControlLeft", "ControlRight",
  "AltLeft", "AltRight",
  "MetaLeft", "MetaRight",
  "CapsLock"
]);

const CODE_DISPLAY_LABELS = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
  Backspace: "Backspace",
  Enter: "Enter",
  Tab: "Tab",
  Delete: "Delete",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Escape: "Esc"
};

function normalizeBaseKeyToken(e) {
  const code = String(e.code || "").trim();
  if (code) return code;
  const key = String(e.key || "");
  if (!key) return "";
  if (key === " ") return "Space";
  if (/^[a-zA-Z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key;
}

/**
 * Convert a KeyboardEvent into a canonical combo string like "KeyR", "Shift+KeyR", "Alt+Digit2",
 * or "" if the event is a bare modifier key press.
 */
export function eventToKeyCombo(e) {
  if (!e) return "";
  if (MODIFIER_KEYS.has(e.key) || MODIFIER_CODES.has(e.code)) return "";
  const base = normalizeBaseKeyToken(e);
  if (!base) return "";
  const mods = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Meta");
  return mods.length ? `${mods.join("+")}+${base}` : base;
}

/**
 * Returns true if the combo is strictly reserved for timer start/stop/cancel ("Space" or "Escape").
 */
export function isReservedTimerCombo(combo) {
  return combo === "Space" || combo === "Escape";
}

/**
 * Format a canonical combo string for UI pills (e.g. "Shift+KeyR" -> "Shift + R").
 */
export function formatKeyCombo(combo) {
  if (!combo) return "";
  const parts = String(combo).split("+");
  const base = parts[parts.length - 1];
  let baseLabel = CODE_DISPLAY_LABELS[base] || base;
  if (base.startsWith("Key") && base.length === 4) {
    baseLabel = base.slice(3);
  } else if (base.startsWith("Digit") && base.length === 6) {
    baseLabel = base.slice(5);
  } else if (base.startsWith("Numpad")) {
    baseLabel = `Num ${base.slice(6)}`;
  }
  const modLabels = parts.slice(0, -1).map(m => (m === "Meta" ? "Cmd" : m));
  return [...modLabels, baseLabel].join(" + ");
}

/**
 * Sanitize user-configured shortcut override map (only keeps known action IDs and string combos).
 * Preserves "" (explicit unbinding of a default shortcut).
 */
export function sanitizeShortcutOverrides(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [actionId, combo] of Object.entries(raw)) {
    if (!SHORTCUT_ACTION_IDS.has(actionId)) continue;
    if (typeof combo !== "string") continue;
    const trimmed = combo.trim();
    if (trimmed === "" || !isReservedTimerCombo(trimmed)) {
      out[actionId] = trimmed;
    }
  }
  return out;
}

/**
 * Merge user override map onto DEFAULT_SHORTCUTS to obtain the full effective binding map.
 */
export function getEffectiveShortcutsMap(overrides = {}) {
  const cleanOverrides = sanitizeShortcutOverrides(overrides);
  return {
    ...DEFAULT_SHORTCUTS,
    ...cleanOverrides
  };
}

/**
 * Return the actionId bound to `combo` inside a { actionId: combo } map, or null if none.
 */
export function findActionForCombo(shortcutsMap = {}, combo = "") {
  if (!combo || !shortcutsMap || typeof shortcutsMap !== "object") return null;
  for (const [actionId, bound] of Object.entries(shortcutsMap)) {
    if (bound && bound === combo) return actionId;
  }
  return null;
}

/**
 * Set or clear `actionId` -> `combo` inside `overrides` while clearing any conflicting action
 * from the effective map so one key combo never maps to two actions.
 */
export function assignShortcutOverride(overrides = {}, actionId, combo = "") {
  if (!SHORTCUT_ACTION_IDS.has(actionId)) return { next: sanitizeShortcutOverrides(overrides), replacedActionId: null };
  const next = sanitizeShortcutOverrides(overrides);
  const trimmed = String(combo || "").trim();
  if (trimmed && isReservedTimerCombo(trimmed)) {
    return { next, replacedActionId: null, reserved: true };
  }

  let replacedActionId = null;
  if (trimmed) {
    const effective = getEffectiveShortcutsMap(next);
    for (const [otherId, bound] of Object.entries(effective)) {
      if (otherId !== actionId && bound === trimmed) {
        replacedActionId = otherId;
        if (otherId in DEFAULT_SHORTCUTS) next[otherId] = "";
        else delete next[otherId];
      }
    }
    if (DEFAULT_SHORTCUTS[actionId] === trimmed) {
      delete next[actionId];
    } else {
      next[actionId] = trimmed;
    }
  } else {
    // Clearing
    if (actionId in DEFAULT_SHORTCUTS) {
      next[actionId] = "";
    } else {
      delete next[actionId];
    }
  }

  return { next, replacedActionId };
}
