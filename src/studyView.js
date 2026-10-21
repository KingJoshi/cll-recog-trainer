// Study View: Handles Case Grid, 3D Flashcard, and Reference Guide for any active track

import { PUZZLES, getTrack, getPreferredAlg, setPreferredAlg } from './data/algRegistry.js';

export class StudyView {
  constructor(options) {
    this.container = options.container;
    this.onSelectCase = options.onSelectCase; // (caseObj) => void
    this.onSimulateCase = options.onSimulateCase; // (caseObj, algObj) => void
    this.onPracticeCase = options.onPracticeCase; // (caseObj) => void

    this.currentPuzzle = "222";
    this.currentTrackId = "cll";
    this.currentView = "grid"; // "grid" | "detail" | "guide"
    this.activeGroupFilter = "all";
    this.selectedCaseId = null;
  }

  setTrack(puzzleId, trackId) {
    this.currentPuzzle = puzzleId;
    this.currentTrackId = trackId;
    this.activeGroupFilter = "all";
    const track = getTrack(puzzleId, trackId);
    if (track && track.cases.length > 0) {
      if (!this.selectedCaseId || !track.caseById.has(this.selectedCaseId)) {
        this.selectedCaseId = track.cases[0].id;
      }
    } else {
      this.selectedCaseId = null;
      if (trackId === "layer" || trackId === "cross") {
        this.currentView = "guide";
      }
    }
    this.render();
  }

  setView(view) {
    this.currentView = view;
    this.render();
  }

  render() {
    if (!this.container) return;
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track) return;

    this.container.innerHTML = `
      <div class="study-header">
        <div class="study-track-title-wrap">
          <h2 class="study-track-title">${track.name}</h2>
          <span class="study-track-desc">${track.description}</span>
        </div>
        <div class="study-subnav" role="group" aria-label="Study view">
          ${track.cases.length > 0 ? `
            <button type="button" class="study-subnav-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid">📋 Case Grid (${track.cases.length})</button>
            <button type="button" class="study-subnav-btn ${this.currentView === 'detail' ? 'active' : ''}" data-view="detail">🔍 3D Flashcard</button>
          ` : ''}
          <button type="button" class="study-subnav-btn ${this.currentView === 'guide' ? 'active' : ''}" data-view="guide">📖 Reference Guide</button>
        </div>
      </div>

      <div class="study-content">
        ${this.currentView === 'grid' ? this.renderGridView(track) : ''}
        ${this.currentView === 'detail' ? this.renderDetailView(track) : ''}
        ${this.currentView === 'guide' ? this.renderGuideView(track) : ''}
      </div>
    `;

