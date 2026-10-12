import { BrushSettings, Point } from '../types';
import { hexToRgba } from './floodFill';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

/**
 * Advanced Brush, Pencil, Stamp & Eraser Rendering Engine
 * Featuring Quadratic Bezier Curve Smoothing & Feathered Eraser
 */
export class BrushRenderer {
  /**
   * Quadratic Bezier smoothed brush segment
   */
  static renderSmoothBrush(
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    p2: StrokePoint,
    settings: BrushSettings,
    stampCanvas: HTMLCanvasElement | HTMLImageElement | null,
    accumulatedDistRef: { dist: number }
  ) {
    const { brushStyle, size, opacity, color } = settings;
    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    const dx = mid2.x - mid1.x;
    const dy = mid2.y - mid1.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.globalAlpha = opacity;

    if (brushStyle === 'solid-round') {
      const radius = size * (0.4 + 0.6 * p1.pressure);
      ctx.lineWidth = Math.max(1, radius);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      ctx.stroke();
    } else if (brushStyle === 'flat-marker') {
      const markerAngle = -Math.PI / 6; // -30 deg
      const steps = Math.max(2, Math.ceil(distance / 2));
      const width = Math.max(2, size * (0.5 + 0.5 * p1.pressure));
      const thickness = Math.max(1, width * 0.28);

      ctx.fillStyle = color;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Quadratic bezier interpolation: (1-t)^2*p0 + 2(1-t)t*p1 + t^2*p2
        const it = 1 - t;
        const x = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const y = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(markerAngle);
        ctx.fillRect(-width / 2, -thickness / 2, width, thickness);
        ctx.restore();
      }
    } else if (brushStyle === 'calligraphy') {
      const nibAngle = Math.PI / 4; // 45 deg
      const steps = Math.max(2, Math.ceil(distance / 1.5));
      const nibWidth = Math.max(2, size * (0.6 + 0.4 * p1.pressure));
      const [r, g, b] = hexToRgba(color, 1);
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, opacity * 0.95)})`;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const it = 1 - t;
        const x = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const y = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(nibAngle);
        ctx.fillRect(-nibWidth / 2, -1, nibWidth, 2);
        ctx.restore();
      }
    } else if (brushStyle === 'airbrush') {
      const radius = Math.max(4, (size * 1.5) * (0.5 + 0.5 * p1.pressure));
      const density = Math.max(8, Math.floor(size * 1.8));
      const [r, g, b] = hexToRgba(color, 1);
      const steps = Math.max(2, Math.ceil(distance / 4));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const it = 1 - t;
        const cx = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const cy = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;

        for (let i = 0; i < density; i++) {
          const randAngle = Math.random() * Math.PI * 2;
          const randRadius = (Math.random() * 0.7 + Math.random() * 0.3) * radius;
          const px = cx + Math.cos(randAngle) * randRadius;
          const py = cy + Math.sin(randAngle) * randRadius;

          const particleOpacity = Math.max(0.04, 0.4 * (1 - randRadius / radius));
          ctx.fillStyle = `rgba(${r},${g},${b},${particleOpacity})`;
          const pSize = Math.random() > 0.8 ? 1.8 : 1.0;
          ctx.fillRect(px, py, pSize, pSize);
        }
      }
    } else if (brushStyle === 'image-stamp' && stampCanvas) {
      BrushRenderer.renderStampTrail(
        ctx,
        p0,
        p1,
        p2,
        settings,
        stampCanvas,
        accumulatedDistRef
      );
    }
    ctx.restore();
  }

  /**
   * Draw a single stamp image onto canvas with full settings modulation:
   * scale, rotation, opacity, and optional color tinting.
   */
  static drawSingleStamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rotationRad: number,
    stampSource: HTMLCanvasElement | HTMLImageElement,
    settings: BrushSettings
  ) {
    const stampW = Math.max(4, settings.stampSize || settings.size * 2 || 32);
    const srcW =
      stampSource instanceof HTMLImageElement
        ? stampSource.naturalWidth || stampSource.width || stampW
        : stampSource.width || stampW;
    const srcH =
      stampSource instanceof HTMLImageElement
        ? stampSource.naturalHeight || stampSource.height || stampW
        : stampSource.height || stampW;
    const aspect = srcH / Math.max(1, srcW);
    const stampH = stampW * aspect;

    ctx.save();
    ctx.globalAlpha = Math.max(0.01, Math.min(1, settings.opacity));
    ctx.translate(x, y);
    ctx.rotate(rotationRad);

    if (settings.stampTintWithColor && settings.color) {
      // Offscreen canvas for color tinting
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(stampW));
      off.height = Math.max(1, Math.round(stampH));
      const offCtx = off.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(stampSource, 0, 0, off.width, off.height);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.fillStyle = settings.color;
        offCtx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(off, -stampW / 2, -stampH / 2);
      } else {
        ctx.drawImage(stampSource, -stampW / 2, -stampH / 2, stampW, stampH);
      }
    } else {
      ctx.drawImage(stampSource, -stampW / 2, -stampH / 2, stampW, stampH);
    }

    ctx.restore();
  }

  /**
   * Renders a continuous trail of stamps along a smooth Bezier path
   * spaced precisely by stampSpacing and oriented by dynamic or static angle.
   */
  static renderStampTrail(
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    p2: StrokePoint,
    settings: BrushSettings,
    stampCanvas: HTMLCanvasElement | HTMLImageElement,
    accumulatedDistRef: { dist: number }
  ) {
    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dx = mid2.x - mid1.x;
    const dy = mid2.y - mid1.y;
    const distance = Math.hypot(dx, dy);

    const spacing = Math.max(2, settings.stampSpacing || 20);
    const steps = Math.max(2, Math.ceil(distance / 2));
    let prevPt = mid1;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const it = 1 - t;
      const curX = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
      const curY = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;

      const stepDist = Math.hypot(curX - prevPt.x, curY - prevPt.y);
      accumulatedDistRef.dist += stepDist;

      if (accumulatedDistRef.dist >= spacing) {
        const stepAngle = Math.atan2(curY - prevPt.y, curX - prevPt.x);
        let rotation = (settings.stampRotation * Math.PI) / 180;
        if (settings.stampDynamicRotation) {
          rotation += stepAngle;
        }
        BrushRenderer.drawSingleStamp(ctx, curX, curY, rotation, stampCanvas, settings);
        accumulatedDistRef.dist = 0;
      }
      prevPt = { x: curX, y: curY };
    }
  }

  /**
   * Quadratic Bezier smoothed pencil segment
   */
  static renderSmoothPencil(
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    p2: StrokePoint,
    settings: BrushSettings
  ) {
    const { pencilTexture, size, opacity, color } = settings;
    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    const dx = mid2.x - mid1.x;
    const dy = mid2.y - mid1.y;
    const distance = Math.hypot(dx, dy);
    const [r, g, b] = hexToRgba(color, 1);

    ctx.save();

    if (pencilTexture === 'hard-4h') {
      const lineWidth = Math.max(0.8, size * 0.4);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${r},${g},${b},${opacity * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      ctx.stroke();
    } else if (pencilTexture === 'soft-2b') {
      const effectiveSize = Math.max(1, size * (0.5 + 0.5 * p1.pressure));
      ctx.lineWidth = effectiveSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${r},${g},${b},${opacity * (0.4 + 0.6 * p1.pressure)})`;
      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      ctx.stroke();

      // Subtle graphite grain along curve
      const grainSteps = Math.max(2, Math.ceil(distance / 2));
      for (let i = 0; i <= grainSteps; i++) {
        const t = i / grainSteps;
        const it = 1 - t;
        const x = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const y = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;
        const jitterX = (Math.random() - 0.5) * effectiveSize * 0.7;
        const jitterY = (Math.random() - 0.5) * effectiveSize * 0.7;
        const gAlpha = opacity * (0.15 + Math.random() * 0.35) * p1.pressure;
        ctx.fillStyle = `rgba(${r},${g},${b},${gAlpha})`;
        ctx.fillRect(x + jitterX, y + jitterY, 1.2, 1.2);
      }
    } else if (pencilTexture === 'colored-pencil') {
      const effectiveSize = Math.max(1.5, size * (0.6 + 0.4 * p1.pressure));
      const steps = Math.max(2, Math.ceil(distance / 1.5));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const it = 1 - t;
        const cx = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const cy = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;
        const grainCount = Math.max(3, Math.floor(effectiveSize * 1.5));

        for (let gIdx = 0; gIdx < grainCount; gIdx++) {
          const randAngle = Math.random() * Math.PI * 2;
          const randR = Math.random() * (effectiveSize / 2);
          const px = cx + Math.cos(randAngle) * randR;
          const py = cy + Math.sin(randAngle) * randR;
          const gAlpha = opacity * (0.3 + Math.random() * 0.45);
          ctx.fillStyle = `rgba(${r},${g},${b},${gAlpha})`;
          ctx.fillRect(px, py, 1.3, 1.3);
        }
      }
    } else if (pencilTexture === 'charcoal') {
      const effectiveSize = Math.max(2, size * 1.2 * (0.6 + 0.4 * p1.pressure));
      const steps = Math.max(2, Math.ceil(distance / 2));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const it = 1 - t;
        const cx = it * it * mid1.x + 2 * it * t * p1.x + t * t * mid2.x;
        const cy = it * it * mid1.y + 2 * it * t * p1.y + t * t * mid2.y;
        const particleCount = Math.max(5, Math.floor(effectiveSize * 2.0));

        for (let pIdx = 0; pIdx < particleCount; pIdx++) {
          const randDist = (Math.random() * 0.6 + Math.random() * 0.4) * (effectiveSize / 2);
          const randA = Math.random() * Math.PI * 2;
          const px = cx + Math.cos(randA) * randDist;
          const py = cy + Math.sin(randA) * randDist;
          const pAlpha = opacity * (0.25 + Math.random() * 0.65);
          const pW = Math.random() > 0.6 ? 2.0 : 1.2;
          ctx.fillStyle = `rgba(${r},${g},${b},${pAlpha})`;
          ctx.fillRect(px, py, pW, pW);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Eraser with Feathering / Softness and Shapes (Round, Square, Chisel)
   */
  static renderEraser(
    ctx: CanvasRenderingContext2D,
    p1: StrokePoint,
    p2: StrokePoint,
    settings: BrushSettings
  ) {
    const { size, eraserSoftness = 0, eraserShape = 'round', opacity = 1 } = settings;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, size * 0.25)));

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    if (eraserSoftness <= 0.05) {
      // Hard / Crisp Pixel Eraser
      ctx.globalAlpha = opacity;

      if (eraserShape === 'round') {
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (eraserShape === 'square') {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      } else if (eraserShape === 'chisel') {
        const angle = Math.PI / 4;
        const thickness = Math.max(2, size * 0.3);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.fillRect(-size / 2, -thickness / 2, size, thickness);
          ctx.restore();
        }
      }
    } else {
      // Feathered / Soft Radial Eraser
      const radius = size / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + dx * t;
        const y = p1.y + dy * t;

        const grad = ctx.createRadialGradient(x, y, radius * (1 - eraserSoftness * 0.8), x, y, radius);
        grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
