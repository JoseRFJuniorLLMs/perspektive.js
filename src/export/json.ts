/**
 * JSON Export / Import for perspektive.js
 *
 * Exports the full graph state (nodes, edges, metadata) as a pretty-printed
 * JSON file. Provides a validated import function that parses JSON strings
 * and throws meaningful errors for malformed or incomplete data.
 *
 * The JSON format is the canonical interchange format for perspektive.js
 * graph data, preserving all node attributes (positions, energy, embeddings,
 * valence/arousal) and edge weights.
 */

import type { ExportOptions, GraphExportData } from './types';
import { PERSPEKTIVE_VERSION } from './types';
import { downloadFile, defaultFilename } from './utils';

/**
 * Export graph data as a pretty-printed JSON file and trigger a download.
 *
 * The output includes a `metadata` block with manifold type, collection name,
 * export timestamp, and perspektive.js version for provenance tracking.
 *
 * @param data - The structured graph export data.
 * @param options - Optional export configuration (filename).
 *
 * @example
 * ```ts
 * exportToJSON(graphData, { filename: 'eva-mind-snapshot' });
 * ```
 */
export function exportToJSON(data: GraphExportData, options?: ExportOptions): void {
  // Enrich metadata with export timestamp and version if not already set
  const enrichedData: GraphExportData = {
    ...data,
    metadata: {
      manifold: data.metadata?.manifold ?? 'poincare',
      collection: data.metadata?.collection ?? 'unknown',
      exportedAt: data.metadata?.exportedAt ?? new Date().toISOString(),
      perspektiveVersion: data.metadata?.perspektiveVersion ?? PERSPEKTIVE_VERSION,
    },
  };

  const jsonString = JSON.stringify(enrichedData, null, 2);

  const filename = options?.filename
    ? `${options.filename}.json`
    : defaultFilename('perspektive', 'json');

  downloadFile(jsonString, filename, 'application/json');
}

/**
 * Serialize graph data to a JSON string without triggering a download.
 * Useful for clipboard operations or programmatic access.
 *
 * @param data - The structured graph export data.
 * @returns A pretty-printed JSON string.
 */
export function graphToJSONString(data: GraphExportData): string {
  const enrichedData: GraphExportData = {
    ...data,
    metadata: {
      manifold: data.metadata?.manifold ?? 'poincare',
      collection: data.metadata?.collection ?? 'unknown',
      exportedAt: data.metadata?.exportedAt ?? new Date().toISOString(),
      perspektiveVersion: data.metadata?.perspektiveVersion ?? PERSPEKTIVE_VERSION,
    },
  };

  return JSON.stringify(enrichedData, null, 2);
}

/**
 * Parse and validate a JSON string into a `GraphExportData` object.
 *
 * Performs structural validation to ensure the JSON contains the required
 * fields with correct types. Throws descriptive errors for each failure mode
 * so consumers can provide meaningful feedback to users.
 *
 * @param json - The raw JSON string to parse and validate.
 * @returns A validated `GraphExportData` object.
 * @throws {Error} If the JSON is malformed or does not match the expected schema.
 *
 * @example
 * ```ts
 * try {
 *   const data = importFromJSON(fileContent);
 *   console.log(`Imported ${data.nodes.length} nodes`);
 * } catch (err) {
 *   alert(`Import failed: ${err.message}`);
 * }
 * ```
 */
