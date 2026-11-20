// Speedcube color palette state, CSS variable sync, and Three.js sticker/foundation color patcher

export const DEFAULT_CUBE_COLORS = {
  white:  "#ffffff",
  yellow: "#ffff00",
  green:  "#32cd32",
  blue:   "#2266ff",
  red:    "#ff0000",
  orange: "#ff8000",
  slate:  "#374151"
};

export const CUBE_COLORS = { ...DEFAULT_CUBE_COLORS };

export const FACE_COLORS = {
  U: CUBE_COLORS.yellow,
  D: CUBE_COLORS.white,
  F: CUBE_COLORS.green,
  B: CUBE_COLORS.blue,
  L: CUBE_COLORS.orange,
  R: CUBE_COLORS.red
};

const colorChangeListeners = new Set();

export function onCubeColorsChange(cb) {
  if (typeof cb === "function") {
    colorChangeListeners.add(cb);
  }
  return () => colorChangeListeners.delete(cb);
}

export function setCustomCubeColors(custom) {
  if (!custom) return;
  Object.assign(CUBE_COLORS, custom);
  FACE_COLORS.U = CUBE_COLORS.yellow;
  FACE_COLORS.D = CUBE_COLORS.white;
  FACE_COLORS.F = CUBE_COLORS.green;
  FACE_COLORS.B = CUBE_COLORS.blue;
  FACE_COLORS.L = CUBE_COLORS.orange;
  FACE_COLORS.R = CUBE_COLORS.red;
  for (const cb of colorChangeListeners) {
    try { cb(); } catch {}
  }
}

export function applyCubeColorsToCss(colors = CUBE_COLORS) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--cube-white", colors.white);
  root.style.setProperty("--cube-yellow", colors.yellow);
  root.style.setProperty("--cube-green", colors.green);
  root.style.setProperty("--cube-blue", colors.blue);
  root.style.setProperty("--cube-red", colors.red);
  root.style.setProperty("--cube-orange", colors.orange);
  root.style.setProperty("--cube-slate", colors.slate);
}

