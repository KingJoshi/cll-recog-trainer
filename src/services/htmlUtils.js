// Pure HTML escaping, text formatting, and timestamp formatting helpers

import { getSolveTime } from './solveStats.js';

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatSolveDate(timestamp) {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const formatFullSolveDate = formatSolveDate;

export function renderSolveDateClockHtml(timestamp) {
  const dateStr = formatSolveDate(timestamp);
  if (dateStr === "-") return "-";
  const safeDate = escapeHtml(dateStr);
  return `
    <div class="solve-date-clock-wrap">
      <button type="button" class="btn-solve-date-clock" title="${safeDate}" aria-label="Solve date: ${safeDate}">&#x1F552;</button>
      <div class="solve-date-popover" role="tooltip">
        <span class="solve-date-popover-icon" aria-hidden="true">&#x1F552;</span>
        <span class="solve-date-popover-text">${safeDate}</span>
      </div>
    </div>
  `;
}

export function formatSolveTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return "-";
  if (ms < 60000) return (ms / 1000).toFixed(2);
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms % 60000) / 1000;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function formatSolveDisplay(s) {
  if (!s) return "-";
  if (s.penalty === "DNF" || s.penalty === -1) return "DNF";
  const effective = getSolveTime(s);
  const formatted = formatSolveTime(effective);
  if (s.penalty === "+2" || s.penalty === 2) return `${formatted} (+2)`;
  return formatted;
}

export function formatCfopSplitMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "-";
  return `${(ms / 1000).toFixed(2)}s`;
}
