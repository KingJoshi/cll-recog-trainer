// Case Visualizer barrel: re-exports color palette utilities and pure SVG case renderers

export {
  DEFAULT_CUBE_COLORS,
  CUBE_COLORS,
  FACE_COLORS,
  setCustomCubeColors,
  applyCubeColorsToCss,
  hexToRgb,
  applyColorsToThreeJSPuzzle,
  ensure3x3FoundationOpaque,
  applyColorsTo3DCube
} from './cube/cubeColors.js';

export {
  clearSvgCache,
  isOllPllSvgsPrewarmed,
  getCachedCaseSvg,
  prewarmOllPllSvgs,
  renderCaseSvg,
  renderCllSvg,
  renderOrtegaSvg,
  renderOllSvg,
  renderPllSvg,
  renderF2lSvg,
  render444ParitySvg,
  render555ParitySvg,
  renderCrossSvg
} from './cube/caseSvgRenderer.js';
