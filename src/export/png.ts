/**
 * PNG / JPEG Export for perspektive.js
 *
 * Captures the WebGL canvas from Three.js and exports it as a raster image.
 * Supports custom resolution, high-DPI scaling (retina/4K), and both
 * lossless (PNG) and lossy (JPEG) formats.
 *
 * IMPORTANT: The Three.js WebGLRenderer must have `preserveDrawingBuffer: true`
 * for `toDataURL()` to work after the frame has been composited. If the canvas
 * is blank, ensure this flag is set on the renderer or use the `render()` approach
 * documented below.
 */

import type { ExportOptions } from './types';
import { downloadFile, canvasToBlob, defaultFilename } from './utils';

/** Type alias matching Three.js WebGLRenderer's interface (avoids hard import). */
interface WebGLRendererLike {
  domElement: HTMLCanvasElement;
  getSize: (target: { width: number; height: number }) => { width: number; height: number };
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  getPixelRatio: () => number;
  setPixelRatio: (value: number) => void;
  render: (scene: any, camera: any) => void;
}

/**
 * Capture the current WebGL canvas and download it as a PNG file.
 *
 * If `options.width` and `options.height` are provided and differ from the
 * current canvas dimensions, the renderer is temporarily resized, a frame
 * is rendered, the capture is taken, and then the original size is restored.
 *
 * @param renderer - The Three.js WebGLRenderer (from `useThree().gl`).
 * @param options - Optional export configuration.
 * @param scene - Optional Three.js Scene (required if custom resolution is requested).
 * @param camera - Optional Three.js Camera (required if custom resolution is requested).
 *
 * @example
 * ```tsx
 * import { useThree } from '@react-three/fiber';
 * import { exportToPNG } from '@nietzsche/perspektive/export';
 *
 * function ExportButton() {
 *   const { gl, scene, camera } = useThree();
 *   return (
 *     <button onClick={() => exportToPNG(gl, { scale: 2 }, scene, camera)}>
 *       Export PNG
 *     </button>
 *   );
 * }
 * ```
 */
export function exportToPNG(
  renderer: WebGLRendererLike,
  options?: ExportOptions,
  scene?: any,
  camera?: any,
): void {
  exportRaster(renderer, 'image/png', 'png', options, scene, camera);
}

/**
 * Capture the current WebGL canvas and download it as a JPEG file.
 *
 * Identical to `exportToPNG` but uses JPEG encoding with configurable quality.
 * Useful for large canvases where file size matters more than lossless fidelity.
 *
 * @param renderer - The Three.js WebGLRenderer.
 * @param options - Optional export configuration. `options.quality` controls JPEG quality (0-1).
 * @param scene - Optional Three.js Scene (required if custom resolution is requested).
 * @param camera - Optional Three.js Camera (required if custom resolution is requested).
 */
export function exportToJPEG(
  renderer: WebGLRendererLike,
  options?: ExportOptions,
  scene?: any,
  camera?: any,
): void {
  exportRaster(renderer, 'image/jpeg', 'jpg', options, scene, camera);
}

/**
 * Internal raster export implementation shared by PNG and JPEG exporters.
 *
 * Strategy:
 * 1. If custom dimensions or scale are requested AND scene+camera are provided,
 *    temporarily resize the renderer, re-render, capture, then restore.
 * 2. Otherwise, capture the canvas as-is using toDataURL/toBlob.
 * 3. If the renderer does not have preserveDrawingBuffer, we fall back to
 *    rendering to an offscreen canvas via drawImage.
 */
function exportRaster(
  renderer: WebGLRendererLike,
  mimeType: string,
  extension: string,
  options?: ExportOptions,
  scene?: any,
  camera?: any,
): void {
  const opts = {
    filename: options?.filename,
    width: options?.width,
    height: options?.height,
    background: options?.background ?? '#000000',
    scale: options?.scale ?? 1,
    quality: options?.quality ?? 0.92,
  };

  const sourceCanvas = renderer.domElement;
  const size = { width: 0, height: 0 };
  renderer.getSize(size);

  const targetWidth = (opts.width ?? size.width) * opts.scale;
  const targetHeight = (opts.height ?? size.height) * opts.scale;

  const needsResize = scene && camera && (
    targetWidth !== size.width || targetHeight !== size.height
  );

  const filename = opts.filename
    ? `${opts.filename}.${extension}`
    : defaultFilename('perspektive', extension);

  if (needsResize) {
    // Temporarily resize renderer for high-resolution capture
    const originalPixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(targetWidth, targetHeight, false);
    renderer.render(scene, camera);

    captureAndDownload(renderer.domElement, mimeType, filename, opts.quality, opts.background);

    // Restore original size
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(size.width, size.height, false);
    renderer.render(scene, camera);
  } else {
    // Capture at current size — may need offscreen canvas if preserveDrawingBuffer is false
    captureAndDownload(sourceCanvas, mimeType, filename, opts.quality, opts.background);
  }
}

/**
 * Capture a canvas element and trigger a download.
 *
 * Draws the WebGL canvas onto a 2D offscreen canvas (to add background color
 * and handle the preserveDrawingBuffer edge case), then converts to blob.
 */
function captureAndDownload(
  sourceCanvas: HTMLCanvasElement,
  mimeType: string,
  filename: string,
  quality: number,
  background: string,
): void {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Create an offscreen 2D canvas to composite background + WebGL content
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    console.error('[perspektive.js] Failed to get 2D context for export canvas');
    return;
  }

  // Draw background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Draw the WebGL canvas on top
  ctx.drawImage(sourceCanvas, 0, 0);

  // Convert to blob and download
  canvasToBlob(offscreen, mimeType, quality)
    .then((blob) => {
      downloadFile(blob, filename, mimeType);
    })
    .catch((err) => {
      console.error('[perspektive.js] PNG/JPEG export failed:', err);
      // Fallback: try toDataURL approach
      fallbackDataUrlDownload(offscreen, mimeType, filename, quality);
    });
}

/**
 * Fallback export using toDataURL when toBlob fails.
 * Less efficient (base64 string in memory) but more widely supported.
 */
function fallbackDataUrlDownload(
  canvas: HTMLCanvasElement,
  mimeType: string,
  filename: string,
  quality: number,
): void {
  try {
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    requestAnimationFrame(() => {
      document.body.removeChild(anchor);
    });
  } catch (err) {
    console.error('[perspektive.js] Fallback export also failed:', err);
  }
}
