/**
 * stylesheet.ts -- CSS-like stylesheet system for perspektive.js
 *
 * Inspired by Cytoscape.js's stylesheet approach, this module lets users
 * define declarative style rules with selectors that match graph elements
 * by type, property equality, and numeric comparisons.
 *
 * Supported selector syntax:
 *   - `'node'`                     -- matches all nodes
 *   - `'edge'`                     -- matches all edges
 *   - `'node[node_type="Episodic"]'` -- property equals string
 *   - `'node[energy > 0.8]'`       -- numeric greater-than
 *   - `'node[energy >= 0.5]'`      -- numeric greater-than-or-equal
 *   - `'node[energy < 0.3]'`       -- numeric less-than
 *   - `'node[energy <= 0.3]'`      -- numeric less-than-or-equal
 *   - `'edge[weight > 0.9]'`       -- works on edges too
 *
 * Rules are applied in order of specificity: more specific selectors
 * (those with attribute conditions) override less specific ones. Among
 * rules with equal specificity, later rules win.
 *
 * @example
 * ```ts
 * const sheet = createStylesheet([
 *   { selector: 'node', style: { color: '#fff', size: 1.0 } },
 *   { selector: 'node[node_type="Episodic"]', style: { color: '#00f0ff' } },
 *   { selector: 'node[energy > 0.8]', style: { color: '#ff00ff', hdrMultiplier: 4 } },
 *   { selector: 'edge', style: { color: '#00d8ff', width: 1 } },
 *   { selector: 'edge[weight > 0.9]', style: { color: '#ff0000', width: 2 } },
 * ]);
 *
 * const nodeStyle = resolveNodeStyle(someNode, sheet);
 * const edgeStyle = resolveEdgeStyle(someEdge, sheet);
 * ```
 */

import type { NodeStyle, EdgeStyle } from './types';

// ==========================================
// PUBLIC TYPES
// ==========================================

/** The target element type a selector matches against. */
export type SelectorTarget = 'node' | 'edge';

/** A comparison operator used in attribute selectors. */
export type ComparisonOp = '=' | '!=' | '>' | '>=' | '<' | '<=';

/** A parsed attribute condition like `[energy > 0.8]` or `[node_type="Episodic"]`. */
export interface AttributeCondition {
  /** Property name on the element (e.g. 'energy', 'node_type', 'weight'). */
  property: string;
  /** Comparison operator. */
  operator: ComparisonOp;
  /** The right-hand value -- string for '=', number for numeric comparisons. */
  value: string | number;
}

/** A fully parsed selector with target type, conditions, and specificity. */
export interface ParsedSelector {
  /** Whether this rule targets nodes or edges. */
  target: SelectorTarget;
  /** Zero or more attribute conditions (all must match). */
  conditions: AttributeCondition[];
  /** Specificity score: base elements score 0, each condition adds 1. */
  specificity: number;
}

/** A single stylesheet rule binding a selector to a partial style. */
export interface StyleRule<S = Partial<NodeStyle> | Partial<EdgeStyle>> {
  /** CSS-like selector string. */
  selector: string;
  /** Partial style object to apply when the selector matches. */
  style: S;
}

/** Internal representation with a pre-parsed selector for fast matching. */
interface CompiledRule<S> {
  parsed: ParsedSelector;
  style: S;
  /** Declaration order -- used as tiebreaker when specificity is equal. */
  order: number;
}

/**
 * A compiled stylesheet ready for element resolution.
 * Created by `createStylesheet()`.
 */
export interface Stylesheet {
  /** Compiled node rules, sorted by specificity ascending (last wins). */
  nodeRules: CompiledRule<Partial<NodeStyle>>[];
  /** Compiled edge rules, sorted by specificity ascending (last wins). */
  edgeRules: CompiledRule<Partial<EdgeStyle>>[];
}

// ==========================================
// SELECTOR PARSER
// ==========================================

/**
 * Regex that captures:
 *   group 1: target ('node' or 'edge')
 *   group 2: optional attribute block(s) like `[prop > 0.8][other="x"]`
 */
const SELECTOR_RE = /^(node|edge)((?:\[.+?\])*)$/;

