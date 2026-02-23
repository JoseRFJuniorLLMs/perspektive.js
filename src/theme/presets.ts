/**
 * presets.ts -- Built-in theme presets for perspektive.js
 *
 * Each preset is a 100% complete PerspektiveTheme with every field populated.
 * No field is left undefined -- components can always read a value directly
 * without fallback logic.
 *
 * Available presets:
 *   - cyberpunk  (neon HDR, dark background -- the original aesthetic)
 *   - midnight   (elegant dark, subtle silver/white, minimal bloom)
 *   - paper      (academic light, black on white, no bloom)
 *   - matrix     (green terminal, heavy bloom)
 *   - aurora     (colorful rainbow, moderate bloom)
 */

import type { PerspektiveTheme } from './types';

// ==========================================
// CYBERPUNK -- The Original Aesthetic
// ==========================================

/** Neon cyberpunk theme -- the hardcoded original, now formalized. */
export const cyberpunk: PerspektiveTheme = {
  name: 'cyberpunk',

  background: '#000000',

  nodes: {
    default: {
      color: '#00ff66',
      hdrMultiplier: 2.0,
      opacity: 1.0,
      size: 1.0,
      glow: true,
      shape: 'circle',
    },
    ubermensch: {
      color: '#ff00ff',
      hdrMultiplier: 4.0,
      opacity: 1.0,
      size: 1.2,
      glow: true,
      shape: 'circle',
    },
    ubermenschThreshold: 0.8,
    byType: {
      Semantic: { color: '#00ff66' },
      Episodic: { color: '#00f0ff' },
      Concept: { color: '#f59e0b' },
      DreamSnapshot: { color: '#8b5cf6' },
      Pruned: { color: '#1e293b', hdrMultiplier: 1.0, glow: false },
    },
  },

  edges: {
    default: {
      color: '#00d8ff',
      hdrMultiplier: 1.5,
      opacity: 0.4,
      width: 1,
    },
  },

  disk: {
    fillColor: '#050510',
    borderColor: '#1e293b',
    borderOpacity: 0.3,
  },

  bloom: {
    luminanceThreshold: 0.2,
    intensity: 1.5,
    radius: 0.8,
  },

  ui: {
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00ff',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    textColor: '#ffffff',
    fontFamily: 'monospace',
    tooltipBackground: 'rgba(2, 6, 23, 0.9)',
    tooltipBorder: '#00f0ff',
    tooltipShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
    buttonActiveBackground: '#00f0ff',
    buttonActiveBorder: '#00f0ff',
    buttonInactiveColor: '#94a3b8',
    buttonInactiveBorder: '#334155',
  },

  minkowski: {
    futureConeColor: '#00f0ff',
    pastConeColor: '#ff00ff',
    coneOpacity: 0.08,
    gridColor: '#334155',
    gridSecondaryColor: '#1e293b',
  },

  riemann: {
    wireframeColor: '#1e293b',
    wireframeOpacity: 0.15,
  },

  emotion: {
    axisColor: '#334155',
    axisOpacity: 0.3,
  },

  selection: {
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00ff',
    boxSelectFill: 'rgba(0, 240, 255, 0.1)',
    boxSelectBorder: '#00f0ff',
  },
};

// ==========================================
// MIDNIGHT -- Elegant Dark
// ==========================================

/** Deep navy/indigo theme with subtle silver accents and minimal bloom. */
export const midnight: PerspektiveTheme = {
  name: 'midnight',

  background: '#0a0e1a',

  nodes: {
    default: {
      color: '#c0c8e0',
      hdrMultiplier: 1.2,
      opacity: 0.95,
      size: 1.0,
      glow: true,
      shape: 'circle',
    },
    ubermensch: {
      color: '#e8d5b7',
      hdrMultiplier: 2.0,
      opacity: 1.0,
      size: 1.3,
      glow: true,
      shape: 'diamond',
    },
    ubermenschThreshold: 0.8,
    byType: {
      Semantic: { color: '#8899bb' },
      Episodic: { color: '#a0b4d0' },
      Concept: { color: '#d4a574' },
      DreamSnapshot: { color: '#9b8ec4' },
      Pruned: { color: '#2a2e3e', hdrMultiplier: 0.8, glow: false },
    },
  },

  edges: {
    default: {
      color: '#4a5578',
      hdrMultiplier: 1.0,
      opacity: 0.25,
      width: 1,
    },
  },

  disk: {
    fillColor: '#0d1225',
    borderColor: '#2a3050',
    borderOpacity: 0.4,
  },

  bloom: {
    luminanceThreshold: 0.6,
    intensity: 0.6,
    radius: 0.4,
  },

  ui: {
    primaryColor: '#a0b4d0',
    secondaryColor: '#d4a574',
    backgroundColor: 'rgba(10, 14, 26, 0.9)',
    textColor: '#c0c8e0',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    tooltipBackground: 'rgba(10, 14, 26, 0.95)',
    tooltipBorder: '#2a3050',
    tooltipShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    buttonActiveBackground: '#1e2640',
    buttonActiveBorder: '#a0b4d0',
    buttonInactiveColor: '#5a6480',
    buttonInactiveBorder: '#1e2640',
  },

  minkowski: {
    futureConeColor: '#6080b0',
    pastConeColor: '#8060a0',
    coneOpacity: 0.06,
    gridColor: '#1e2640',
    gridSecondaryColor: '#141830',
  },

  riemann: {
    wireframeColor: '#2a3050',
    wireframeOpacity: 0.12,
  },

  emotion: {
    axisColor: '#2a3050',
    axisOpacity: 0.25,
  },

  selection: {
    primaryColor: '#a0b4d0',
    secondaryColor: '#d4a574',
    boxSelectFill: 'rgba(160, 180, 208, 0.1)',
    boxSelectBorder: '#a0b4d0',
  },
};

