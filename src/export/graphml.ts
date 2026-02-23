/**
 * GraphML Export for perspektive.js
 *
 * Generates a valid GraphML XML document from graph data, compatible with:
 * - Gephi (https://gephi.org/)
 * - Cytoscape (https://cytoscape.org/)
 * - yEd (https://www.yworks.com/products/yed)
 *
 * GraphML is an XML-based format (ISO/IEC 15944-16) that supports typed
 * attributes via `<key>` declarations and `<data>` elements. This exporter
 * declares keys for all NietzscheDB node/edge attributes and produces
 * well-formed XML with proper namespace declarations.
 *
 * @see http://graphml.graphdrawing.org/specification.html
 */

import type { ExportOptions, GraphExportData } from './types';
import { downloadFile, defaultFilename, escapeXml } from './utils';

/**
 * Export graph data as a GraphML XML file and trigger a download.
 *
 * @param data - The structured graph export data.
 * @param options - Optional export configuration (filename).
 *
 * @example
 * ```ts
 * exportToGraphML(graphData, { filename: 'nietzsche-graph' });
 * // Downloads: nietzsche-graph.graphml
 * ```
 */
export function exportToGraphML(data: GraphExportData, options?: ExportOptions): void {
  const xml = generateGraphMLString(data);

  const filename = options?.filename
    ? `${options.filename}.graphml`
    : defaultFilename('perspektive', 'graphml');

  downloadFile(xml, filename, 'application/xml');
}

/**
 * Generate a GraphML XML string without triggering a download.
 * Useful for clipboard operations or programmatic access.
 *
 * @param data - The structured graph export data.
 * @returns A complete, valid GraphML XML document as a string.
 */
export function generateGraphMLString(data: GraphExportData): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // GraphML root element with namespace declarations
  lines.push(
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns ' +
    'http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">'
  );

  // Key declarations for node attributes
  // These tell Gephi/Cytoscape what data fields to expect and their types
  lines.push('  <!-- Node attribute keys -->');
  lines.push('  <key id="d_x" for="node" attr.name="x" attr.type="double">');
  lines.push('    <default>0.0</default>');
  lines.push('  </key>');
  lines.push('  <key id="d_y" for="node" attr.name="y" attr.type="double">');
  lines.push('    <default>0.0</default>');
  lines.push('  </key>');
  lines.push('  <key id="d_z" for="node" attr.name="z" attr.type="double">');
  lines.push('    <default>0.0</default>');
  lines.push('  </key>');
  lines.push('  <key id="d_energy" for="node" attr.name="energy" attr.type="double">');
  lines.push('    <default>0.0</default>');
  lines.push('  </key>');
  lines.push('  <key id="d_node_type" for="node" attr.name="node_type" attr.type="string">');
  lines.push('    <default>Semantic</default>');
  lines.push('  </key>');
  lines.push('  <key id="d_valence" for="node" attr.name="valence" attr.type="double"/>');
  lines.push('  <key id="d_arousal" for="node" attr.name="arousal" attr.type="double"/>');
  lines.push('  <key id="d_embedding" for="node" attr.name="embedding" attr.type="string">');
  lines.push('    <desc>JSON-encoded embedding vector</desc>');
  lines.push('  </key>');

  // Gephi-compatible position keys (recognized by Gephi's GraphML importer)
  lines.push('  <!-- Gephi position hint keys -->');
  lines.push('  <key id="d_label" for="node" attr.name="label" attr.type="string"/>');

  // Key declarations for edge attributes
  lines.push('  <!-- Edge attribute keys -->');
  lines.push('  <key id="d_weight" for="edge" attr.name="weight" attr.type="double">');
  lines.push('    <default>1.0</default>');
  lines.push('  </key>');

  // Graph element (directed graph — NietzscheDB edges have direction)
  lines.push('  <graph id="G" edgedefault="directed">');

  // Graph-level metadata as data elements (via a graph key)
  if (data.metadata) {
    lines.push('    <!-- Graph metadata -->');
    if (data.metadata.manifold) {
      lines.push(`    <!-- manifold: ${escapeXml(data.metadata.manifold)} -->`);
    }
    if (data.metadata.collection) {
      lines.push(`    <!-- collection: ${escapeXml(data.metadata.collection)} -->`);
    }
    if (data.metadata.exportedAt) {
      lines.push(`    <!-- exportedAt: ${escapeXml(data.metadata.exportedAt)} -->`);
    }
    if (data.metadata.perspektiveVersion) {
      lines.push(`    <!-- perspektiveVersion: ${escapeXml(data.metadata.perspektiveVersion)} -->`);
    }
  }

  // Nodes
  lines.push('    <!-- Nodes -->');
  for (const node of data.nodes) {
    const nodeId = escapeXml(node.id);
    lines.push(`    <node id="${nodeId}">`);
    lines.push(`      <data key="d_label">${nodeId}</data>`);
    lines.push(`      <data key="d_x">${node.x}</data>`);
    lines.push(`      <data key="d_y">${node.y}</data>`);
    lines.push(`      <data key="d_z">${node.z}</data>`);
    lines.push(`      <data key="d_energy">${node.energy}</data>`);
    lines.push(`      <data key="d_node_type">${escapeXml(node.node_type)}</data>`);

    if (node.valence !== undefined) {
      lines.push(`      <data key="d_valence">${node.valence}</data>`);
    }
    if (node.arousal !== undefined) {
      lines.push(`      <data key="d_arousal">${node.arousal}</data>`);
    }
    if (node.embedding && node.embedding.length > 0) {
      // Serialize embedding as a JSON array string
      // This preserves the full vector while remaining compatible with string-type GraphML
      lines.push(`      <data key="d_embedding">${escapeXml(JSON.stringify(node.embedding))}</data>`);
    }

    lines.push('    </node>');
  }

  // Edges
  lines.push('    <!-- Edges -->');
  let edgeCounter = 0;
  for (const edge of data.edges) {
    const edgeId = `e${edgeCounter++}`;
    const source = escapeXml(edge.source);
    const target = escapeXml(edge.target);

    lines.push(`    <edge id="${edgeId}" source="${source}" target="${target}">`);
    lines.push(`      <data key="d_weight">${edge.weight}</data>`);
    lines.push('    </edge>');
  }

  // Close graph and graphml
  lines.push('  </graph>');
  lines.push('</graphml>');

  return lines.join('\n');
}
