// Shared inline SVG icon primitives & Legend helper so Play, Step, Skip, Reset, and Popup controls
// look crisp and unmistakably distinct across Study, Simulate, Replay, QuickSim, and 1st-Layer cards.

export const ICON_SKIP_START = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3.2" width="1.6" height="9.6" rx="0.5"/><polygon points="8.6,3.4 4.1,8 8.6,12.6"/><polygon points="13.8,3.4 9.3,8 13.8,12.6"/></svg>`;

export const ICON_STEP_BACK = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><polygon points="9.8,3.2 4,8 9.8,12.8"/><rect x="10.8" y="3.2" width="1.8" height="9.6" rx="0.5"/></svg>`;

export const ICON_PLAY = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><polygon points="4.5,2.8 13.2,8 4.5,13.2"/></svg>`;

export const ICON_PAUSE = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3.2" width="2.8" height="9.6" rx="0.6"/><rect x="9.2" y="3.2" width="2.8" height="9.6" rx="0.6"/></svg>`;

export const ICON_REPLAY = `<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 7.5A4.9 4.9 0 1 1 4.6 11.4"/><polyline points="2.5,4.2 3.1,7.7 6.5,6.8"/></svg>`;

export const ICON_STEP_FORWARD = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.4" y="3.2" width="1.8" height="9.6" rx="0.5"/><polygon points="6.4,3.2 12.2,8 6.4,12.8"/></svg>`;

export const ICON_SKIP_END = `<svg class="ui-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><polygon points="2.2,3.4 6.7,8 2.2,12.6"/><polygon points="7.4,3.4 11.9,8 7.4,12.6"/><rect x="12.4" y="3.2" width="1.6" height="9.6" rx="0.5"/></svg>`;

export const ICON_RESET_ANGLE = `<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.8 7.5A4.9 4.9 0 1 0 11.4 11.4"/><polyline points="13.5,4.2 12.9,7.7 9.5,6.8"/></svg>`;

export const ICON_POPUP_SIM = `<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.8 3.2H3.6A1.2 1.2 0 0 0 2.4 4.4v8a1.2 1.2 0 0 0 1.2 1.2h8a1.2 1.2 0 0 0 1.2-1.2V9.2"/><polyline points="9.6,2.4 13.6,2.4 13.6,6.4"/><line x1="8" y1="8" x2="13.4" y2="2.6"/></svg>`;

export const ICON_DIAGRAM = `<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.4" y="2.8" width="11.2" height="10.4" rx="1.4"/><line x1="8" y1="2.8" x2="8" y2="13.2"/><line x1="2.4" y1="8" x2="13.6" y2="8"/></svg>`;

export const ICON_LEGEND = `<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/><line x1="8" y1="7.4" x2="8" y2="11"/><circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none"/></svg>`;

export function renderIconLegendHtml({ includeStepBack = false, includeEnd = false } = {}) {
  const items = [
    { icon: ICON_RESET_ANGLE, label: 'Reset 3D Angle' },
    { icon: ICON_SKIP_START, label: 'Start' }
  ];
  if (includeStepBack) items.push({ icon: ICON_STEP_BACK, label: 'Prev Step' });
  items.push({ icon: ICON_PLAY, label: 'Play' });
  items.push({ icon: ICON_STEP_FORWARD, label: 'Next Step' });
  if (includeEnd) items.push({ icon: ICON_SKIP_END, label: 'End' });
  items.push({ icon: ICON_POPUP_SIM, label: 'Popup Sim' });
  items.push({ icon: ICON_DIAGRAM, label: '2D Explorer' });

  return `
    <div class="flb-icon-legend" role="note" aria-label="Control icon legend">
      ${items.map(it => `<span class="flb-legend-item">${it.icon}<span>${it.label}</span></span>`).join('')}
    </div>
  `;
}