/**
 * Regex for a single attribute condition inside brackets:
 *   group 1: property name
 *   group 2: operator (=, !=, >, >=, <, <=)
 *   group 3: value (optionally quoted)
 */
const ATTR_RE = /\[\s*(\w+)\s*(!=|>=|<=|>|<|=)\s*"?([^"\]]*?)"?\s*\]/g;

/**
 * Parse a selector string into a structured ParsedSelector.
 *
 * @param selector - Raw selector string like `'node[energy > 0.8]'`
 * @returns Parsed selector with target, conditions, and specificity
 * @throws Error if the selector syntax is invalid
 */
export function parseSelector(selector: string): ParsedSelector {
  const trimmed = selector.trim();
  const match = SELECTOR_RE.exec(trimmed);

  if (!match) {
    throw new Error(
      `Invalid selector: "${selector}". ` +
      `Expected format: "node" or "edge" optionally followed by [attr op value] conditions.`,
    );
  }

  const target = match[1] as SelectorTarget;
  const attrBlock = match[2];
  const conditions: AttributeCondition[] = [];

  if (attrBlock) {
    // Reset regex state for global matching
    ATTR_RE.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = ATTR_RE.exec(attrBlock)) !== null) {
      const property = attrMatch[1];
      const operator = attrMatch[2] as ComparisonOp;
      const rawValue = attrMatch[3];

      // Try to parse as number; keep as string if it fails
      const numValue = Number(rawValue);
      const value = isNaN(numValue) ? rawValue : numValue;

      conditions.push({ property, operator, value });
    }
  }

  return {
    target,
    conditions,
    specificity: conditions.length,
  };
}

// ==========================================
// CONDITION EVALUATION
// ==========================================

/**
 * Test whether a single attribute condition matches against an element's properties.
 *
 * @param condition - The parsed condition to evaluate
 * @param element - The graph element (node or edge) as a record of properties
 * @returns `true` if the condition is satisfied
 */
function evaluateCondition(
  condition: AttributeCondition,
  element: Record<string, unknown>,
): boolean {
  const actual = element[condition.property];

  // Property must exist on the element
  if (actual === undefined || actual === null) {
    return false;
  }

  const { operator, value } = condition;

  switch (operator) {
    case '=':
      return String(actual) === String(value);
    case '!=':
      return String(actual) !== String(value);
    case '>':
      return typeof actual === 'number' && typeof value === 'number' && actual > value;
    case '>=':
      return typeof actual === 'number' && typeof value === 'number' && actual >= value;
    case '<':
      return typeof actual === 'number' && typeof value === 'number' && actual < value;
    case '<=':
      return typeof actual === 'number' && typeof value === 'number' && actual <= value;
    default:
      return false;
  }
}

/**
 * Test whether all conditions in a parsed selector match a given element.
 *
 * @param parsed - The parsed selector
 * @param element - The graph element as a property record
 * @returns `true` if every condition is satisfied (or there are no conditions)
 */
function matchesSelector(
  parsed: ParsedSelector,
  element: Record<string, unknown>,
): boolean {
  return parsed.conditions.every((cond) => evaluateCondition(cond, element));
}

// ==========================================
// STYLESHEET COMPILATION
// ==========================================

/**
 * Compile an array of style rules into an optimized Stylesheet.
 *
 * Rules are separated into node vs. edge buckets and sorted by
 * specificity (ascending) so that during resolution we can simply
 * iterate and let later, more-specific rules overwrite earlier ones.
 *
 * @param rules - Array of `{ selector, style }` rule objects
 * @returns A compiled `Stylesheet` ready for use with `resolveNodeStyle` / `resolveEdgeStyle`
 *
 * @example
 * ```ts
 * const sheet = createStylesheet([
 *   { selector: 'node', style: { color: '#fff' } },
 *   { selector: 'node[node_type="Episodic"]', style: { color: '#00f0ff' } },
 * ]);
 * ```
 */