    this.bindEvents(track);
  }

  renderGridView(track) {
    const groups = track.groups || [];
    const cases = track.cases || [];

    const filteredCases = this.activeGroupFilter === "all"
      ? cases
      : cases.filter(c => c.group === this.activeGroupFilter);

    return `
      <div class="study-grid-wrap">
        <div class="study-group-filter-bar" role="group" aria-label="Filter cases by group">
          <span class="study-filter-label">Group:</span>
          <button type="button" class="study-group-pill ${this.activeGroupFilter === 'all' ? 'active' : ''}" data-group="all">All (${cases.length})</button>
          ${groups.map(g => {
            const count = cases.filter(c => c.group === g).length;
            return `<button type="button" class="study-group-pill ${this.activeGroupFilter === g ? 'active' : ''}" data-group="${g}">${g} (${count})</button>`;
          }).join('')}
        </div>

        <div class="study-case-grid">
          ${filteredCases.map(c => {
            const prefAlgId = getPreferredAlg(c.id, c.algs[0]?.id);
            const activeAlg = c.algs.find(a => a.id === prefAlgId) || c.algs[0];

            return `
              <div class="study-card ${this.selectedCaseId === c.id ? 'selected' : ''}" data-case-id="${c.id}">
                <div class="study-card-head">
                  <span class="study-card-id">${c.id}</span>
                  <span class="study-card-group">${c.group}</span>
                </div>
                <div class="study-card-name">${c.name}</div>
                <div class="study-card-alg-box">
                  <div class="study-card-alg-primary">${activeAlg ? activeAlg.alg : 'No alg'}</div>
                  ${activeAlg && activeAlg.note ? `<div class="study-card-alg-note">${activeAlg.note}</div>` : ''}
                </div>

                ${c.algs.length > 1 ? `
                  <div class="study-card-algs-count">${c.algs.length} alg variants available</div>
                ` : ''}

                <div class="study-card-actions">
                  <button type="button" class="btn btn-xs btn-study-view" data-case-id="${c.id}">Detail</button>
                  <button type="button" class="btn btn-xs btn-study-sim" data-case-id="${c.id}">Simulate 3D</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderDetailView(track) {
    const c = track.caseById.get(this.selectedCaseId) || track.cases[0];
    if (!c) return `<p class="empty-state">No case selected</p>`;

    const prefAlgId = getPreferredAlg(c.id, c.algs[0]?.id);

    return `
      <div class="study-detail-view">
        <div class="study-detail-card">
          <div class="study-detail-header">
            <div class="study-detail-title-group">
              <span class="study-detail-id">${c.id}</span>
              <h3 class="study-detail-name">${c.name}</h3>
              <span class="study-detail-group">${c.group}</span>
            </div>
            <div class="study-detail-nav-btns">
              <button type="button" id="studyPrevCaseBtn" class="btn btn-xs">&larr; Prev</button>
              <button type="button" id="studyNextCaseBtn" class="btn btn-xs">Next &rarr;</button>
            </div>
          </div>

          ${c.description ? `<p class="study-detail-desc">${c.description}</p>` : ''}

          <div class="study-algs-section">
            <h4 class="study-section-title">Algorithms &amp; Fingertricks</h4>
            <div class="study-alg-list">
              ${c.algs.map(a => {
                const isPref = a.id === prefAlgId;
                return `
                  <div class="study-alg-row ${isPref ? 'preferred' : ''}">
                    <button type="button" class="study-star-btn ${isPref ? 'starred' : ''}" data-case-id="${c.id}" data-alg-id="${a.id}" title="${isPref ? 'Preferred algorithm' : 'Set as preferred algorithm'}">
                      ${isPref ? '★' : '☆'}
                    </button>
                    <div class="study-alg-info">
                      <span class="study-alg-text">${a.alg}</span>
                      ${a.note ? `<span class="study-alg-note">${a.note}</span>` : ''}
                    </div>
                    <button type="button" class="btn btn-xs btn-alg-sim" data-case-id="${c.id}" data-alg="${a.alg}">Simulate</button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="study-detail-footer">
            <button type="button" id="studyPracticeThisBtn" class="btn btn-primary btn-small" data-case-id="${c.id}">
              Practice this case &rarr;
            </button>
            <button type="button" id="studySimulateThisBtn" class="btn btn-small" data-case-id="${c.id}">
              Open in 3D Scramble Simulator
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderGuideView(track) {
    if (this.currentPuzzle === "333" && this.currentTrackId === "cross") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">⏱️ 1. WCA 15-Second Inspection for Cross</h3>
            <p>World-class 3x3 cubers solve the entire White Cross during inspection without pausing:</p>
            <ol class="guide-list guide-steps">
              <li><strong>0 – 3s (Locate Cross Edges):</strong> Find all 4 white edges (DF, DR, DB, DL). Check their orientations.</li>
              <li><strong>3 – 8s (Plan the Sequence):</strong> Trace your 4-6 moves. Look for opportunities to insert multiple edges with a single move.</li>
              <li><strong>8 – 12s (Cross+1 / First Pair):</strong> Track your first F2L corner-edge pair. Know where it will land after the cross moves.</li>
              <li><strong>12 – 15s (Fingertricks):</strong> Grip the cube and start executing blind with maximum turn speed!</li>
            </ol>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">🧭 2. Edge Orientation (EO) Principles</h3>
            <p>An edge is <strong>oriented (good)</strong> if it can be solved into its position using only <code>R, U, L, D</code> moves without requiring <code>F, B</code> turns or cube rotations.</p>
            <ul class="guide-list">
              <li><strong>Top/Bottom edges:</strong> Yellow or White facing U/D = Good.</li>
              <li><strong>Front/Back edges:</strong> Green/Blue facing F/B = Good.</li>
              <li>Solving cross edges while preserving good EO on the remaining edges gives easy, rotationless F2L pairs!</li>
            </ul>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">⚡ 3. Cross+1 (First Pair Preservation)</h3>
            <p>Instead of finishing the cross and stopping to search for pairs, plan your first F2L pair during inspection:</p>
            <ul class="guide-list">
              <li><strong>Free Pair in Slot:</strong> Cross moves naturally drop a solved F2L pair into its slot.</li>
              <li><strong>Connected Pair in U:</strong> Cross moves pair a corner and edge in the top layer for an instant 3-move insert.</li>
              <li><strong>Keyhole Technique:</strong> Insert an F2L corner or edge before making your final D-alignment move.</li>
            </ul>
          </section>
        </div>
      `;
    }

    if (this.currentPuzzle === "222" && this.currentTrackId === "layer") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">⏱️ 1. 2x2 1st Layer Fundamentals</h3>
            <p>Every 2x2 scramble has a 1st layer that can be solved in <strong>4 moves or fewer</strong>:</p>
            <ul class="guide-list">
              <li><strong>Bar Preservation:</strong> If the scramble already has 2 matching bottom pieces (a 1x2 bar), preserve it!</li>
              <li><strong>Direct Insertion:</strong> Single-move corner insertions (<code>R'</code>, <code>F</code>, <code>R</code>) are fastest.</li>
              <li><strong>Color Neutrality:</strong> Look at all 6 faces. The easiest layer is often not White!</li>
            </ul>
          </section>
        </div>
      `;
    }

    return `
      <div class="guide-card">
        <h3 class="guide-card-title">📖 ${track.name} Reference</h3>
        <p>${track.description}</p>
        <p>Use the <strong>Case Grid</strong> to browse all cases and set your preferred algorithms (★), or test yourself in the <strong>Practice</strong> tab.</p>
      </div>
    `;
  }

  bindEvents(track) {
    // Subnav view buttons
    this.container.querySelectorAll('.study-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setView(btn.dataset.view);
      });
    });

    // Group filter pills
    this.container.querySelectorAll('.study-group-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeGroupFilter = btn.dataset.group;
        this.render();
      });
    });

    // Card click in grid
    this.container.querySelectorAll('.study-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // handled by button
        this.selectedCaseId = card.dataset.caseId;
        this.setView('detail');
      });
    });

    // Detail button
    this.container.querySelectorAll('.btn-study-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCaseId = btn.dataset.caseId;
        this.setView('detail');
      });
    });

    // Simulate buttons
    this.container.querySelectorAll('.btn-study-sim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = track.caseById.get(btn.dataset.caseId);
        if (c && this.onSimulateCase) {
          const prefId = getPreferredAlg(c.id, c.algs[0]?.id);
          const algObj = c.algs.find(a => a.id === prefId) || c.algs[0];
          this.onSimulateCase(c, algObj);
        }
      });
    });

    this.container.querySelectorAll('.btn-alg-sim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = track.caseById.get(btn.dataset.caseId);
        if (c && this.onSimulateCase) {
          this.onSimulateCase(c, { alg: btn.dataset.alg });
        }
      });
    });

    // Star preferred algorithm button
    this.container.querySelectorAll('.study-star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const caseId = btn.dataset.caseId;
        const algId = btn.dataset.algId;
        setPreferredAlg(caseId, algId);
        this.render();
      });
    });

    // Prev / Next case in detail view
    const prevBtn = this.container.querySelector('#studyPrevCaseBtn');
    const nextBtn = this.container.querySelector('#studyNextCaseBtn');
    if (prevBtn && nextBtn) {
      const cases = track.cases;
      const idx = cases.findIndex(c => c.id === this.selectedCaseId);
      prevBtn.addEventListener('click', () => {
        const nextIdx = (idx - 1 + cases.length) % cases.length;
        this.selectedCaseId = cases[nextIdx].id;
        this.render();
      });
      nextBtn.addEventListener('click', () => {
        const nextIdx = (idx + 1) % cases.length;
        this.selectedCaseId = cases[nextIdx].id;
        this.render();
      });
    }

    // Practice this case button
    const practiceBtn = this.container.querySelector('#studyPracticeThisBtn');
    if (practiceBtn) {
      practiceBtn.addEventListener('click', () => {
        const c = track.caseById.get(practiceBtn.dataset.caseId);
        if (c && this.onPracticeCase) {
          this.onPracticeCase(c);
        }
      });
    }

    // Open in simulator button
    const simBtn = this.container.querySelector('#studySimulateThisBtn');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const c = track.caseById.get(simBtn.dataset.caseId);
        if (c && this.onSimulateCase) {
          const prefId = getPreferredAlg(c.id, c.algs[0]?.id);
          const algObj = c.algs.find(a => a.id === prefId) || c.algs[0];
          this.onSimulateCase(c, algObj);
        }
      });
    }
  }
}
