// 3BLD (Blindfolded) Guide Renderer: Speffz Letter Scheme, Buffer/Target Slots, Old Pochmann & Parity

import { escapeHtml } from '../../services/htmlUtils.js';

export const SPEFFZ_CORNERS = [
  {
    piece: 'UBL',
    role: 'buffer',
    note: 'Corner Buffer (Old Pochmann)',
    faces: [
      { face: 'U', letter: 'A', role: 'buffer', setup: 'Buffer piece' },
      { face: 'L', letter: 'E', role: 'buffer', setup: 'OP Buffer sticker' },
      { face: 'B', letter: 'R', role: 'buffer', setup: 'Buffer piece' }
    ]
  },
  {
    piece: 'UBR',
    faces: [
      { face: 'U', letter: 'B', setup: 'R2' },
      { face: 'R', letter: 'N', setup: "R' F" },
      { face: 'B', letter: 'Q', setup: "R D'" }
    ]
  },
  {
    piece: 'UFR',
    faces: [
      { face: 'U', letter: 'C', setup: "R2 D'" },
      { face: 'F', letter: 'J', setup: "R'" },
      { face: 'R', letter: 'M', setup: 'F' }
    ]
  },
  {
    piece: 'UFL',
    faces: [
      { face: 'U', letter: 'D', setup: 'F2' },
      { face: 'L', letter: 'F', setup: "F' D" },
      { face: 'F', letter: 'I', setup: "F R'" }
    ]
  },
  {
    piece: 'DFL',
    faces: [
      { face: 'D', letter: 'U', setup: 'D' },
      { face: 'L', letter: 'G', setup: "F'" },
      { face: 'F', letter: 'L', setup: 'D2 R' }
    ]
  },
  {
    piece: 'DFR',
    role: 'target',
    note: 'Corner Target (OP Mod-Y)',
    faces: [
      { face: 'D', letter: 'V', role: 'target', setup: '(none — direct Target)' },
      { face: 'F', letter: 'K', setup: "R' D'" },
      { face: 'R', letter: 'P', setup: 'R F' }
    ]
  },
  {
    piece: 'DBR',
    faces: [
      { face: 'D', letter: 'W', setup: "D'" },
      { face: 'R', letter: 'O', setup: 'R2 F' },
      { face: 'B', letter: 'T', setup: 'R' }
    ]
  },
  {
    piece: 'DBL',
    faces: [
      { face: 'D', letter: 'X', setup: 'D2' },
      { face: 'L', letter: 'H', setup: "D' R" },
      { face: 'B', letter: 'S', setup: "D F'" }
    ]
  }
];

export const SPEFFZ_EDGES = [
  {
    piece: 'UB',
    faces: [
      { face: 'U', letter: 'A', setup: 'Direct: Ja-Perm (no setup)' },
      { face: 'B', letter: 'Q', setup: "Lw' D L2" }
    ]
  },
  {
    piece: 'UR',
    role: 'buffer',
    note: 'Edge Buffer (Old Pochmann)',
    faces: [
      { face: 'U', letter: 'B', role: 'buffer', setup: 'OP Buffer sticker' },
      { face: 'R', letter: 'M', role: 'buffer', setup: 'Buffer piece' }
    ]
  },
  {
    piece: 'UF',
    faces: [
      { face: 'U', letter: 'C', setup: 'Direct: Jb-Perm (no setup)' },
      { face: 'F', letter: 'I', setup: "Lw D' L2" }
    ]
  },
  {
    piece: 'UL',
    role: 'target',
    note: 'Edge Target (OP T-Perm)',
    faces: [
      { face: 'U', letter: 'D', role: 'target', setup: '(none — direct Target)' },
      { face: 'L', letter: 'E', setup: "L Dw' L" }
    ]
  },
  {
    piece: 'FL',
    faces: [
      { face: 'F', letter: 'L', setup: "L'" },
      { face: 'L', letter: 'F', setup: "Dw' L" }
    ]
  },
  {
    piece: 'FR',
    faces: [
      { face: 'F', letter: 'J', setup: 'Dw2 L' },
      { face: 'R', letter: 'P', setup: "Dw' L'" }
    ]
  },
  {
    piece: 'BR',
    faces: [
      { face: 'B', letter: 'T', setup: "Dw2 L'" },
      { face: 'R', letter: 'N', setup: 'Dw L' }
    ]
  },
  {
    piece: 'BL',
    faces: [
      { face: 'B', letter: 'R', setup: 'L' },
      { face: 'L', letter: 'H', setup: "Dw L'" }
    ]
  },
  {
    piece: 'DF',
    faces: [
      { face: 'D', letter: 'U', setup: "D' L2" },
      { face: 'F', letter: 'K', setup: 'Lw D L2' }
    ]
  },
  {
    piece: 'DR',
    faces: [
      { face: 'D', letter: 'V', setup: 'D2 L2' },
      { face: 'R', letter: 'O', setup: "D2 L Dw L'" }
    ]
  },
  {
    piece: 'DB',
    faces: [
      { face: 'D', letter: 'W', setup: 'D L2' },
      { face: 'B', letter: 'S', setup: "Lw' D' L2" }
    ]
  },
  {
    piece: 'DL',
    faces: [
      { face: 'D', letter: 'X', setup: 'L2' },
      { face: 'L', letter: 'G', setup: "L Dw L'" }
    ]
  }
];

