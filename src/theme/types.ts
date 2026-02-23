/**
 * types.ts -- Theme type definitions for perspektive.js
 *
 * Defines the complete shape of a PerspektiveTheme, including styles for
 * nodes, edges, the Poincare disk, bloom post-processing, UI overlays,
 * and each manifold-specific renderer.
 *
 * Every field in PerspektiveTheme is required so that presets are always
 * self-contained and components never need null-checks.
 */

// ==========================================
// NODE STYLES
// ==========================================

/** Visual style applied to a single graph node. */
export interface NodeStyle {
  /** CSS hex color string (e.g. '#00ff66'). */
  color: string;
  /**
   * HDR multiplier applied to the color before bloom.
   * Values > 1.0 cause the node to glow through the bloom pass.
   */
  hdrMultiplier: number;
  /** Opacity in range [0, 1]. Defaults to 1.0 if omitted. */
  opacity?: number;
  /** Scale multiplier on the base radius. Defaults to 1.0 if omitted. */
  size?: number;
  /** Whether this node participates in bloom glow. Defaults to true if omitted. */
  glow?: boolean;
  /** Geometric shape of the node. Defaults to 'circle' if omitted. */
  shape?: 'circle' | 'diamond' | 'square' | 'triangle';
}

// ==========================================
// EDGE STYLES
// ==========================================

/** Visual style applied to a single graph edge. */
export interface EdgeStyle {
  /** CSS hex color string. */
  color: string;
  /** HDR multiplier applied before bloom. */
  hdrMultiplier: number;
  /** Opacity in range [0, 1]. */
  opacity: number;
  /** Line width in pixels. */
  width: number;
  /** Optional dash pattern (array of dash/gap lengths). */
  dashArray?: number[];
}

// ==========================================
// MAIN THEME INTERFACE
// ==========================================

/**
 * Complete theme definition for a perspektive.js visualization.
 *
 * Every field is required so presets are fully self-contained. Use
 * `mergeThemes()` from utils.ts to create partial overrides on top
 * of a base preset.
 */
export interface PerspektiveTheme {
  /** Human-readable name of this theme (e.g. 'cyberpunk'). */
  name: string;

  // ---- Canvas ----

  /** Background color of the WebGL canvas (CSS hex). */
  background: string;

  // ---- Nodes ----

  /** Node styling configuration. */
  nodes: {
    /** Fallback style when no type-specific or stylesheet rule matches. */
    default: NodeStyle;
    /**
     * Style applied to "Ubermensch" nodes whose energy exceeds
     * `ubermenschThreshold`. This overrides type-specific styles.
     */
    ubermensch: NodeStyle;
    /** Energy threshold above which the ubermensch style activates. */
    ubermenschThreshold: number;
    /**
     * Per-type style overrides. Keys are `node_type` strings
     * (e.g. 'Episodic', 'Concept'). Values are partial -- missing
     * fields fall back to `default`.
     */
    byType: Record<string, Partial<NodeStyle>>;
  };

  // ---- Edges ----

  /** Edge styling configuration. */
  edges: {
    /** Default style for all edges. */
    default: EdgeStyle;
    /**
     * Optional per-relation overrides. Keys are relation type strings.
     * Values are partial -- missing fields fall back to `default`.
     */
    byRelation?: Record<string, Partial<EdgeStyle>>;
  };

  // ---- Poincare Disk ----

  /** Styling for the Poincare disk background and border. */
  disk: {
    /** Fill color of the disk interior (CSS hex). */
    fillColor: string;
    /** Border ring color (CSS hex). */
    borderColor: string;
    /** Opacity of the border ring in [0, 1]. */
    borderOpacity: number;
  };

  // ---- Bloom Post-Processing ----

  /** Bloom (UnrealBloom) post-processing parameters. */
  bloom: {
    /** Luminance threshold below which fragments are excluded from bloom. */
    luminanceThreshold: number;
    /** Overall bloom intensity multiplier. */
    intensity: number;
    /** Bloom kernel radius. */
    radius: number;
  };

  // ---- UI Overlay ----

  /**
   * Colors and typography for all HTML overlay elements:
   * HUD, manifold switcher, tooltips.
   */
  ui: {
    /** Primary accent color (used for active highlights). */
    primaryColor: string;
    /** Secondary accent color. */
    secondaryColor: string;
    /** Background color for overlay panels. */
    backgroundColor: string;
    /** Default text color. */
    textColor: string;
    /** Font family stack. */
    fontFamily: string;
    /** Tooltip background color (supports rgba). */
    tooltipBackground: string;
    /** Tooltip border color. */
    tooltipBorder: string;
    /** Tooltip box-shadow CSS value. */
    tooltipShadow: string;
    /** Background of the active manifold-switcher button. */
    buttonActiveBackground: string;
    /** Border color of the active manifold-switcher button. */
    buttonActiveBorder: string;
    /** Text color of inactive manifold-switcher buttons. */
    buttonInactiveColor: string;
    /** Border color of inactive manifold-switcher buttons. */
    buttonInactiveBorder: string;
  };

  // ---- Minkowski Light Cones ----

  /** Styling for Minkowski space-time light cones and grid. */
  minkowski: {
    /** Color of the future light cone (CSS hex). */
    futureConeColor: string;
    /** Color of the past light cone (CSS hex). */
    pastConeColor: string;
    /** Opacity of both cones in [0, 1]. */
    coneOpacity: number;
    /** Primary grid color (CSS hex). */
    gridColor: string;
    /** Secondary (subdivision) grid color (CSS hex). */
    gridSecondaryColor: string;
  };

  // ---- Riemann Sphere ----

  /** Styling for the Riemann sphere wireframe. */
  riemann: {
    /** Wireframe line color (CSS hex). */
    wireframeColor: string;
    /** Wireframe opacity in [0, 1]. */
    wireframeOpacity: number;
  };

  // ---- Emotion Circumplex ----

  /** Styling for the Russell Circumplex axis lines. */
  emotion: {
    /** Axis line color (CSS hex). */
    axisColor: string;
    /** Axis line opacity in [0, 1]. */
    axisOpacity: number;
  };

  // ---- Selection & Interaction ----

  /** Colors for selection highlights and box-select overlay. */
  selection: {
    /** Primary selection highlight color (CSS hex). */
    primaryColor: string;
    /** Secondary / multi-select highlight color (CSS hex). */
    secondaryColor: string;
    /** Fill color for the box-select rectangle (supports rgba). */
    boxSelectFill: string;
    /** Border color for the box-select rectangle. */
    boxSelectBorder: string;
  };
}

// ==========================================
// DEEP PARTIAL FOR OVERRIDES
// ==========================================

/**
 * Recursive partial type that mirrors PerspektiveTheme but makes
 * every field optional. Used by `mergeThemes()` for user overrides.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