export function hexToRgb(hex) {
  if (!hex) return [255, 255, 255];
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function classifyBaseVertex(r, g, b, targets = null) {
  if (r < 40 && g < 40 && b < 40) return "black";
  if (targets) {
    for (const [name, rgb] of Object.entries(targets)) {
      if (Math.abs(r - rgb[0]) <= 2 && Math.abs(g - rgb[1]) <= 2 && Math.abs(b - rgb[2]) <= 2) {
        return name;
      }
    }
  }
  if (r > 200 && g > 200 && b > 200) return "white";
  if (r > 180 && g > 180 && b < 70) return "yellow";
  if (r < 110 && g > 150 && b < 100) return "green";
  if (r < 80 && g < 150 && b > 180) return "blue";
  if (r > 180 && g < 60 && b < 60) return "red";
  if (r > 180 && g >= 60 && g <= 180 && b < 60) return "orange";
  return null;
}

export function applyColorsToThreeJSPuzzle(p, colors = CUBE_COLORS) {
  if (!p || typeof p.traverse !== "function") return false;

  const targetRgb = {
    white: hexToRgb(colors.white || "#ffffff"),
    yellow: hexToRgb(colors.yellow || "#ffff00"),
    green: hexToRgb(colors.green || "#32cd32"),
    blue: hexToRgb(colors.blue || "#2266ff"),
    red: hexToRgb(colors.red || "#ff0000"),
    orange: hexToRgb(colors.orange || "#ff8000")
  };

  const hexTargets = {
    white: (targetRgb.white[0] << 16) | (targetRgb.white[1] << 8) | targetRgb.white[2],
    yellow: (targetRgb.yellow[0] << 16) | (targetRgb.yellow[1] << 8) | targetRgb.yellow[2],
    green: (targetRgb.green[0] << 16) | (targetRgb.green[1] << 8) | targetRgb.green[2],
    blue: (targetRgb.blue[0] << 16) | (targetRgb.blue[1] << 8) | targetRgb.blue[2],
    red: (targetRgb.red[0] << 16) | (targetRgb.red[1] << 8) | targetRgb.red[2],
    orange: (targetRgb.orange[0] << 16) | (targetRgb.orange[1] << 8) | targetRgb.orange[2]
  };

  let needsRender = false;

  // 1. Force 100% black opacity on 3x3 Cube3D foundation meshes
  if (p.experimentalFoundationMeshes && p.experimentalFoundationMeshes.length > 0) {
    try {
      p.experimentalSetFoundationOpacity?.(1.0);
    } catch {}
    for (const mesh of p.experimentalFoundationMeshes) {
      if (mesh.material) {
        mesh.material.opacity = 1.0;
        mesh.material.transparent = false;
        mesh.material.depthWrite = true;
        mesh.material.needsUpdate = true;
      }
    }
    needsRender = true;
  }

  // 2. Force 100% solid opacity on 3x3 / 3x3 OH reflection (hint) facelets
  if (p.experimentalHintStickerMeshes && p.experimentalHintStickerMeshes.length > 0) {
    for (const mesh of p.experimentalHintStickerMeshes) {
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          m.opacity = 1.0;
          m.transparent = false;
          m.depthWrite = true;
          m.needsUpdate = true;
        }
      }
    }
    needsRender = true;
  }

  if (p.kpuzzleFaceletInfo) {
    try {
      for (const orbit of Object.values(p.kpuzzleFaceletInfo)) {
        for (const piece of Object.values(orbit)) {
          const pieceArr = Array.isArray(piece) ? piece : [piece];
          for (const faceletInfo of pieceArr) {
            if (faceletInfo && faceletInfo.hintFacelet && faceletInfo.hintFacelet.material) {
              const mats = Array.isArray(faceletInfo.hintFacelet.material) ? faceletInfo.hintFacelet.material : [faceletInfo.hintFacelet.material];
              for (const m of mats) {
                m.opacity = 1.0;
                m.transparent = false;
                m.depthWrite = true;
                m.needsUpdate = true;
              }
            }
          }
        }
      }
    } catch {}
  }

  // 3. For PG3D puzzles (2x2, 4x4, 5x5): patch filler.colors palette buffers (active + source)
  if (p.filler && p.filler.colors) {
    const colorsBuf = p.filler.colors;
    let fillerModified = false;
    for (let i = 0; i < colorsBuf.length; i += 3) {
      const type = classifyBaseVertex(colorsBuf[i], colorsBuf[i + 1], colorsBuf[i + 2], targetRgb);
      if (type && targetRgb[type]) {
        const tr = targetRgb[type][0];
        const tg = targetRgb[type][1];
        const tb = targetRgb[type][2];
        if (colorsBuf[i] !== tr || colorsBuf[i + 1] !== tg || colorsBuf[i + 2] !== tb) {
          colorsBuf[i] = tr;
          colorsBuf[i + 1] = tg;
          colorsBuf[i + 2] = tb;
          fillerModified = true;
        }
      }
    }
    if (fillerModified) {
      needsRender = true;
    }
  }

  // 4. For PG3D puzzles: synchronize sticker definitions with target hex colors
  if (p.stickers) {
    try {
      for (const orbit of Object.values(p.stickers)) {
        if (!Array.isArray(orbit)) continue;
        for (const ori of orbit) {
          if (!Array.isArray(ori)) continue;
          for (const sd of ori) {
            if (!sd) continue;
            if (typeof sd.origColor === "number") {
              const r = (sd.origColor >> 16) & 255;
              const g = (sd.origColor >> 8) & 255;
              const b = sd.origColor & 255;
              const type = classifyBaseVertex(r, g, b, targetRgb);
              if (type && hexTargets[type] !== undefined) {
                const targetHex = hexTargets[type];
                if (sd.origColorStickeringMask === sd.origColor) {
                  sd.origColorStickeringMask = targetHex;
                }
                sd.origColor = targetHex;
              }
            }
            if (typeof sd.faceColor === "number") {
              const r = (sd.faceColor >> 16) & 255;
              const g = (sd.faceColor >> 8) & 255;
              const b = sd.faceColor & 255;
              const type = classifyBaseVertex(r, g, b, targetRgb);
              if (type && hexTargets[type] !== undefined) {
                sd.faceColor = hexTargets[type];
              }
            }
          }
        }
      }
    } catch {}
  }

  // 5. Traverse all nodes to enforce full black opacity, update 3x3 materials, and sync geometry colors
  p.traverse(node => {
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => {
        const isBlack = m.color && (m.color.r < 0.05 && m.color.g < 0.05 && m.color.b < 0.05);
        const isHint = m.side === 1 /* BackSide */ || (p.experimentalHintStickerMeshes && p.experimentalHintStickerMeshes.includes(node));
        if (isBlack || !m.color || isHint) {
          m.transparent = false;
          m.opacity = 1.0;
          m.depthWrite = true;
          m.needsUpdate = true;
          needsRender = true;
        }

        if (m.color && !isBlack) {
          const r = Math.round(m.color.r * 255);
          const g = Math.round(m.color.g * 255);
          const b = Math.round(m.color.b * 255);
          const type = classifyBaseVertex(r, g, b, targetRgb);
          if (type && targetRgb[type]) {
            const tr = targetRgb[type][0] / 255;
            const tg = targetRgb[type][1] / 255;
            const tb = targetRgb[type][2] / 255;
            if (Math.abs(m.color.r - tr) > 0.005 || Math.abs(m.color.g - tg) > 0.005 || Math.abs(m.color.b - tb) > 0.005) {
              m.color.setRGB(tr, tg, tb);
              m.needsUpdate = true;
              needsRender = true;
            }
          }
        }
      });
    }

    if (node.geometry && node.geometry.attributes && node.geometry.attributes.color) {
      if (node.geometry.userData && node.geometry.userData.origColors) {
        delete node.geometry.userData.origColors;
      }
      const attr = node.geometry.attributes.color;
      const cur = attr.array;
      let modified = false;
      for (let i = 0; i < cur.length; i += 3) {
        const type = classifyBaseVertex(cur[i], cur[i + 1], cur[i + 2], targetRgb);
        if (type && targetRgb[type]) {
          const tr = targetRgb[type][0];
          const tg = targetRgb[type][1];
          const tb = targetRgb[type][2];
          if (cur[i] !== tr || cur[i + 1] !== tg || cur[i + 2] !== tb) {
            cur[i] = tr;
            cur[i + 1] = tg;
            cur[i + 2] = tb;
            modified = true;
          }
        }
      }
      if (modified) {
        attr.needsUpdate = true;
        needsRender = true;
      }
    }
  });

  if (p.fixedGeo && p.fixedGeo.attributes && p.fixedGeo.attributes.color) {
    p.fixedGeo.attributes.color.needsUpdate = true;
  }

  if (needsRender) {
    p.scheduleRenderCallback?.();
  }
  return needsRender;
}

