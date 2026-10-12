import { Frame, Layer } from '../types';

// Global image cache for frame rendering and export pipelines
const renderImageCache = new Map<string, HTMLImageElement>();

export function getCachedRenderImage(url: string, onLoaded?: () => void): HTMLImageElement {
  if (renderImageCache.has(url)) {
    const existing = renderImageCache.get(url)!;
    if (existing.complete && onLoaded) {
      queueMicrotask(onLoaded);
    }
    return existing;
  }
  const img = new Image();
  if (onLoaded) {
    img.addEventListener('load', onLoaded, { once: true });
  }
  renderImageCache.set(url, img);
  img.src = url;
  return img;
}

/**
 * Utility to render a composite animation frame (all visible layers) to any canvas
 */
export async function renderFrameToCanvas(
  frame: Frame,
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  targetCanvas: HTMLCanvasElement,
  includeBackground = true
): Promise<void> {
  targetCanvas.width = width;
  targetCanvas.height = height;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // Background
  if (includeBackground && backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor === 'white' ? '#FFFFFF' : backgroundColor === 'black' ? '#000000' : backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw layers in order (bottom to top)
  for (const layer of layers) {
    if (!layer.visible) continue;
    const celData = frame.cels[layer.id];
    if (!celData) continue;

    const img = getCachedRenderImage(celData);
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1.0;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    } else {
      await new Promise<void>((resolve) => {
        img.addEventListener(
          'load',
          () => {
            ctx.save();
            ctx.globalAlpha = layer.opacity ?? 1.0;
            ctx.drawImage(img, 0, 0, width, height);
            ctx.restore();
            resolve();
          },
          { once: true }
        );
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }
  }
}

/**
 * Synchronous version using cached Image elements
 */
export function renderFrameSync(
  imagesMap: Record<string, HTMLImageElement>,
  frame: Frame,
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  ctx: CanvasRenderingContext2D,
  includeBackground = true
) {
  ctx.clearRect(0, 0, width, height);

  if (includeBackground && backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor === 'white' ? '#FFFFFF' : backgroundColor === 'black' ? '#000000' : backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  for (const layer of layers) {
    if (!layer.visible) continue;
    const celData = frame.cels[layer.id];
    if (!celData) continue;
    const img = imagesMap[celData] || renderImageCache.get(celData);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1.0;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    }
  }
}

/**
 * Generate a small dataURL thumbnail for a frame
 */
export async function generateFrameThumbnail(
  frame: Frame,
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  thumbWidth = 120
): Promise<string> {
  const thumbCanvas = document.createElement('canvas');
  const thumbHeight = Math.round((thumbWidth / width) * height);
  thumbCanvas.width = thumbWidth;
  thumbCanvas.height = thumbHeight;

  const tempCanvas = document.createElement('canvas');
  await renderFrameToCanvas(frame, layers, width, height, backgroundColor, tempCanvas, true);

  const tCtx = thumbCanvas.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(tempCanvas, 0, 0, thumbWidth, thumbHeight);
    return thumbCanvas.toDataURL('image/png');
  }
  return '';
}