// ==========================================
// PAPER -- Academic / Light
// ==========================================

/** Clean light theme that looks like a research paper figure. */
export const paper: PerspektiveTheme = {
  name: 'paper',

  background: '#fafaf8',

  nodes: {
    default: {
      color: '#2d2d2d',
      hdrMultiplier: 1.0,
      opacity: 0.9,
      size: 0.9,
      glow: false,
      shape: 'circle',
    },
    ubermensch: {
      color: '#c0392b',
      hdrMultiplier: 1.0,
      opacity: 1.0,
      size: 1.4,
      glow: false,
      shape: 'diamond',
    },
    ubermenschThreshold: 0.8,
    byType: {
      Semantic: { color: '#2d2d2d' },
      Episodic: { color: '#2980b9' },
      Concept: { color: '#d35400' },
      DreamSnapshot: { color: '#8e44ad' },
      Pruned: { color: '#bdc3c7', opacity: 0.5 },
    },
  },

  edges: {
    default: {
      color: '#7f8c8d',
      hdrMultiplier: 1.0,
      opacity: 0.3,
      width: 0.5,
    },
  },

  disk: {
    fillColor: '#f0f0ec',
    borderColor: '#7f8c8d',
    borderOpacity: 0.5,
  },

  bloom: {
    luminanceThreshold: 10.0,
    intensity: 0.0,
    radius: 0.0,
  },

  ui: {
    primaryColor: '#2d2d2d',
    secondaryColor: '#c0392b',
    backgroundColor: 'rgba(250, 250, 248, 0.95)',
    textColor: '#2d2d2d',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    tooltipBackground: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: '#d5d5d0',
    tooltipShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    buttonActiveBackground: '#2d2d2d',
    buttonActiveBorder: '#2d2d2d',
    buttonInactiveColor: '#7f8c8d',
    buttonInactiveBorder: '#d5d5d0',
  },

  minkowski: {
    futureConeColor: '#2980b9',
    pastConeColor: '#c0392b',
    coneOpacity: 0.06,
    gridColor: '#d5d5d0',
    gridSecondaryColor: '#e8e8e4',
  },

  riemann: {
    wireframeColor: '#bdc3c7',
    wireframeOpacity: 0.2,
  },

  emotion: {
    axisColor: '#bdc3c7',
    axisOpacity: 0.35,
  },

  selection: {
    primaryColor: '#2980b9',
    secondaryColor: '#c0392b',
    boxSelectFill: 'rgba(41, 128, 185, 0.1)',
    boxSelectBorder: '#2980b9',
  },
};

// ==========================================
// MATRIX -- Green Terminal
// ==========================================

