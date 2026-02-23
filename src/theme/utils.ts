/**
 * utils.ts -- Theme utilities for perspektive.js
 *
 * Provides helper functions for working with PerspektiveTheme objects:
 *
 *   - `mergeThemes(base, overrides)` -- deep merge with proper typing
 *   - `hexToHDR(hex, multiplier)`    -- convert hex + HDR multiplier to Three.js Color
 *   - `interpolateTheme(from, to, t)` -- lerp between two themes for smooth transitions
 *   - `validateTheme(theme)`          -- check all required fields and warn about issues
 */

import * as THREE from 'three';
import type { PerspektiveTheme, DeepPartial } from './types';

// ==========================================
// DEEP MERGE
// ==========================================

/**
 * Recursively determine if a value is a plain object (not an array, Date, etc.).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

/**
 * Deep merge two objects. Properties from `overrides` take precedence.
 * Arrays are replaced wholesale (not merged element-by-element).
 * Only plain objects are recursively merged.
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overrides)) {
    const baseVal = result[key];
    const overVal = overrides[key];

    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      result[key] = deepMerge(baseVal as Record<string, unknown>, overVal);
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }

  return result as T;
}

/**
 * Create a new theme by deep-merging a base theme with partial overrides.
 *
 * This is the primary way for users to customize a preset without
 * specifying every single field. Only the fields present in `overrides`
 * are changed; all others retain their values from `base`.
 *
 * @param base - A complete base theme (typically one of the presets)
 * @param overrides - A deep-partial theme object with the fields to override
 * @returns A new complete PerspektiveTheme
 *
 * @example
 * ```ts
 * import { cyberpunk, mergeThemes } from 'perspektive.js/theme';
 *
 * const myTheme = mergeThemes(cyberpunk, {
 *   name: 'my-cyberpunk',
 *   background: '#0a0a2e',
 *   bloom: { intensity: 2.5 },
 *   nodes: { byType: { Episodic: { color: '#ff6600' } } },
 * });
 * ```
 */
export function mergeThemes(
  base: PerspektiveTheme,
  overrides: DeepPartial<PerspektiveTheme>,
): PerspektiveTheme {
  return deepMerge(
    base as unknown as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as unknown as PerspektiveTheme;
}

// ==========================================
// HEX TO HDR COLOR
// ==========================================

/**
 * Convert a CSS hex color string and an HDR multiplier into a Three.js Color.
 *
 * The multiplier scales the linear RGB values so that values > 1.0 produce
 * HDR colors that bloom through the post-processing pass.
 *
 * @param hex - CSS hex color string (e.g. '#00f0ff', '#fff', '00f0ff')
 * @param multiplier - HDR intensity multiplier (1.0 = no change)
 * @returns A new `THREE.Color` with scaled RGB values
 *
 * @example
 * ```ts
 * const hdrCyan = hexToHDR('#00f0ff', 1.5);
 * // hdrCyan.r === 0, hdrCyan.g ~= 1.41, hdrCyan.b ~= 1.5
 * ```
 */
export function hexToHDR(hex: string, multiplier: number = 1.0): THREE.Color {
  const color = new THREE.Color(hex);
  if (multiplier !== 1.0) {
    color.multiplyScalar(multiplier);
  }
  return color;
}

// ==========================================
// THEME INTERPOLATION
// ==========================================

/**
 * Parse a CSS color string (hex or rgba) into an RGB triple in [0, 1] range.
 * Falls back to white if parsing fails.
 */
function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  // Try rgba() format
  const rgbaMatch = css.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10) / 255,
      g: parseInt(rgbaMatch[2], 10) / 255,
      b: parseInt(rgbaMatch[3], 10) / 255,
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0,
    };
  }

  // Try hex format
  try {
    const c = new THREE.Color(css);
    return { r: c.r, g: c.g, b: c.b, a: 1.0 };
  } catch {
    return { r: 1, g: 1, b: 1, a: 1 };
  }
}

/**
 * Format an RGB(A) color back to a CSS string.
 * Returns hex if fully opaque, rgba() otherwise.
 */