const NET_FACES = [
  {
    id: 'U',
    label: 'U (White)',
    col: 1,
    row: 0,
    bg: '#ffffff',
    textColor: '#0f172a',
    corners: ['A', 'B', 'C', 'D'], // TL, TR, BR, BL
    edges: ['A', 'B', 'C', 'D']    // T, R, B, L
  },
  {
    id: 'L',
    label: 'L (Orange)',
    col: 0,
    row: 1,
    bg: '#f97316',
    textColor: '#0f172a',
    corners: ['E', 'F', 'G', 'H'],
    edges: ['E', 'F', 'G', 'H']
  },
  {
    id: 'F',
    label: 'F (Green)',
    col: 1,
    row: 1,
    bg: '#16a34a',
    textColor: '#ffffff',
    corners: ['I', 'J', 'K', 'L'],
    edges: ['I', 'J', 'K', 'L']
  },
  {
    id: 'R',
    label: 'R (Red)',
    col: 2,
    row: 1,
    bg: '#dc2626',
    textColor: '#ffffff',
    corners: ['M', 'N', 'O', 'P'],
    edges: ['M', 'N', 'O', 'P']
  },
  {
    id: 'B',
    label: 'B (Blue)',
    col: 3,
    row: 1,
    bg: '#2563eb',
    textColor: '#ffffff',
    corners: ['Q', 'R', 'S', 'T'],
    edges: ['Q', 'R', 'S', 'T']
  },
  {
    id: 'D',
    label: 'D (Yellow)',
    col: 1,
    row: 2,
    bg: '#facc15',
    textColor: '#0f172a',
    corners: ['U', 'V', 'W', 'X'],
    edges: ['U', 'V', 'W', 'X']
  }
];

