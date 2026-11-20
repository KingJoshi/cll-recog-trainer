// Recognition Statistics Matrix & Per-Group Accuracy View

import { PUZZLES, getTrack, formatCaseDisplayId, getDistinctCaseName } from '../../data/algRegistry.js';
import { getCachedCaseSvg, renderCaseSvg } from '../../caseVisualizer.js';
import { GROUP_DISPLAY_ORDER, caseById } from '../../state/appStore.js';
import { escapeHtml } from '../../services/htmlUtils.js';

export function createRecogStatsView({ appStore } = {}) {
  const sortState = { col: "case", dir: "asc" };

  function render(container) {
    if (!container) return;
    const { currentPuzzle, currentTrackId } = appStore.state;
    const track = getTrack(currentPuzzle, currentTrackId);
    if (!track) return;

    let html = `
      <div class="recog-track-header">
        <div>
          <h3 class="recog-track-heading">${escapeHtml(PUZZLES[currentPuzzle]?.name || currentPuzzle)} &mdash; ${escapeHtml(track.name)}</h3>
          <p class="recog-track-desc">${escapeHtml(track.description || "")}</p>
        </div>
      </div>
    `;

    if (currentPuzzle === "222" && currentTrackId === "cll") {
      const caseNumbers = [1, 2, 3, 4, 5, 6];
      const gArrow = (col) => sortState.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

      html += `<table><thead><tr>
        <th scope="col" class="sortable" data-recog-sort="case">Group<span class="sort-icon">${gArrow("case")}</span></th>`;
      caseNumbers.forEach(c => { html += `<th scope="col">${c}</th>`; });
      html += `<th scope="col" class="sortable" data-recog-sort="shown">Total<span class="sort-icon">${gArrow("shown")}</span></th>
        <th scope="col" class="sortable" data-recog-sort="pct">Acc%<span class="sort-icon">${gArrow("pct")}</span></th>
      </tr></thead><tbody>`;

      let overallShown = 0;
      let overallCorrect = 0;

      const groupRows = GROUP_DISPLAY_ORDER.map((group, idx) => {
        let grpShown = 0;
        let grpCorrect = 0;
        const cells = caseNumbers.map(caseNum => {
          const caseId = `${group}${caseNum}`;
          if (!caseById.has(caseId)) return "<td></td>";
          const stat = appStore.getCaseStat("222", "cll", caseId);
          const correct = stat?.correct || 0;
          const shown = stat?.shown || 0;
          grpShown += shown;
          grpCorrect += correct;
          return `<td title="${caseId}: ${correct}/${shown}">${correct}/${shown}</td>`;
        }).join("");
        overallShown += grpShown;
        overallCorrect += grpCorrect;
        const pctNum = grpShown > 0 ? Math.round((grpCorrect / grpShown) * 100) : -1;
        const grpPct = grpShown > 0 ? `${pctNum}%` : "-";
        return {
          group,
          idx,
          grpShown,
          pctNum,
          rowHtml: `<tr><th scope="row">${group}</th>${cells}<td class="total">${grpCorrect}/${grpShown}</td><td class="total">${grpPct}</td></tr>`
        };
      });

      groupRows.sort((a, b) => {
        let vA = a.idx, vB = b.idx;
        if (sortState.col === "shown") { vA = a.grpShown; vB = b.grpShown; }
        else if (sortState.col === "pct") { vA = a.pctNum; vB = b.pctNum; }
        if (vA < vB) return sortState.dir === "asc" ? -1 : 1;
        if (vA > vB) return sortState.dir === "asc" ? 1 : -1;
        return 0;
      });

      html += groupRows.map(r => r.rowHtml).join("");
      const totalPct = overallShown > 0 ? `${Math.round((overallCorrect / overallShown) * 100)}%` : "-";
      html += `</tbody><tfoot><tr>
        <th scope="row">Total</th>
        <td colspan="6" class="recog-total-caption">All 40 CLL cases</td>
        <td class="total"><strong>${overallCorrect}/${overallShown}</strong></td>
        <td class="total"><strong>${totalPct}</strong></td>
      </tr></tfoot></table>`;
    } else if (track.cases && track.cases.length > 0) {
      const groups = track.groups || ["Cases"];
      let totalAttempts = 0;
      let totalCorrect = 0;
      let testedCases = 0;

      track.cases.forEach(c => {
        const stat = appStore.getCaseStat(currentPuzzle, currentTrackId, c.id);
        if (stat.shown > 0) {
          testedCases++;
          totalAttempts += stat.shown;
          totalCorrect += stat.correct;
        }
      });

      const overallPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
      const rArrow = (col) => sortState.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

      html += `
        <div class="layer-stats-grid" style="margin-bottom: 16px;">
          <div class="layer-stat-card">
            <span class="layer-stat-val">${testedCases} / ${track.cases.length}</span>
            <span class="layer-stat-lbl">Practiced</span>
          </div>
          <div class="layer-stat-card">
            <span class="layer-stat-val">${totalAttempts}</span>
            <span class="layer-stat-lbl">Attempts</span>
          </div>
          <div class="layer-stat-card highlight-best">
            <span class="layer-stat-val">${totalCorrect}</span>
            <span class="layer-stat-lbl">Correct</span>
          </div>
          <div class="layer-stat-card">
            <span class="layer-stat-val">${overallPct != null ? overallPct + "%" : "-"}</span>
            <span class="layer-stat-lbl">Accuracy</span>
          </div>
        </div>
        <div class="recog-group-tables">
      `;

      const is3x3Track = currentPuzzle === "333" || currentPuzzle === "333oh";
      const svgPuzzle = is3x3Track ? "333" : currentPuzzle;
      const showCubeCol = is3x3Track || currentPuzzle === "222" || currentPuzzle === "444" || currentPuzzle === "555";

      groups.forEach(groupName => {
        const groupCases = track.cases.filter(c => c.group === groupName);
        if (groupCases.length === 0) return;

        let gShown = 0;
        let gCorrect = 0;

        const caseItems = groupCases.map((c, idx) => {
          const stat = appStore.getCaseStat(currentPuzzle, currentTrackId, c.id);
          const shown = stat.shown || 0;
          const correct = stat.correct || 0;
          gShown += shown;
          gCorrect += correct;
          const pct = shown > 0 ? Math.round((correct / shown) * 100) : null;
          return { c, idx, shown, correct, pct, pctSort: pct != null ? pct : -1 };
        });

        caseItems.sort((a, b) => {
          let vA = a.idx, vB = b.idx;
          if (sortState.col === "name") { vA = (a.c.name || a.c.id).toLowerCase(); vB = (b.c.name || b.c.id).toLowerCase(); }
          else if (sortState.col === "shown") { vA = a.shown; vB = b.shown; }
          else if (sortState.col === "pct") { vA = a.pctSort; vB = b.pctSort; }
          if (vA < vB) return sortState.dir === "asc" ? -1 : 1;
          if (vA > vB) return sortState.dir === "asc" ? 1 : -1;
          return 0;
        });

        const rowsHtml = caseItems.map(({ c, shown, correct, pct }) => {
          const badgeClass = shown === 0 ? "badge" : (pct >= 90 ? "badge badge-green" : pct >= 70 ? "badge badge-yellow" : "badge badge-red");
          const displayId = formatCaseDisplayId(c.id);
          const displayName = getDistinctCaseName(c) || "—";
          let svgHtml = "";
          if (showCubeCol) {
            svgHtml = getCachedCaseSvg(svgPuzzle, currentTrackId, c.id);
            if (!svgHtml) {
              renderCaseSvg(svgPuzzle, currentTrackId, c).then(svg => {
                const cell = container.querySelector(`[data-recog-svg="${CSS.escape(c.id)}"]`);
                if (cell && svg) cell.innerHTML = svg;
              });
            }
          }
          return `
            <tr>
              <th scope="row"><strong>${escapeHtml(displayId)}</strong></th>
              ${showCubeCol ? `<td class="case-svg-cell"><div class="case-table-svg" data-recog-svg="${escapeHtml(c.id)}">${svgHtml}</div></td>` : ""}
              <td>${escapeHtml(displayName)}</td>
              <td>${correct} / ${shown}</td>
              <td><span class="${badgeClass}">${pct != null ? pct + "%" : "untested"}</span></td>
            </tr>
          `;
        }).join("");

        const gPct = gShown > 0 ? `${Math.round((gCorrect / gShown) * 100)}%` : "-";
        html += `
          <div class="recog-group-box">
            <div class="recog-group-head">
              <h4>${escapeHtml(groupName)} (${groupCases.length})</h4>
              <span>${gCorrect}/${gShown} correct (${gPct})</span>
            </div>
            <table class="recog-table">
              <thead>
                <tr>
                  <th scope="col" class="sortable" data-recog-sort="case" style="width: 78px;">Case<span class="sort-icon">${rArrow("case")}</span></th>
                  ${showCubeCol ? `<th scope="col" style="width: 48px;">Cube</th>` : ""}
                  <th scope="col" class="sortable" data-recog-sort="name">Name<span class="sort-icon">${rArrow("name")}</span></th>
                  <th scope="col" class="sortable" data-recog-sort="shown" style="width: 110px;">Recognition<span class="sort-icon">${rArrow("shown")}</span></th>
                  <th scope="col" class="sortable" data-recog-sort="pct" style="width: 90px;">Accuracy<span class="sort-icon">${rArrow("pct")}</span></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      });
      html += "</div>";
    } else {
      html += `
        <div class="empty-stats" style="text-align: center; padding: 24px 16px;">
          <h4>Inspection &amp; Solution Planning</h4>
          <p>${escapeHtml(track.name)} focuses on cross &amp; 1st layer inspection planning under 15s WCA regulations.</p>
          <p>Use <strong>Practice</strong> mode to drill 15s inspection, find optimal solutions, and preserve pairs/EO.</p>
        </div>
      `;
    }

    container.innerHTML = html;
    container.querySelectorAll("th[data-recog-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.recogSort;
        if (!col) return;
        if (sortState.col === col) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.col = col;
          sortState.dir = (col === "case" || col === "name") ? "asc" : "desc";
        }
        render(container);
      });
    });
  }

  return { render };
}