function formatColor(r: number, g: number, b: number, a: number): string {
  if (a >= 0.999) {
    const c = new THREE.Color(r, g, b);
    return '#' + c.getHexString();
  }
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(2)})`;
}

/**
 * Lerp a single CSS color string between two values.
 */
function lerpColor(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  return formatColor(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
    a.a + (b.a - a.a) * t,
  );
}

/**
 * Lerp a numeric value.
 */
function lerpNumber(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Interpolate a CSS box-shadow string. If both sides have colors, we lerp
 * the color and numeric values. Otherwise we snap to the target at t >= 0.5.
 */
function lerpShadow(from: string, to: string, t: number): string {
  // Simple approach: try to extract the rgba color from each and lerp it
  const fromColor = from.match(/rgba?\([^)]+\)/);
  const toColor = to.match(/rgba?\([^)]+\)/);

  if (fromColor && toColor) {
    const lerpedColor = lerpColor(fromColor[0], toColor[0], t);
    // Extract numeric parts (offsets, blur, spread)
    const fromNums = from.replace(/rgba?\([^)]+\)/, '').match(/-?[\d.]+/g) || [];
    const toNums = to.replace(/rgba?\([^)]+\)/, '').match(/-?[\d.]+/g) || [];
    const maxLen = Math.max(fromNums.length, toNums.length);
    const lerpedNums: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      const a = parseFloat(fromNums[i] || '0');
      const b = parseFloat(toNums[i] || '0');
      lerpedNums.push(lerpNumber(a, b, t));
    }
    const numStr = lerpedNums.map((n) => `${n.toFixed(0)}px`).join(' ');
    return `${numStr} ${lerpedColor}`;
  }

  return t < 0.5 ? from : to;
}

/**
 * Recursively interpolate between two theme objects.
 * Strings that look like colors are lerped; numbers are lerped;
 * strings that are not colors snap at t >= 0.5.
 */
function interpolateObject(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  t: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Gather all keys from both objects
  const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);

  for (const key of allKeys) {
    const fVal = from[key];
    const tVal = to[key];

    // If one side is missing, use the other
    if (fVal === undefined) { result[key] = tVal; continue; }
    if (tVal === undefined) { result[key] = fVal; continue; }

    // Both exist -- determine interpolation strategy
    if (typeof fVal === 'number' && typeof tVal === 'number') {
      result[key] = lerpNumber(fVal, tVal, t);
    } else if (typeof fVal === 'string' && typeof tVal === 'string') {
      if (isColorLike(fVal) && isColorLike(tVal)) {
        result[key] = lerpColor(fVal, tVal, t);
      } else if (isShadowLike(fVal) && isShadowLike(tVal)) {
        result[key] = lerpShadow(fVal, tVal, t);
      } else {
        // Non-color strings: snap at midpoint
        result[key] = t < 0.5 ? fVal : tVal;
      }
    } else if (typeof fVal === 'boolean' && typeof tVal === 'boolean') {
      result[key] = t < 0.5 ? fVal : tVal;
    } else if (isPlainObject(fVal) && isPlainObject(tVal)) {
      result[key] = interpolateObject(
        fVal as Record<string, unknown>,
        tVal as Record<string, unknown>,
        t,
      );
    } else if (Array.isArray(fVal) && Array.isArray(tVal)) {
      // Lerp arrays element-by-element if same length, otherwise snap
      if (fVal.length === tVal.length) {
        result[key] = fVal.map((v, i) => {
          if (typeof v === 'number' && typeof tVal[i] === 'number') {
            return lerpNumber(v, tVal[i] as number, t);
          }
          return t < 0.5 ? v : tVal[i];
        });
      } else {
        result[key] = t < 0.5 ? fVal : tVal;
      }
    } else {
      result[key] = t < 0.5 ? fVal : tVal;
    }
  }

  return result;
}

/** Check if a string looks like a CSS color (hex, rgb, rgba). */
function isColorLike(s: string): boolean {
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(s) ||
    /^rgba?\(/.test(s)
  );
}

/** Check if a string looks like a CSS box-shadow value. */
function isShadowLike(s: string): boolean {
  return /\d+px/.test(s) && /rgba?\(/.test(s);
}

/**
 * Interpolate (lerp) between two complete themes.
 *
 * Colors are smoothly blended in RGB space. Numbers are linearly
 * interpolated. Non-interpolatable values (font family, booleans)
 * snap to the target at t >= 0.5.
 *
 * @param from - The source theme (t = 0.0)
 * @param to - The target theme (t = 1.0)
 * @param t - Interpolation factor in [0, 1]
 * @returns A new theme with all fields interpolated at the given `t`
 *
 * @example
 * ```ts
 * // Half-way between cyberpunk and paper
 * const midTheme = interpolateTheme(cyberpunk, paper, 0.5);
 * ```
 */
export function interpolateTheme(
  from: PerspektiveTheme,
  to: PerspektiveTheme,
  t: number,
): PerspektiveTheme {
  // Clamp t
  const ct = Math.max(0, Math.min(1, t));

  if (ct <= 0) return { ...from };
  if (ct >= 1) return { ...to };

  const result = interpolateObject(
    from as unknown as Record<string, unknown>,
    to as unknown as Record<string, unknown>,
    ct,
  );

  // The name should be a composite during transition, snapping at the end
  result.name = ct < 1 ? `${from.name} -> ${to.name}` : to.name;

  return result as unknown as PerspektiveTheme;
}

// ==========================================
// THEME VALIDATION
// ==========================================

/** Result of theme validation. */
export interface ThemeValidationResult {
  /** Whether the theme passed all checks. */
  valid: boolean;
  /** Array of error messages for missing or invalid required fields. */
  errors: string[];
  /** Array of warning messages for suspicious but non-breaking values. */
  warnings: string[];
}

/**
 * Validate that a theme object has all required fields and sensible values.
 *
 * Checks:
 *   - All top-level sections exist (nodes, edges, disk, bloom, ui, etc.)
 *   - All required scalar fields are present and non-empty
 *   - Color strings look like valid CSS colors
 *   - Numeric values are within sensible ranges
 *
 * @param theme - The theme object to validate (can be a partial/untrusted object)
 * @returns A validation result with `valid`, `errors`, and `warnings` arrays
 *
 * @example
 * ```ts
 * const result = validateTheme(myTheme);
 * if (!result.valid) {
 *   console.error('Theme errors:', result.errors);
 * }
 * result.warnings.forEach(w => console.warn(w));
 * ```
 */
export function validateTheme(
  theme: unknown,
): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!theme || typeof theme !== 'object') {
    return { valid: false, errors: ['Theme must be a non-null object'], warnings: [] };
  }

  const t = theme as Record<string, unknown>;

  // ---- Required top-level fields ----

  const requiredStrings: [string, string][] = [
    ['name', 'Theme name'],
    ['background', 'Background color'],
  ];

  for (const [key, label] of requiredStrings) {
    if (typeof t[key] !== 'string' || (t[key] as string).length === 0) {
      errors.push(`Missing or empty required string field: ${label} (${key})`);
    }
  }

  // Validate background color
  if (typeof t.background === 'string' && !isColorLike(t.background as string)) {
    warnings.push(`background "${t.background}" does not look like a valid CSS color`);
  }

  // ---- Required sections ----

  const requiredSections = [
    'nodes', 'edges', 'disk', 'bloom', 'ui',
    'minkowski', 'riemann', 'emotion', 'selection',
  ];

  for (const section of requiredSections) {
    if (!t[section] || typeof t[section] !== 'object') {
      errors.push(`Missing required section: ${section}`);
    }
  }

  // ---- Nodes section ----

  if (isPlainObject(t.nodes)) {
    const nodes = t.nodes as Record<string, unknown>;
    if (!nodes.default || typeof nodes.default !== 'object') {
      errors.push('nodes.default is required and must be an object');
    }
    if (!nodes.ubermensch || typeof nodes.ubermensch !== 'object') {
      errors.push('nodes.ubermensch is required and must be an object');
    }
    if (typeof nodes.ubermenschThreshold !== 'number') {
      errors.push('nodes.ubermenschThreshold is required and must be a number');
    } else if (nodes.ubermenschThreshold < 0 || nodes.ubermenschThreshold > 1) {
      warnings.push(`nodes.ubermenschThreshold = ${nodes.ubermenschThreshold} is outside [0, 1] range`);
    }
    if (!nodes.byType || typeof nodes.byType !== 'object') {
      errors.push('nodes.byType is required and must be an object (can be empty)');
    }

    // Validate node style color fields
    for (const styleKey of ['default', 'ubermensch'] as const) {
      const style = nodes[styleKey] as Record<string, unknown> | undefined;
      if (style && typeof style.color === 'string' && !isColorLike(style.color as string)) {
        warnings.push(`nodes.${styleKey}.color "${style.color}" does not look like a valid CSS color`);
      }
      if (style && typeof style.hdrMultiplier === 'number' && (style.hdrMultiplier as number) < 0) {
        warnings.push(`nodes.${styleKey}.hdrMultiplier is negative`);
      }
    }
  }

  // ---- Edges section ----

  if (isPlainObject(t.edges)) {
    const edges = t.edges as Record<string, unknown>;
    if (!edges.default || typeof edges.default !== 'object') {
      errors.push('edges.default is required and must be an object');
    }
  }

  // ---- Bloom section ----

  if (isPlainObject(t.bloom)) {
    const bloom = t.bloom as Record<string, unknown>;
    const requiredBloomFields = ['luminanceThreshold', 'intensity', 'radius'];
    for (const field of requiredBloomFields) {
      if (typeof bloom[field] !== 'number') {
        errors.push(`bloom.${field} is required and must be a number`);
      }
    }
    if (typeof bloom.intensity === 'number' && (bloom.intensity as number) < 0) {
      warnings.push('bloom.intensity is negative, which may produce unexpected results');
    }
  }

  // ---- UI section ----

  if (isPlainObject(t.ui)) {
    const ui = t.ui as Record<string, unknown>;
    const requiredUiStrings = [
      'primaryColor', 'secondaryColor', 'backgroundColor', 'textColor',
      'fontFamily', 'tooltipBackground', 'tooltipBorder', 'tooltipShadow',
      'buttonActiveBackground', 'buttonActiveBorder',
      'buttonInactiveColor', 'buttonInactiveBorder',
    ];
    for (const field of requiredUiStrings) {
      if (typeof ui[field] !== 'string' || (ui[field] as string).length === 0) {
        errors.push(`ui.${field} is required and must be a non-empty string`);
      }
    }
  }

  // ---- Disk section ----

  if (isPlainObject(t.disk)) {
    const disk = t.disk as Record<string, unknown>;
    if (typeof disk.fillColor !== 'string') errors.push('disk.fillColor is required');
    if (typeof disk.borderColor !== 'string') errors.push('disk.borderColor is required');
    if (typeof disk.borderOpacity !== 'number') errors.push('disk.borderOpacity is required');
  }

  // ---- Minkowski section ----

  if (isPlainObject(t.minkowski)) {
    const mink = t.minkowski as Record<string, unknown>;
    const fields = ['futureConeColor', 'pastConeColor', 'gridColor', 'gridSecondaryColor'];
    for (const field of fields) {
      if (typeof mink[field] !== 'string') errors.push(`minkowski.${field} is required`);
    }
    if (typeof mink.coneOpacity !== 'number') errors.push('minkowski.coneOpacity is required');
  }

  // ---- Riemann section ----

  if (isPlainObject(t.riemann)) {
    const riem = t.riemann as Record<string, unknown>;
    if (typeof riem.wireframeColor !== 'string') errors.push('riemann.wireframeColor is required');
    if (typeof riem.wireframeOpacity !== 'number') errors.push('riemann.wireframeOpacity is required');
  }

  // ---- Emotion section ----

  if (isPlainObject(t.emotion)) {
    const em = t.emotion as Record<string, unknown>;
    if (typeof em.axisColor !== 'string') errors.push('emotion.axisColor is required');
    if (typeof em.axisOpacity !== 'number') errors.push('emotion.axisOpacity is required');
  }

  // ---- Selection section ----

  if (isPlainObject(t.selection)) {
    const sel = t.selection as Record<string, unknown>;
    const fields = ['primaryColor', 'secondaryColor', 'boxSelectFill', 'boxSelectBorder'];
    for (const field of fields) {
      if (typeof sel[field] !== 'string') errors.push(`selection.${field} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