/** Hacker terminal aesthetic: pure black background, green phosphor glow. */
export const matrix: PerspektiveTheme = {
  name: 'matrix',

  background: '#000000',

  nodes: {
    default: {
      color: '#00ff00',
      hdrMultiplier: 2.5,
      opacity: 1.0,
      size: 1.0,
      glow: true,
      shape: 'circle',
    },
    ubermensch: {
      color: '#ffffff',
      hdrMultiplier: 5.0,
      opacity: 1.0,
      size: 1.3,
      glow: true,
      shape: 'diamond',
    },
    ubermenschThreshold: 0.8,
    byType: {
      Semantic: { color: '#00ff00' },
      Episodic: { color: '#00cc44' },
      Concept: { color: '#66ff33' },
      DreamSnapshot: { color: '#00ff88' },
      Pruned: { color: '#0a3300', hdrMultiplier: 0.5, glow: false },
    },
  },

  edges: {
    default: {
      color: '#00aa00',
      hdrMultiplier: 1.8,
      opacity: 0.35,
      width: 1,
    },
  },

  disk: {
    fillColor: '#000800',
    borderColor: '#003300',
    borderOpacity: 0.4,
  },

  bloom: {
    luminanceThreshold: 0.15,
    intensity: 2.0,
    radius: 1.0,
  },

  ui: {
    primaryColor: '#00ff00',
    secondaryColor: '#00cc44',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    textColor: '#00ff00',
    fontFamily: "'Courier New', 'Lucida Console', monospace",
    tooltipBackground: 'rgba(0, 8, 0, 0.95)',
    tooltipBorder: '#00ff00',
    tooltipShadow: '0 0 15px rgba(0, 255, 0, 0.4)',
    buttonActiveBackground: '#00ff00',
    buttonActiveBorder: '#00ff00',
    buttonInactiveColor: '#005500',
    buttonInactiveBorder: '#003300',
  },

  minkowski: {
    futureConeColor: '#00ff66',
    pastConeColor: '#00cc00',
    coneOpacity: 0.07,
    gridColor: '#003300',
    gridSecondaryColor: '#001a00',
  },

  riemann: {
    wireframeColor: '#003300',
    wireframeOpacity: 0.18,
  },

  emotion: {
    axisColor: '#003300',
    axisOpacity: 0.3,
  },

  selection: {
    primaryColor: '#00ff00',
    secondaryColor: '#ffffff',
    boxSelectFill: 'rgba(0, 255, 0, 0.08)',
    boxSelectBorder: '#00ff00',
  },
};

// ==========================================
// AURORA -- Colorful Rainbow
// ==========================================

/** Vivid aurora palette: rainbow energy gradient, pastel edges, moderate bloom. */
export const aurora: PerspektiveTheme = {
  name: 'aurora',

  background: '#080818',

  nodes: {
    default: {
      color: '#64d8cb',
      hdrMultiplier: 1.8,
      opacity: 1.0,
      size: 1.0,
      glow: true,
      shape: 'circle',
    },
    ubermensch: {
      color: '#ff6eb4',
      hdrMultiplier: 3.5,
      opacity: 1.0,
      size: 1.3,
      glow: true,
      shape: 'circle',
    },
    ubermenschThreshold: 0.8,
    byType: {
      Semantic: { color: '#5de5a0' },
      Episodic: { color: '#50c8ff' },
      Concept: { color: '#ffd166' },
      DreamSnapshot: { color: '#c77dff' },
      Pruned: { color: '#1a1a2e', hdrMultiplier: 0.8, glow: false },
    },
  },

  edges: {
    default: {
      color: '#7b68ee',
      hdrMultiplier: 1.3,
      opacity: 0.3,
      width: 1,
    },
  },

  disk: {
    fillColor: '#0a0a20',
    borderColor: '#2a2a50',
    borderOpacity: 0.35,
  },

  bloom: {
    luminanceThreshold: 0.3,
    intensity: 1.2,
    radius: 0.6,
  },

  ui: {
    primaryColor: '#50c8ff',
    secondaryColor: '#ff6eb4',
    backgroundColor: 'rgba(8, 8, 24, 0.85)',
    textColor: '#e0e0f0',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    tooltipBackground: 'rgba(10, 10, 32, 0.92)',
    tooltipBorder: '#50c8ff',
    tooltipShadow: '0 0 12px rgba(80, 200, 255, 0.35)',
    buttonActiveBackground: '#2a2a60',
    buttonActiveBorder: '#50c8ff',
    buttonInactiveColor: '#6060a0',
    buttonInactiveBorder: '#2a2a50',
  },

  minkowski: {
    futureConeColor: '#50c8ff',
    pastConeColor: '#ff6eb4',
    coneOpacity: 0.07,
    gridColor: '#2a2a50',
    gridSecondaryColor: '#1a1a30',
  },

  riemann: {
    wireframeColor: '#2a2a50',
    wireframeOpacity: 0.14,
  },

  emotion: {
    axisColor: '#2a2a50',
    axisOpacity: 0.28,
  },

  selection: {
    primaryColor: '#50c8ff',
    secondaryColor: '#ff6eb4',
    boxSelectFill: 'rgba(80, 200, 255, 0.1)',
    boxSelectBorder: '#50c8ff',
  },
};

// ==========================================
// PRESET REGISTRY
// ==========================================

/**
 * Map of all built-in theme presets, keyed by name.
 * Import individual presets for tree-shaking, or use this
 * registry for dynamic theme selection by string key.
 */
export const presets: Record<string, PerspektiveTheme> = {
  cyberpunk,
  midnight,
  paper,
  matrix,
  aurora,
};

/** The default theme used when no theme is explicitly provided. */
export const defaultTheme: PerspektiveTheme = cyberpunk;
