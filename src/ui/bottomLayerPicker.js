// Reusable Training Bottom Layer color picker (controls which bottom colors appear on 3D case drills)

import { ALL_BOTTOM_FACES, sanitizeTrainingBottomFaces } from '../services/scrambleService.js';

const FACE_META = [
  { id: "white",  short: "W", name: "White" },
  { id: "yellow", short: "Y", name: "Yellow" },
  { id: "green",  short: "G", name: "Green" },
  { id: "blue",   short: "B", name: "Blue" },
  { id: "red",    short: "R", name: "Red" },
  { id: "orange", short: "O", name: "Orange" }
];

export function renderBottomLayerPickerHtml(activeFaces = ["white"], { label = "Bottom:", showPresets = true } = {}) {
  const clean = sanitizeTrainingBottomFaces(activeFaces, ["white"]);
  const activeSet = new Set(clean);
  const isDual = clean.length === 2 && activeSet.has("white") && activeSet.has("yellow");
  const isAll = clean.length === ALL_BOTTOM_FACES.length;

  return `
    <div class="bottom-layer-picker" role="group" aria-label="Bottom layer colors for drills">
      ${label ? `<span class="bottom-layer-lbl">${label}</span>` : ""}
      <div class="bottom-layer-faces">
        ${FACE_META.map(f => {
          const isOn = activeSet.has(f.id);
          return `<button type="button" class="bottom-layer-face-btn ${isOn ? "active" : ""}" data-bottom-face="${f.id}" aria-pressed="${isOn}" title="Include ${f.name} as bottom layer">${
            `<span class="face-chip-dot face-dot-${f.id}" aria-hidden="true"></span><span>${f.short}</span>`
          }</button>`;
        }).join("")}
        ${showPresets ? `
          <button type="button" class="bottom-layer-preset-btn ${isDual ? "active" : ""}" data-bottom-preset="wy" aria-pressed="${isDual}" title="Opposite Color Neutral (White + Yellow bottom)">W/Y</button>
          <button type="button" class="bottom-layer-preset-btn ${isAll ? "active" : ""}" data-bottom-preset="all" aria-pressed="${isAll}" title="Full Color Neutral (all 6 bottom colors)">All</button>
        ` : ""}
      </div>
    </div>
  `;
}

export function bindBottomLayerPickerEvents(rootEl, getFaces, onChange) {
  if (!rootEl || typeof rootEl.querySelectorAll !== "function") return;
  rootEl.querySelectorAll("[data-bottom-face]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const face = btn.dataset.bottomFace;
      const cur = new Set(sanitizeTrainingBottomFaces(getFaces?.(), ["white"]));
      if (cur.has(face)) {
        if (cur.size <= 1) return; // Always keep at least one bottom color
        cur.delete(face);
      } else {
        cur.add(face);
      }
      const ordered = ALL_BOTTOM_FACES.filter(f => cur.has(f));
      onChange?.(ordered);
    });
  });
  rootEl.querySelectorAll("[data-bottom-preset]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const preset = btn.dataset.bottomPreset;
      const next = preset === "all" ? [...ALL_BOTTOM_FACES] : ["white", "yellow"];
      onChange?.(next);
    });
  });
}