let _foundationOpaquePromise = null;
export async function ensure3x3FoundationOpaque() {
  if (typeof window === "undefined") return;
  if (_foundationOpaquePromise) return _foundationOpaquePromise;

  _foundationOpaquePromise = (async () => {
    try {
      const sdClass = customElements.get("scramble-display");
      if (sdClass) {
        const temp = new sdClass();
        temp.event = "333";
        temp.visualization = "3D";
        temp.hintFacelets = "floating";
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        temp.style.pointerEvents = "none";
        temp.style.top = "-9999px";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        const p = await temp.player.experimentalCurrentThreeJSPuzzleObject();
        if (p) {
          applyColorsToThreeJSPuzzle(p);
        }
        temp.remove();
      }
    } catch {
      // Non-critical background patch
    }
  })();
  return _foundationOpaquePromise;
}

export async function applyColorsTo3DCube(scrambleDisplayEl, colors = CUBE_COLORS) {
  if (typeof window === "undefined" || !scrambleDisplayEl) return;
  void ensure3x3FoundationOpaque();

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      if (scrambleDisplayEl.player) {
        const p = await scrambleDisplayEl.player.experimentalCurrentThreeJSPuzzleObject?.();
        if (p) {
          applyColorsToThreeJSPuzzle(p, colors);
          return p;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
}
