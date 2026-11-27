# Cubing.cc Selection Control Style Guide

To make every interactive choice in Cubing.cc self-explanatory at a glance, all selection UIs follow **two distinct visual grammars**:

## 1. Single-Select (Mutually Exclusive) &rarr; Connected Segmented Control

Use a **connected segmented tray** whenever choosing one option excludes the others (1-of-N radio behavior). No checkboxes or checkmarks are shown.

- **Classes:** `.ui-seg-group` wrapping `.ui-seg-btn` items (and domain variants `.mode-seg`, `.oh-hand-switcher`, `.settings-speed-group`, `.flb-layout-toggle`, `.practice-subnav`)
- **ARIA:** `role="radiogroup"` on the tray, `role="radio"` and `aria-checked="true|false"` (or `aria-pressed`) on options
- **Visual cues:**
  - Adjacent buttons share a unified pill/rounded tray container (`var(--surface-2)` + border).
  - Exactly one option is highlighted with a solid primary fill (`.active`) or elevated card tab.

## 2. Multi-Select (Independent Toggles / Filters) &rarr; Spaced Checkbox Chips

Use **spaced checkbox chips** whenever any subset (or 1+) of options can be toggled on at the same time. Every multi-select chip displays an explicit square checkbox indicator that turns primary blue with a white `✓` checkmark when active.

- **Classes:** `.ui-chip-group` wrapping `.ui-filter-chip` options containing `<span class="ui-chip-check" aria-hidden="true"></span>` (plus `.face-chip` / `.bottom-layer-face-btn` / `.settings-event-chip`)
- **ARIA:** `role="group"` on the container, `aria-pressed="true|false"` on each chip (or native `<input type="checkbox">`)
- **Reset & Preset Shortcuts:** Quick actions like **All**, **W/Y**, or **Core 5 Only** sit beside the chips separated by a vertical hairline `.ui-chip-divider` and styled with `.ui-chip-reset` (no checkbox box).
- **Consistent Behavior Rule:** Clicking an option in a multi-select group toggles *only* that item. Even on 2-group tracks (such as 2x2 LBL `OLL` + `PLL`), selecting both keeps both checked rather than collapsing back to `All`.

## 3. Standalone Boolean Settings &rarr; Native Checkbox Row

- **Classes:** `.solve-toggle-label`
- **Use:** Independent feature or preference switches (`input[type="checkbox"]` + label) in Settings panes and modal options.

---

## Inventory Across Cubing.cc

| Control | Mode | Visual Pattern |
| --- | --- | --- |
| Learn / Train / Solve bar, Puzzle bar, Track tabs | Single-select | Connected segmented control / tab strip |
| Learn &rarr; Case Grid `Group:` filter (CLL, LBL, Ortega, OLL, PLL, F2L) | Multi-select | Checkbox filter chips (`.ui-chip-group` + `.ui-filter-chip` + `.ui-chip-check`) + `All` reset |
| Learn &rarr; 1st Layer `Bucket:` and `Moves:` filters | Single-select | Connected segmented tray (`.ui-seg-group` + `.ui-seg-btn`) |
| Active Cases `Filter:` (`All \| Pending \| Learning \| Review \| Mastered`) | Single-select | Connected segmented tray (`.ui-seg-group`) |
| Bottom Layer colors (`W / Y / G / B / R / O`) | Multi-select | Checkbox color chips (`.ui-chip-check`) + `W/Y` / `All` shortcuts |
| 2x2 Layer &amp; 3x3 Cross solver target colors (`.face-chip`) | Multi-select | Checkbox color chips (`::before` check box + color dot) + presets |
| Visible Header Events (`settings-event-chip`) | Multi-select | Labeled checkbox chip grid |
| Experimental features list (`settings-exp-item`) | Multi-select | Native checkbox cards + Check All / Remove All |
| Stats Mode, Visibility, OLL/PLL Look mode, 2x2 Method, F2L Tier, Playback Speed, OH Hand / Style | Single-select | Connected segmented controls |