export function renderSpeffzNetSvg(kind = 'corners') {
  const isCorners = kind !== 'edges';
  const bufferLetters = isCorners ? new Set(['E']) : new Set(['B']);
  const bufferPieceOther = isCorners ? new Set(['A', 'R']) : new Set(['M']);
  const targetLetters = isCorners ? new Set(['V']) : new Set(['D']);

  const st = 22;
  const gap = 8;
  const faceSize = st * 3;
  const pad = 10;
  const width = pad * 2 + faceSize * 4 + gap * 3;
  const height = pad * 2 + faceSize * 3 + gap * 2;

  const cornerPos = [
    [0, 0], // TL
    [2, 0], // TR
    [2, 2], // BR
    [0, 2]  // BL
  ];
  const edgePos = [
    [1, 0], // T
    [2, 1], // R
    [1, 2], // B
    [0, 1]  // L
  ];

  let body = '';
  for (const face of NET_FACES) {
    const fx = pad + face.col * (faceSize + gap);
    const fy = pad + face.row * (faceSize + gap);
    const letterAt = new Map();
    if (isCorners) {
      cornerPos.forEach(([cx, cy], idx) => letterAt.set(`${cx},${cy}`, face.corners[idx]));
    } else {
      edgePos.forEach(([ex, ey], idx) => letterAt.set(`${ex},${ey}`, face.edges[idx]));
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = fx + c * st;
        const y = fy + r * st;
        const isCenter = r === 1 && c === 1;
        const ltr = letterAt.get(`${c},${r}`) || '';
        const isActive = Boolean(ltr);
        const isBuffer = bufferLetters.has(ltr);
        const isBufferCo = bufferPieceOther.has(ltr);
        const isTarget = targetLetters.has(ltr);

        let stroke = '#1e293b';
        let strokeW = 1.1;
        let fillOpacity = isActive ? 1 : 0.34;
        if (isCenter) fillOpacity = 0.88;

        let ringHtml = '';
        if (isBuffer) {
          stroke = '#7c3aed';
          strokeW = 2.4;
          ringHtml = `<rect x="${x + 1.5}" y="${y + 1.5}" width="${st - 3}" height="${st - 3}" rx="2" fill="none" stroke="#7c3aed" stroke-width="1.6"/>`;
        } else if (isTarget) {
          stroke = '#059669';
          strokeW = 2.4;
          ringHtml = `<rect x="${x + 1.5}" y="${y + 1.5}" width="${st - 3}" height="${st - 3}" rx="2" fill="none" stroke="#059669" stroke-width="1.6"/>`;
        } else if (isBufferCo) {
          ringHtml = `<rect x="${x + 1.5}" y="${y + 1.5}" width="${st - 3}" height="${st - 3}" rx="2" fill="none" stroke="#7c3aed" stroke-width="1.1" stroke-dasharray="2.5 1.5"/>`;
        }

        body += `<rect x="${x}" y="${y}" width="${st}" height="${st}" rx="2.5" fill="${face.bg}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeW}"/>${ringHtml}`;

        if (isCenter) {
          body += `<text x="${x + st / 2}" y="${y + st / 2 + 3.5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${face.textColor}" font-family="system-ui, sans-serif">${face.id}</text>`;
        } else if (ltr) {
          body += `<text x="${x + st / 2}" y="${y + st / 2 + 4}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${face.textColor}" font-family="ui-monospace, SFMono-Regular, monospace">${ltr}</text>`;
        }
      }
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="bld-net-svg" role="img" aria-label="Speffz ${isCorners ? 'Corners' : 'Edges'} unfolded cube net diagram">
      ${body}
    </svg>
  `;
}

function renderFaceBadge(letter, role) {
  const cls = role === 'buffer'
    ? 'bld-letter-pill bld-letter-buffer'
    : role === 'target'
      ? 'bld-letter-pill bld-letter-target'
      : 'bld-letter-pill';
  const suffix = role === 'buffer' ? ' (Buffer)' : role === 'target' ? ' (Target)' : '';
  return `<span class="${cls}">${escapeHtml(letter)}${suffix ? `<small>${escapeHtml(suffix)}</small>` : ''}</span>`;
}

export function render3BldGuideHtml() {
  const cornerRows = SPEFFZ_CORNERS.map(item => {
    const faceChips = item.faces.map(f =>
      `<span class="bld-face-chip">${renderFaceBadge(f.letter, f.role)} <code>${escapeHtml(f.face)}</code></span>`
    ).join('');
    const setupLines = item.faces
      .filter(f => f.setup)
      .map(f => `<span class="bld-setup-item"><strong>${escapeHtml(f.letter)}</strong>: <code>${escapeHtml(f.setup)}</code></span>`)
      .join('');
    return `
      <tr class="${item.role ? `is-${item.role}-row` : ''}">
        <td><strong>${escapeHtml(item.piece)}</strong>${item.note ? `<div class="bld-row-note">${escapeHtml(item.note)}</div>` : ''}</td>
        <td><div class="bld-face-list">${faceChips}</div></td>
        <td><div class="bld-setup-list">${setupLines}</div></td>
      </tr>
    `;
  }).join('');

  const edgeRows = SPEFFZ_EDGES.map(item => {
    const faceChips = item.faces.map(f =>
      `<span class="bld-face-chip">${renderFaceBadge(f.letter, f.role)} <code>${escapeHtml(f.face)}</code></span>`
    ).join('');
    const setupLines = item.faces
      .filter(f => f.setup)
      .map(f => `<span class="bld-setup-item"><strong>${escapeHtml(f.letter)}</strong>: <code>${escapeHtml(f.setup)}</code></span>`)
      .join('');
    return `
      <tr class="${item.role ? `is-${item.role}-row` : ''}">
        <td><strong>${escapeHtml(item.piece)}</strong>${item.note ? `<div class="bld-row-note">${escapeHtml(item.note)}</div>` : ''}</td>
        <td><div class="bld-face-list">${faceChips}</div></td>
        <td><div class="bld-setup-list">${setupLines}</div></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="guide-card-stack">
      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F524; Standard 3BLD Orientation &amp; Speffz Letter Scheme (A&ndash;X)</h3>
        <p>
          Always memorize and solve from a <strong>fixed cube orientation</strong> &mdash; never rotate the cube mid-solve.
          Standard WCA orientation holds <strong>White on Top (<code>U</code>)</strong> and <strong>Green in Front (<code>F</code>)</strong>
          (Left = Orange, Right = Red, Back = Blue, Down = Yellow).
          Each of the 6 faces labels its 4 corners and 4 edges clockwise starting from the top-left:
          <code>U: A&ndash;D</code>, <code>L: E&ndash;H</code>, <code>F: I&ndash;L</code>, <code>R: M&ndash;P</code>, <code>B: Q&ndash;T</code>, <code>D: U&ndash;X</code>.
        </p>

        <div class="bld-net-legend">
          <span class="bld-legend-chip"><span class="bld-legend-swatch is-buffer"></span> Buffer Sticker (E = Corner LUB, B = Edge UR)</span>
          <span class="bld-legend-chip"><span class="bld-legend-swatch is-target"></span> Target Slot (V = Corner DFR, D = Edge UL)</span>
        </div>

        <div class="bld-nets-grid">
          <div class="bld-net-card">
            <h4 class="bld-net-title">Speffz Edges (24 Stickers &middot; A&ndash;X)</h4>
            <p class="bld-net-sub">Buffer: <strong>B</strong> (<code>UR</code> edge, U sticker) &rarr; Target: <strong>D</strong> (<code>UL</code> edge, U sticker)</p>
            ${renderSpeffzNetSvg('edges')}
          </div>
          <div class="bld-net-card">
            <h4 class="bld-net-title">Speffz Corners (24 Stickers &middot; A&ndash;X)</h4>
            <p class="bld-net-sub">Buffer: <strong>E</strong> (<code>LUB</code> corner, L sticker) &rarr; Target: <strong>V</strong> (<code>DFR</code> corner, D sticker)</p>
            ${renderSpeffzNetSvg('corners')}
          </div>
        </div>
      </section>

      <div class="guide-grid">
        <section class="guide-card">
          <h3 class="guide-card-title">&#x1F9E9; Solving Edges (Old Pochmann &middot; T-Perm)</h3>
          <p>
            You solve <strong>one edge sticker at a time</strong> by swapping your <strong>Buffer <code>B</code> (UR)</strong> with your <strong>Target slot <code>D</code> (UL)</strong> using a commutator-style 3-step loop:
          </p>
          <ol class="guide-list guide-steps">
            <li><strong>Look at Buffer <code>UR</code> (<code>B/M</code>):</strong> Read which letter sticker is currently sitting on the <code>U</code> face of <code>UR</code> (that is your next target!).</li>
            <li><strong>Setup Moves:</strong> Move that target sticker into <strong><code>D</code> (<code>UL</code> U-face)</strong> using only <code>L, D, Lw, Dw</code> moves (so <code>UR</code>, <code>UFR</code>, and <code>UBR</code> stay untouched!).</li>
            <li><strong>Swap Algorithm (T-Perm):</strong> Run <code>R U R' U' R' F R2 U' R' U' R U R' F'</code> (swaps <code>B &harr; D</code> edges and temporarily swaps <code>UFR &harr; UBR</code> corners).</li>
            <li><strong>Undo Setup:</strong> Reverse your exact setup moves in opposite order.</li>
          </ol>
          <p>
            <strong>No-Setup Shortcuts for <code>A</code> and <code>C</code>:</strong>
            Use <strong>Ja-Perm</strong> (<code>x R2 F R F' R U2 r' U r U2 x'</code>) directly for <code>A (UB)</code>, and <strong>Jb-Perm</strong> (<code>R U R' F' R U R' U' R' F R2 U' R' U'</code>) directly for <code>C (UF)</code>!
          </p>
        </section>

        <section class="guide-card">
          <h3 class="guide-card-title">&#x1F537; Solving Corners (Old Pochmann &middot; Mod Y-Perm)</h3>
          <p>
            Corners solve using the same <strong>Setup &rarr; Swap &rarr; Undo Setup</strong> loop around <strong>Buffer <code>E</code> (<code>LUB</code> Left)</strong> and <strong>Target <code>V</code> (<code>DFR</code> Down)</strong>:
          </p>
          <ol class="guide-list guide-steps">
            <li><strong>Look at Buffer <code>LUB</code> (<code>A/E/R</code>):</strong> Read which target letter sticker is currently sitting on the <code>L</code> face of <code>UBL</code> (the <code>E</code> position).</li>
            <li><strong>Setup Moves:</strong> Move that target sticker to <strong><code>V</code> (<code>DFR</code> D-face)</strong> using only <code>R, D, F</code> moves (protecting <code>UBL</code>, <code>UB</code>, and <code>UL</code>!).</li>
            <li><strong>Swap Algorithm (Modified Y-Perm):</strong> Run <code>R U' R' U' R U R' F' R U R' U' R' F R</code> (standard Y-Perm without the leading <code>F</code> and trailing <code>F'</code>; swaps <code>E &harr; V</code> corners and temporarily swaps <code>UB &harr; UL</code> edges).</li>
            <li><strong>Undo Setup:</strong> Undo your <code>R, D, F</code> setup moves cleanly.</li>
          </ol>
        </section>

        <section class="guide-card">
          <h3 class="guide-card-title">&#x2696;&#xFE0F; Parity (Odd Letter Count)</h3>
          <p>
            Every <strong>T-Perm / Ja / Jb</strong> (edges) swaps <code>UFR &harr; UBR</code> corners, and every <strong>Mod Y-Perm</strong> (corners) swaps <code>UB &harr; UL</code> edges. On any valid scramble, edge letter count and corner letter count are <strong>either both even or both odd</strong>:
          </p>
          <ul class="guide-list">
            <li><strong>Even Count:</strong> Corners &amp; Edges cancel themselves back to solved automatically &mdash; no parity alg needed!</li>
            <li><strong>Odd Count (Parity!):</strong> After solving all <strong>Edges</strong> and before starting <strong>Corners</strong>, run <strong>Ra-Perm</strong> once:
              <br><code>R U' R' U' R U R D R' U' R D' R' U2 R' U'</code>
              <br>Ra-Perm fixes the <code>UFR &harr; UBR</code> swap left by the odd number of edge swaps and pre-swaps <code>UB &harr; UL</code> so your odd number of corner swaps cancels it out!</li>
          </ul>
        </section>

        <section class="guide-card">
          <h3 class="guide-card-title">&#x1F9E0; Cycle Breaks, Flips/Twists &amp; Memorization</h3>
          <ul class="guide-list">
            <li><strong>Cycle Break (Buffer Solved Early):</strong> If your Buffer piece returns home (either orientation) before all pieces are solved, shoot to <em>any unsolved letter</em> (e.g. <code>C</code> or <code>D</code>), memorize that letter to start a new cycle, and continue until you return to that same piece to close the cycle!</li>
            <li><strong>Flipped Edge / Twisted Corner in Place:</strong> Pick either sticker on that unsolved spot (e.g. <code>I</code> on <code>UF</code>, then shoot its partner sticker <code>C</code>; or twist corner via 2 shots like <code>C &rarr; M</code>). In just 2 shots it reorients in place!</li>
            <li><strong>Recommended Order (Audio + Visual):</strong> Memorize <strong>Corners first</strong> (images / letter-pair words), then <strong>Edges</strong> (short-term audio sounds). Don&rsquo;t forget the blindfold goes on &rarr; execute <strong>Edges &rarr; Parity (if odd) &rarr; Corners</strong>!</li>
            <li><strong>Next Step After OP:</strong> Once sub-2:00 with Old Pochmann, upgrade Edges to <strong>M2</strong> (<code>DF</code> buffer &rarr; <code>UB</code> target via <code>M2</code>) while keeping OP Corners.</li>
          </ul>
        </section>
      </div>

      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F4CB; Complete Piece-by-Piece Speffz Naming &amp; OP Setup Reference</h3>
        <div class="bld-tables-grid">
          <div class="bld-table-card">
            <h4 class="bld-table-title">All 12 Edges (24 Stickers &rarr; OP Target <code>D / UL</code>)</h4>
            <div class="bld-table-scroll">
              <table class="bld-letter-table">
                <thead>
                  <tr>
                    <th scope="col">Edge</th>
                    <th scope="col">Faces &amp; Letters</th>
                    <th scope="col">Setup to <code>D</code> (T-Perm)</th>
                  </tr>
                </thead>
                <tbody>${edgeRows}</tbody>
              </table>
            </div>
          </div>

          <div class="bld-table-card">
            <h4 class="bld-table-title">All 8 Corners (24 Stickers &rarr; OP Target <code>V / DFR</code>)</h4>
            <div class="bld-table-scroll">
              <table class="bld-letter-table">
                <thead>
                  <tr>
                    <th scope="col">Corner</th>
                    <th scope="col">Faces &amp; Letters</th>
                    <th scope="col">Setup to <code>V</code> (Mod Y-Perm)</th>
                  </tr>
                </thead>
                <tbody>${cornerRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}