export function createStylesheet(rules: StyleRule[]): Stylesheet {
  const nodeRules: CompiledRule<Partial<NodeStyle>>[] = [];
  const edgeRules: CompiledRule<Partial<EdgeStyle>>[] = [];

  rules.forEach((rule, order) => {
    const parsed = parseSelector(rule.selector);
    const compiled = { parsed, style: rule.style, order };

    if (parsed.target === 'node') {
      nodeRules.push(compiled as CompiledRule<Partial<NodeStyle>>);
    } else {
      edgeRules.push(compiled as CompiledRule<Partial<EdgeStyle>>);
    }
  });

  // Sort by specificity ascending, then by declaration order ascending.
  // This means when we Object.assign in order, the most-specific / last-declared wins.
  const comparator = (a: CompiledRule<unknown>, b: CompiledRule<unknown>) => {
    if (a.parsed.specificity !== b.parsed.specificity) {
      return a.parsed.specificity - b.parsed.specificity;
    }
    return a.order - b.order;
  };

  nodeRules.sort(comparator);
  edgeRules.sort(comparator);

  return { nodeRules, edgeRules };
}

// ==========================================
// STYLE RESOLUTION
// ==========================================

/** Default fallback node style used when no rules provide a value. */
const DEFAULT_NODE_STYLE: NodeStyle = {
  color: '#ffffff',
  hdrMultiplier: 1.0,
  opacity: 1.0,
  size: 1.0,
  glow: true,
  shape: 'circle',
};

/** Default fallback edge style used when no rules provide a value. */
const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#ffffff',
  hdrMultiplier: 1.0,
  opacity: 0.5,
  width: 1,
};

/**
 * Resolve the final NodeStyle for a given node by evaluating all matching
 * stylesheet rules in specificity order.
 *
 * Rules are applied from least to most specific. Among rules with equal
 * specificity, the one declared later in the stylesheet wins. The result
 * is a complete NodeStyle with every field populated.
 *
 * @param node - The node data object (must have properties referenced by selectors)
 * @param stylesheet - A compiled stylesheet created by `createStylesheet()`
 * @param baseStyle - Optional base style to start from instead of the internal default
 * @returns A fully resolved `NodeStyle`
 *
 * @example
 * ```ts
 * const style = resolveNodeStyle(
 *   { id: '1', node_type: 'Episodic', energy: 0.9 },
 *   sheet,
 * );
 * // style.color === '#ff00ff' if the energy > 0.8 rule matched
 * ```
 */
export function resolveNodeStyle(
  node: Record<string, unknown>,
  stylesheet: Stylesheet,
  baseStyle?: Partial<NodeStyle>,
): NodeStyle {
  const result: NodeStyle = { ...DEFAULT_NODE_STYLE, ...baseStyle };

  for (const rule of stylesheet.nodeRules) {
    if (matchesSelector(rule.parsed, node)) {
      Object.assign(result, rule.style);
    }
  }

  return result;
}

/**
 * Resolve the final EdgeStyle for a given edge by evaluating all matching
 * stylesheet rules in specificity order.
 *
 * @param edge - The edge data object (must have properties referenced by selectors)
 * @param stylesheet - A compiled stylesheet created by `createStylesheet()`
 * @param baseStyle - Optional base style to start from instead of the internal default
 * @returns A fully resolved `EdgeStyle`
 *
 * @example
 * ```ts
 * const style = resolveEdgeStyle(
 *   { source: 'a', target: 'b', weight: 0.95 },
 *   sheet,
 * );
 * // style.color === '#ff0000' if the weight > 0.9 rule matched
 * ```
 */
export function resolveEdgeStyle(
  edge: Record<string, unknown>,
  stylesheet: Stylesheet,
  baseStyle?: Partial<EdgeStyle>,
): EdgeStyle {
  const result: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...baseStyle };

  for (const rule of stylesheet.edgeRules) {
    if (matchesSelector(rule.parsed, edge)) {
      Object.assign(result, rule.style);
    }
  }

  return result;
}

/**
 * Utility: check if a stylesheet has any rules targeting nodes.
 *
 * @param stylesheet - The compiled stylesheet to inspect
 * @returns `true` if at least one node rule exists
 */
export function hasNodeRules(stylesheet: Stylesheet): boolean {
  return stylesheet.nodeRules.length > 0;
}

/**
 * Utility: check if a stylesheet has any rules targeting edges.
 *
 * @param stylesheet - The compiled stylesheet to inspect
 * @returns `true` if at least one edge rule exists
 */
export function hasEdgeRules(stylesheet: Stylesheet): boolean {
  return stylesheet.edgeRules.length > 0;
}
