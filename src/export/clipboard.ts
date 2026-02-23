/**
 * Clipboard Export for perspektive.js
 *
 * Copies graph data to the system clipboard in either JSON or CSV format.
 * Uses the modern Clipboard API (navigator.clipboard.writeText) with a
 * fallback to the legacy document.execCommand('copy') for older browsers.
 */

import type { GraphExportData } from './types';
import { graphToJSONString } from './json';

/**
 * Copy graph data to the system clipboard.
 *
 * @param data - The structured graph export data.
 * @param format - Output format: 'json' for full JSON, 'csv' for tabular node data.
 * @returns A Promise that resolves when the data is on the clipboard.
 * @throws {Error} If the clipboard API is unavailable and the fallback fails.
 *
 * @example
 * ```ts
 * await copyGraphToClipboard(graphData, 'json');
 * // Clipboard now contains the full JSON
 *
 * await copyGraphToClipboard(graphData, 'csv');
 * // Clipboard now contains CSV with columns: id, x, y, z, energy, node_type
 * ```
 */
export async function copyGraphToClipboard(
  data: GraphExportData,
  format: 'json' | 'csv' = 'json',
): Promise<void> {
  const text = format === 'csv'
    ? graphToCSVString(data)
    : graphToJSONString(data);

  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard API may fail if the page is not focused or permission is denied.
      // Fall through to the legacy approach.
    }
  }

  // Fallback: legacy execCommand('copy') via a temporary textarea
  copyViaExecCommand(text);
}

/**
 * Convert graph node data to a CSV string.
 *
 * Produces a header row followed by one row per node. Only includes the
 * core columns (id, x, y, z, energy, node_type) to keep the output clean
 * and pasteable into spreadsheet software.
 *
 * @param data - The structured graph export data.
 * @returns A CSV string with header row.
 */
export function graphToCSVString(data: GraphExportData): string {
  const header = 'id,x,y,z,energy,node_type,valence,arousal';
  const rows = data.nodes.map((node) => {
    // Escape CSV fields that might contain commas or quotes
    const id = csvEscape(node.id);
    const nodeType = csvEscape(node.node_type);
    const valence = node.valence !== undefined ? node.valence.toString() : '';
    const arousal = node.arousal !== undefined ? node.arousal.toString() : '';

    return `${id},${node.x},${node.y},${node.z},${node.energy},${nodeType},${valence},${arousal}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Escape a string value for safe inclusion in a CSV field.
 * Wraps the value in double quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Legacy clipboard copy using a hidden textarea and document.execCommand.
 * Works in older browsers and contexts where the Clipboard API is unavailable.
 *
 * @param text - The text to copy to the clipboard.
 * @throws {Error} If execCommand('copy') fails.
 */
function copyViaExecCommand(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand('copy');
    if (!success) {
      throw new Error('execCommand("copy") returned false');
    }
  } catch (err) {
    throw new Error(
      `Failed to copy to clipboard: ${err instanceof Error ? err.message : 'unknown error'}. ` +
      `Try using HTTPS or granting clipboard permissions.`
    );
  } finally {
    document.body.removeChild(textarea);
  }
}