export function importFromJSON(json: string): GraphExportData {
  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(
      `Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}. ` +
      `Ensure the file is valid JSON (not truncated, no trailing commas).`
    );
  }

  // Step 2: Top-level structure
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'Invalid structure: expected a JSON object with "nodes" and "edges" arrays. ' +
      `Got ${Array.isArray(parsed) ? 'an array' : typeof parsed}.`
    );
  }

  const obj = parsed as Record<string, unknown>;

  // Step 3: Validate nodes array
  if (!Array.isArray(obj.nodes)) {
    throw new Error(
      'Missing or invalid "nodes" field: expected an array of node objects. ' +
      `Got ${typeof obj.nodes}.`
    );
  }

  const nodes = obj.nodes as unknown[];
  for (let i = 0; i < nodes.length; i++) {
    validateNode(nodes[i], i);
  }

  // Step 4: Validate edges array
  if (!Array.isArray(obj.edges)) {
    throw new Error(
      'Missing or invalid "edges" field: expected an array of edge objects. ' +
      `Got ${typeof obj.edges}.`
    );
  }

  const edges = obj.edges as unknown[];
  for (let i = 0; i < edges.length; i++) {
    validateEdge(edges[i], i);
  }

  // Step 5: Validate optional metadata
  if (obj.metadata !== undefined && obj.metadata !== null) {
    if (typeof obj.metadata !== 'object' || Array.isArray(obj.metadata)) {
      throw new Error(
        'Invalid "metadata" field: expected an object or null. ' +
        `Got ${Array.isArray(obj.metadata) ? 'an array' : typeof obj.metadata}.`
      );
    }
  }

  // All checks passed
  return obj as unknown as GraphExportData;
}

/**
 * Validate a single node object from the JSON.
 * @throws {Error} with a descriptive message indicating which field failed.
 */
function validateNode(node: unknown, index: number): void {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    throw new Error(`nodes[${index}]: expected an object, got ${typeof node}.`);
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== 'string' || n.id.length === 0) {
    throw new Error(`nodes[${index}]: "id" must be a non-empty string.`);
  }

  if (typeof n.x !== 'number' || !isFinite(n.x)) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "x" must be a finite number.`);
  }

  if (typeof n.y !== 'number' || !isFinite(n.y)) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "y" must be a finite number.`);
  }

  if (typeof n.z !== 'number' || !isFinite(n.z)) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "z" must be a finite number.`);
  }

  if (typeof n.energy !== 'number' || !isFinite(n.energy)) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "energy" must be a finite number.`);
  }

  if (typeof n.node_type !== 'string') {
    throw new Error(`nodes[${index}] (id="${n.id}"): "node_type" must be a string.`);
  }

  // Optional fields: validate types if present
  if (n.valence !== undefined && (typeof n.valence !== 'number' || !isFinite(n.valence))) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "valence" must be a finite number if provided.`);
  }

  if (n.arousal !== undefined && (typeof n.arousal !== 'number' || !isFinite(n.arousal))) {
    throw new Error(`nodes[${index}] (id="${n.id}"): "arousal" must be a finite number if provided.`);
  }

  if (n.embedding !== undefined) {
    if (!Array.isArray(n.embedding)) {
      throw new Error(`nodes[${index}] (id="${n.id}"): "embedding" must be an array of numbers if provided.`);
    }
    for (let j = 0; j < (n.embedding as unknown[]).length; j++) {
      if (typeof (n.embedding as unknown[])[j] !== 'number') {
        throw new Error(`nodes[${index}] (id="${n.id}"): "embedding[${j}]" must be a number.`);
      }
    }
  }
}

/**
 * Validate a single edge object from the JSON.
 * @throws {Error} with a descriptive message indicating which field failed.
 */
function validateEdge(edge: unknown, index: number): void {
  if (typeof edge !== 'object' || edge === null || Array.isArray(edge)) {
    throw new Error(`edges[${index}]: expected an object, got ${typeof edge}.`);
  }

  const e = edge as Record<string, unknown>;

  if (typeof e.source !== 'string' || e.source.length === 0) {
    throw new Error(`edges[${index}]: "source" must be a non-empty string.`);
  }

  if (typeof e.target !== 'string' || e.target.length === 0) {
    throw new Error(`edges[${index}]: "target" must be a non-empty string.`);
  }

  if (typeof e.weight !== 'number' || !isFinite(e.weight)) {
    throw new Error(
      `edges[${index}] (${e.source} -> ${e.target}): "weight" must be a finite number.`
    );
  }
}
