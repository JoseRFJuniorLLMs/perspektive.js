/**
 * Export Utilities for perspektive.js
 *
 * Shared helper functions used across all export modules.
 * Handles file download triggering, canvas-to-blob conversion,
 * and timestamp formatting for default filenames.
 */

/**
 * Trigger a file download in the browser.
 *
 * Creates an invisible anchor element, sets its href to an object URL
 * from the provided content, clicks it, then cleans up. Works with
 * both string content (SVG, JSON, XML) and binary Blobs (PNG, JPEG).
 *
 * @param content - The file content as a string or Blob.
 * @param filename - The desired filename including extension.
 * @param mimeType - The MIME type for the download (e.g., 'image/png', 'application/json').
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Clean up: remove the anchor and revoke the object URL to free memory
  requestAnimationFrame(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });
}

/**
 * Convert an HTMLCanvasElement to a Blob asynchronously.
 *
 * Wraps the callback-based `canvas.toBlob()` in a Promise for
 * cleaner async/await usage in export pipelines.
 *
 * @param canvas - The source canvas element.
 * @param type - MIME type for the output (e.g., 'image/png', 'image/jpeg').
 * @param quality - Encoding quality for lossy formats (0-1). Ignored for PNG.
 * @returns A Promise that resolves with the Blob, or rejects on failure.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert canvas to blob (type: ${type})`));
        }
      },
      type,
      quality,
    );
  });
}

/**
 * Generate a compact timestamp string suitable for default filenames.
 *
 * Format: `YYYYMMDD-HHmmss` (e.g., `20260223-143052`).
 * Uses local time for user familiarity.
 *
 * @returns A formatted timestamp string.
 */
export function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Build a default filename for exports.
 *
 * @param prefix - Filename prefix (e.g., 'perspektive').
 * @param extension - File extension without dot (e.g., 'png', 'svg').
 * @returns A filename like `perspektive-20260223-143052.png`.
 */
export function defaultFilename(prefix: string, extension: string): string {
  return `${prefix}-${formatTimestamp()}.${extension}`;
}

/**
 * Escape special XML characters in a string.
 * Used by GraphML and SVG export to produce valid XML output.
 *
 * @param str - The raw string to escape.
 * @returns The XML-safe escaped string.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
