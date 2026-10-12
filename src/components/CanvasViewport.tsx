import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Project, BrushSettings, ToolType, ViewportTransform, SelectionTransform, Point, ShapeType } from '../types';
import { floodFill } from '../engine/floodFill';
import { renderFrameToCanvas } from '../engine/frameRenderer';
import { BrushRenderer, StrokePoint } from '../engine/brushRenderer';
import { Settings2, Check, RotateCcw, Trash2, RotateCw, Hand } from 'lucide-react';

interface CanvasViewportProps {
  project: Project;
  activeTool: ToolType;
  setActiveTool?: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  transform: ViewportTransform;
  setTransform: React.Dispatch<React.SetStateAction<ViewportTransform>>;
  onCommitCel: (celDataUrl: string) => void;
  onColorPick: (hex: string) => void;
  onUpdateOnionSkin: (settings: Project['onionSkin']) => void;
  isPlaying: boolean;
  pendingImportAsset?: { dataUrl: string; width: number; height: number } | null;
  onClearPendingImport?: () => void;
}

type TransformHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate' | 'move' | null;

// Synchronous In-Memory Image Cache to eradicate asynchronous image flickering
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(url: string, onLoaded?: (loadedImg: HTMLImageElement) => void): HTMLImageElement {
  if (imageCache.has(url)) {
    const existing = imageCache.get(url)!;
    if (onLoaded) {
      if (existing.complete && existing.naturalWidth > 0) {
        queueMicrotask(() => onLoaded(existing));
      } else {
        existing.addEventListener('load', () => onLoaded(existing), { once: true });
      }
    }
    return existing;
  }
  const img = new Image();
  if (onLoaded) {
    img.addEventListener('load', () => onLoaded(img), { once: true });
  }
  imageCache.set(url, img);
  img.src = url;
  return img;
}

// Crisp, High-Performance Neo-Brutalist Star Cursor Vector (28x28 with 14,14 origin center)
const TARGET_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
  <circle cx="6" cy="6" r="5" fill="#7C3AED" stroke="#000000" stroke-width="1.3"/>
  <circle cx="6" cy="6" r="1.6" fill="#000000"/>
</svg>`;

const STAR_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(TARGET_CURSOR_SVG)}") 6 6, crosshair`;

// Expanded workspace zoom steps up to 1600% (16.0)
const ZOOM_STEPS = [
  0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0,
];

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  project,
  activeTool,
  setActiveTool,
  brushSettings,
  transform,
  setTransform,
  onCommitCel,
  onColorPick,
  onUpdateOnionSkin,
  isPlaying,
  pendingImportAsset,
  onClearPendingImport,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const upperCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Offscreen double-buffer to eliminate screen tearing
  const offscreenCompositeRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showOnionSkinMenu, setShowOnionSkinMenu] = useState(false);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  // Custom High-Contrast Cursor tracking
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  // Selection & Transform state
  const [selection, setSelection] = useState<SelectionTransform>({
    isActive: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    sourceCanvas: null,
    originalX: 0,
    originalY: 0,
    originalWidth: 0,
    originalHeight: 0,
  });

  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<TransformHandle>(null);
  const transformStartRef = useRef<{
    clientX: number;
    clientY: number;
    selX: number;
    selY: number;
    selW: number;
    selH: number;
    selRot: number;
  }>({
    clientX: 0,
    clientY: 0,
    selX: 0,
    selY: 0,
    selW: 0,
    selH: 0,
    selRot: 0,
  });

  // Stroke point smoothing buffer for Bezier curve interpolation
  const strokeBufferRef = useRef<StrokePoint[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const spaceHeldRef = useRef(false);

  // Stamp Offscreen Pattern Canvases Cache Map
  const stampCanvasesMapRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const accumulatedDistRef = useRef<{ dist: number }>({ dist: 0 });

  // Last committed cel to prevent clearing canvas when already rendered
  const lastCommittedCelRef = useRef<string | null>(null);
  const lastFrameIndexRef = useRef<number>(project.activeFrameIndex);
  const lastLayerIdRef = useRef<string>(project.activeLayerId);

  // Track space key for temporary panning
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true;
        setIsSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        setIsSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Guarantee pointer events and system cursor visibility are cleanly restored on unmount
  useEffect(() => {
    return () => {
      if (document.body) {
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
      }
    };
  }, []);

  // High-performance direct hardware-accelerated Panning refs
  const panOriginRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number }>({
    clientX: 0,
    clientY: 0,
    panX: transform.panX,
    panY: transform.panY,
  });
  const currentPanRef = useRef<{ panX: number; panY: number }>({
    panX: transform.panX,
    panY: transform.panY,
  });
  const panRafRef = useRef<number | null>(null);

  const startPanning = useCallback(
    (clientX: number, clientY: number) => {
      setIsPanning(true);
      panOriginRef.current = {
        clientX,
        clientY,
        panX: transform.panX,
        panY: transform.panY,
      };
      currentPanRef.current = { panX: transform.panX, panY: transform.panY };
      if (canvasFrameRef.current) {
        canvasFrameRef.current.style.transition = 'none';
      }
    },
    [transform.panX, transform.panY]
  );

  // Window-level Panning with direct zero-friction transform updates (no unthrottled re-renders)
  useEffect(() => {
    if (!isPanning) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - panOriginRef.current.clientX;
      const dy = e.clientY - panOriginRef.current.clientY;
      const nextX = panOriginRef.current.panX + dx;
      const nextY = panOriginRef.current.panY + dy;
      currentPanRef.current = { panX: nextX, panY: nextY };

      // Direct zero-friction GPU transform update on canvasFrameRef (avoids React re-renders)
      if (canvasFrameRef.current) {
        canvasFrameRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0px) scale(${transform.zoom})`;
      }
    };

    const handleWindowPointerUp = () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      setTransform((prev) => ({
        ...prev,
        panX: currentPanRef.current.panX,
        panY: currentPanRef.current.panY,
      }));
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    };
  }, [isPanning, transform.zoom, setTransform]);

  // Preload all cels in all frames into synchronous memory cache
  useEffect(() => {
    project.frames.forEach((f) => {
      Object.values(f.cels).forEach((celData) => {
        if (celData) getCachedImage(celData);
      });
    });
  }, [project.frames]);

  // Helper to retrieve active stamp source (offscreen canvas or HTMLImageElement)
  const getActiveStampSource = useCallback((): HTMLCanvasElement | HTMLImageElement | null => {
    const stamp =
      project.stamps.find((s) => s.id === brushSettings.selectedStampId) ||
      project.stamps[0];

    if (!stamp) return null;

    const existingCanvas = stampCanvasesMapRef.current.get(stamp.id);
    if (existingCanvas) return existingCanvas;

    const cached = imageCache.get(stamp.dataUrl);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      const w = Math.max(16, stamp.width || cached.naturalWidth || 64);
      const h = Math.max(16, stamp.height || cached.naturalHeight || 64);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const oCtx = offCanvas.getContext('2d');
      if (oCtx) {
        oCtx.drawImage(cached, 0, 0, w, h);
        stampCanvasesMapRef.current.set(stamp.id, offCanvas);
        return offCanvas;
      }
      return cached;
    }

    const img = getCachedImage(stamp.dataUrl, (loadedImg) => {
      const w = Math.max(16, stamp.width || loadedImg.naturalWidth || 64);
      const h = Math.max(16, stamp.height || loadedImg.naturalHeight || 64);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const oCtx = offCanvas.getContext('2d');
      if (oCtx) {
        oCtx.drawImage(loadedImg, 0, 0, w, h);
        stampCanvasesMapRef.current.set(stamp.id, offCanvas);
      }
    });

    if (img.complete && img.naturalWidth > 0) {
      const w = Math.max(16, stamp.width || img.naturalWidth || 64);
      const h = Math.max(16, stamp.height || img.naturalHeight || 64);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const oCtx = offCanvas.getContext('2d');
      if (oCtx) {
        oCtx.drawImage(img, 0, 0, w, h);
        stampCanvasesMapRef.current.set(stamp.id, offCanvas);
        return offCanvas;
      }
      return img;
    }
    return null;
  }, [brushSettings.selectedStampId, project.stamps]);

  // Pre-render all stamp images into off-screen canvas map
  useEffect(() => {
    project.stamps.forEach((stamp) => {
      const img = getCachedImage(stamp.dataUrl, (loadedImg) => {
        const w = Math.max(16, stamp.width || loadedImg.naturalWidth || 64);
        const h = Math.max(16, stamp.height || loadedImg.naturalHeight || 64);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const oCtx = offCanvas.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(loadedImg, 0, 0, w, h);
          stampCanvasesMapRef.current.set(stamp.id, offCanvas);
        }
      });
      if (img.complete && img.naturalWidth > 0) {
        const w = Math.max(16, stamp.width || img.naturalWidth || 64);
        const h = Math.max(16, stamp.height || img.naturalHeight || 64);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const oCtx = offCanvas.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(img, 0, 0, w, h);
          stampCanvasesMapRef.current.set(stamp.id, offCanvas);
        }
      }
    });
  }, [project.stamps]);

  // Safe frame and layer bounds check
  const safeFrameIndex = Math.max(0, Math.min(project.activeFrameIndex, project.frames.length - 1));
  const activeFrame = project.frames[safeFrameIndex] || project.frames[0];
  const activeLayer = project.layers.find((l) => l.id === project.activeLayerId) || project.layers[0];
  const isLayerLocked = activeLayer?.locked ?? false;

  const currentShapeType: ShapeType =
    activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'arrow'
      ? activeTool
      : brushSettings.activeShape || 'rect';

  // Double-buffered Redraw of Composite Canvas
  const redrawComposite = useCallback(async () => {
    const compCanvas = compositeCanvasRef.current;
    if (!compCanvas || !activeFrame) return;
    const ctx = compCanvas.getContext('2d');
    if (!ctx) return;

    if (!offscreenCompositeRef.current) {
      offscreenCompositeRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenCompositeRef.current;
    offCanvas.width = project.width;
    offCanvas.height = project.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, project.width, project.height);

    // 1. Background (ALWAYS rendered solidly to prevent blank grey voids)
    const bg = project.backgroundColor;
    offCtx.fillStyle = bg === 'black' ? '#000000' : bg === 'transparent' ? '#FFFFFF' : bg || '#FFFFFF';
    offCtx.fillRect(0, 0, project.width, project.height);

    // 2. Onion Skinning (Previous Frames) - Only when not playing
    if (project.onionSkin.enabled && !isPlaying) {
      const prevCanvas = document.createElement('canvas');
      const pCtx = prevCanvas.getContext('2d');
      if (pCtx) {
        for (let step = project.onionSkin.prevFrames; step >= 1; step--) {
          const prevIdx = safeFrameIndex - step;
          if (prevIdx >= 0 && project.frames[prevIdx]) {
            const prevFrame = project.frames[prevIdx];
            await renderFrameToCanvas(
              prevFrame,
              project.layers,
              project.width,
              project.height,
              'transparent',
              prevCanvas,
              false
            );

            offCtx.save();
            offCtx.globalAlpha = project.onionSkin.opacity * (1 - (step - 1) * 0.25);
            offCtx.drawImage(prevCanvas, 0, 0);

            const tintCanvas = document.createElement('canvas');
            tintCanvas.width = project.width;
            tintCanvas.height = project.height;
            const tCtx = tintCanvas.getContext('2d');
            if (tCtx) {
              tCtx.drawImage(prevCanvas, 0, 0);
              tCtx.globalCompositeOperation = 'source-in';
              tCtx.fillStyle = project.onionSkin.prevColor || '#FF5F38';
              tCtx.fillRect(0, 0, project.width, project.height);

              offCtx.globalAlpha = (project.onionSkin.opacity * 0.75) / step;
              offCtx.drawImage(tintCanvas, 0, 0);
            }
            offCtx.restore();
          }
        }
      }
    }

    const activeIdx = project.layers.findIndex((l) => l.id === project.activeLayerId);
    const upCanvas = upperCanvasRef.current;
    const upCtx = upCanvas?.getContext('2d');

    // 3. Render visible layers
    // When PLAYING: ALL layers are composited onto lower canvas sequentially (index 0 to len-1)
    if (isPlaying) {
      for (const layer of project.layers) {
        if (!layer.visible) continue;
        const cel = activeFrame.cels[layer.id];
        if (cel) {
          const img = getCachedImage(cel);
          if (img.complete && img.naturalWidth > 0) {
            offCtx.save();
            offCtx.globalAlpha = layer.opacity ?? 1.0;
            offCtx.drawImage(img, 0, 0, project.width, project.height);
            offCtx.restore();
          }
        }
      }

      // Upper canvas cleared during playback
      if (upCanvas && upCtx) {
        upCanvas.width = project.width;
        upCanvas.height = project.height;
        upCtx.clearRect(0, 0, project.width, project.height);
      }
    } else {
      // When PAUSED:
      // Lower canvas renders layers strictly BELOW the active layer (index 0 to activeIdx - 1)
      for (let i = 0; i < project.layers.length; i++) {
        const layer = project.layers[i];
        if (!layer.visible) continue;
        if (i >= activeIdx) break; // Don't draw active layer or layers above it on the lower canvas

        const cel = activeFrame.cels[layer.id];
        if (cel) {
          const img = getCachedImage(cel);
          if (img.complete && img.naturalWidth > 0) {
            offCtx.save();
            offCtx.globalAlpha = layer.opacity ?? 1.0;
            offCtx.drawImage(img, 0, 0, project.width, project.height);
            offCtx.restore();
          }
        }
      }

      // Upper canvas renders layers strictly ABOVE the active layer (index activeIdx + 1 to len - 1)
      if (upCanvas && upCtx) {
        upCanvas.width = project.width;
        upCanvas.height = project.height;
        upCtx.clearRect(0, 0, project.width, project.height);

        for (let i = activeIdx + 1; i < project.layers.length; i++) {
          const layer = project.layers[i];
          if (!layer.visible) continue;

          const cel = activeFrame.cels[layer.id];
          if (cel) {
            const img = getCachedImage(cel);
            if (img.complete && img.naturalWidth > 0) {
              upCtx.save();
              upCtx.globalAlpha = layer.opacity ?? 1.0;
              upCtx.drawImage(img, 0, 0, project.width, project.height);
              upCtx.restore();
            }
          }
        }
      }
    }

    // 4. Onion Skinning (Next Frames) - Only when not playing
    if (project.onionSkin.enabled && !isPlaying) {
      const nextCanvas = document.createElement('canvas');
      const nCtx = nextCanvas.getContext('2d');
      if (nCtx) {
        for (let step = 1; step <= project.onionSkin.nextFrames; step++) {
          const nextIdx = safeFrameIndex + step;
          if (nextIdx < project.frames.length && project.frames[nextIdx]) {
            const nextFrame = project.frames[nextIdx];
            await renderFrameToCanvas(
              nextFrame,
              project.layers,
              project.width,
              project.height,
              'transparent',
              nextCanvas,
              false
            );

            offCtx.save();
            offCtx.globalAlpha = project.onionSkin.opacity * (1 - (step - 1) * 0.25);
            offCtx.drawImage(nextCanvas, 0, 0);

            const tintCanvas = document.createElement('canvas');
            tintCanvas.width = project.width;
            tintCanvas.height = project.height;
            const tCtx = tintCanvas.getContext('2d');
            if (tCtx) {
              tCtx.drawImage(nextCanvas, 0, 0);
              tCtx.globalCompositeOperation = 'source-in';
              tCtx.fillStyle = project.onionSkin.nextColor || '#00E5F0';
              tCtx.fillRect(0, 0, project.width, project.height);

              offCtx.globalAlpha = (project.onionSkin.opacity * 0.75) / step;
              offCtx.drawImage(tintCanvas, 0, 0);
            }
            offCtx.restore();
          }
        }
      }
    }

    // Single synchronous double-buffer flip to screen (Zero GPU re-allocation for flicker-free rendering)
    if (compCanvas.width !== project.width || compCanvas.height !== project.height) {
      compCanvas.width = project.width;
      compCanvas.height = project.height;
    }
    ctx.clearRect(0, 0, project.width, project.height);
    ctx.drawImage(offCanvas, 0, 0);
  }, [project, safeFrameIndex, activeFrame, isPlaying]);

  // Redraw Active Layer Cel (only when paused/editing)
  const redrawActiveCel = useCallback(() => {
    const actCanvas = activeCanvasRef.current;
    if (!actCanvas) return;
    const ctx = actCanvas.getContext('2d');
    if (!ctx) return;

    // During playback, activeCanvas is cleared once so compositeCanvas handles all rendering
    if (isPlaying) {
      ctx.clearRect(0, 0, project.width, project.height);
      return;
    }

    const currentCelData = activeFrame?.cels[project.activeLayerId];
    const frameOrLayerChanged =
      lastFrameIndexRef.current !== project.activeFrameIndex ||
      lastLayerIdRef.current !== project.activeLayerId;

    lastFrameIndexRef.current = project.activeFrameIndex;
    lastLayerIdRef.current = project.activeLayerId;

    if (!frameOrLayerChanged && currentCelData && currentCelData === lastCommittedCelRef.current) {
      return;
    }

    if (actCanvas.width !== project.width || actCanvas.height !== project.height) {
      actCanvas.width = project.width;
      actCanvas.height = project.height;
    }
    ctx.clearRect(0, 0, project.width, project.height);

    if (!activeLayer || !activeLayer.visible) return;

    if (currentCelData) {
      const img = getCachedImage(currentCelData, (loadedImg) => {
        ctx.clearRect(0, 0, project.width, project.height);
        ctx.save();
        ctx.globalAlpha = activeLayer.opacity ?? 1.0;
        ctx.drawImage(loadedImg, 0, 0, project.width, project.height);
        ctx.restore();
      });
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = activeLayer.opacity ?? 1.0;
        ctx.drawImage(img, 0, 0, project.width, project.height);
        ctx.restore();
      }
    }
  }, [project.width, project.height, project.activeLayerId, project.activeFrameIndex, activeLayer, activeFrame, isPlaying]);

  // Render selection on preview canvas
  const renderSelectionOnPreview = useCallback(() => {
    const prevCanvas = previewCanvasRef.current;
    if (!prevCanvas) return;
    const pCtx = prevCanvas.getContext('2d');
    if (!pCtx) return;

    prevCanvas.width = project.width;
    prevCanvas.height = project.height;
    pCtx.clearRect(0, 0, project.width, project.height);

    if (!selection.isActive || !selection.sourceCanvas) return;

    pCtx.save();
    const cx = selection.x + selection.width / 2;
    const cy = selection.y + selection.height / 2;
    pCtx.translate(cx, cy);
    pCtx.rotate((selection.rotation * Math.PI) / 180);
    pCtx.drawImage(
      selection.sourceCanvas,
      -selection.width / 2,
      -selection.height / 2,
      selection.width,
      selection.height
    );
    pCtx.restore();
  }, [selection, project.width, project.height]);

  useEffect(() => {
    redrawComposite();
    redrawActiveCel();
  }, [redrawComposite, redrawActiveCel]);

    // Handle incoming imported image assets for interactive transform (scale, rotate, move)
    useEffect(() => {
      if (!pendingImportAsset) return;
      const { dataUrl, width, height } = pendingImportAsset;

      const scale = Math.min(
        (project.width * 0.75) / Math.max(1, width),
        (project.height * 0.75) / Math.max(1, height),
        1.0
      );
      const selW = Math.max(16, Math.round(width * scale));
      const selH = Math.max(16, Math.round(height * scale));
      const selX = Math.round((project.width - selW) / 2);
      const selY = Math.round((project.height - selH) / 2);

      const off = document.createElement('canvas');
      off.width = selW;
      off.height = selH;
      const oCtx = off.getContext('2d');
      const img = new Image();
      img.onload = () => {
        if (oCtx) {
          oCtx.drawImage(img, 0, 0, selW, selH);
        }
        setSelection({
          isActive: true,
          x: selX,
          y: selY,
          width: selW,
          height: selH,
          rotation: 0,
          sourceCanvas: off,
          originalX: selX,
          originalY: selY,
          originalWidth: selW,
          originalHeight: selH,
        });
        if (setActiveTool) {
          setActiveTool('select');
        }
        if (onClearPendingImport) {
          onClearPendingImport();
        }
      };
      img.src = dataUrl;
    }, [pendingImportAsset, project.width, project.height, setActiveTool, onClearPendingImport]);

    useEffect(() => {
      if (selection.isActive) {
        renderSelectionOnPreview();
      }
    }, [selection, renderSelectionOnPreview]);

  // Commit selection back to active layer cel
  const commitSelection = useCallback(() => {
    if (!selection.isActive || !selection.sourceCanvas) return;

    const actCanvas = activeCanvasRef.current;
    const prevCanvas = previewCanvasRef.current;
    if (!actCanvas) return;
    const ctx = actCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    const cx = selection.x + selection.width / 2;
    const cy = selection.y + selection.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((selection.rotation * Math.PI) / 180);
    ctx.drawImage(
      selection.sourceCanvas,
      -selection.width / 2,
      -selection.height / 2,
      selection.width,
      selection.height
    );
    ctx.restore();

    if (prevCanvas) {
      const pCtx = prevCanvas.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, project.width, project.height);
    }

    const newCelUrl = actCanvas.toDataURL('image/png');
    lastCommittedCelRef.current = newCelUrl;
    onCommitCel(newCelUrl);
    setSelection((prev) => ({ ...prev, isActive: false, sourceCanvas: null }));
  }, [selection, onCommitCel, project.width, project.height]);

  // Delete selected region
  const deleteSelection = useCallback(() => {
    if (!selection.isActive) return;

    const actCanvas = activeCanvasRef.current;
    const prevCanvas = previewCanvasRef.current;
    if (prevCanvas) {
      const pCtx = prevCanvas.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, project.width, project.height);
    }

    if (actCanvas) {
      const newCelUrl = actCanvas.toDataURL('image/png');
      lastCommittedCelRef.current = newCelUrl;
      onCommitCel(newCelUrl);
    }

    setSelection((prev) => ({ ...prev, isActive: false, sourceCanvas: null }));
  }, [selection.isActive, onCommitCel]);

  const resetSelection = useCallback(() => {
    if (!selection.isActive) return;
    setSelection((prev) => ({
      ...prev,
      x: prev.originalX,
      y: prev.originalY,
      width: prev.originalWidth,
      height: prev.originalHeight,
      rotation: 0,
    }));
  }, [selection.isActive]);

  useEffect(() => {
    if (activeTool !== 'select' && selection.isActive) {
      commitSelection();
    }
  }, [activeTool, selection.isActive, commitSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selection.isActive) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commitSelection();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection.isActive, deleteSelection, commitSelection, resetSelection]);

  // Coordinate mapping
  const getCanvasCoordinates = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement> | { clientX: number; clientY: number }): Point => {
      const canvas = activeCanvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = project.width / rect.width;
      const scaleY = project.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const pressure = 'pressure' in e && (e as React.PointerEvent).pressure > 0
        ? (e as React.PointerEvent).pressure
        : 0.5;

      return { x, y, pressure };
    },
    [project.width, project.height]
  );

  const isInsideSelection = (pt: Point) => {
    if (!selection.isActive) return false;
    const minX = Math.min(selection.x, selection.x + selection.width);
    const maxX = Math.max(selection.x, selection.x + selection.width);
    const minY = Math.min(selection.y, selection.y + selection.height);
    const maxY = Math.max(selection.y, selection.y + selection.height);
    return pt.x >= minX - 10 && pt.x <= maxX + 10 && pt.y >= minY - 10 && pt.y <= maxY + 10;
  };

  // High-precision multi-layer color sampler for Eyedropper tool
  const sampleColorAt = useCallback(
    (pt: { x: number; y: number }) => {
      const clampedX = Math.floor(Math.max(0, Math.min(project.width - 1, pt.x)));
      const clampedY = Math.floor(Math.max(0, Math.min(project.height - 1, pt.y)));

      // Offscreen 1x1 sampler canvas that merges background, lower layers, active layer, and upper layers
      const sampler = document.createElement('canvas');
      sampler.width = 1;
      sampler.height = 1;
      const sCtx = sampler.getContext('2d', { willReadFrequently: true });
      if (!sCtx) return;

      // 1. Draw solid background if not transparent, or white default
      const bg = project.backgroundColor;
      if (bg && bg !== 'transparent') {
        sCtx.fillStyle = bg === 'black' ? '#000000' : bg;
        sCtx.fillRect(0, 0, 1, 1);
      } else {
        // Transparent checkerboard default fallback color
        sCtx.fillStyle = '#FFFFFF';
        sCtx.fillRect(0, 0, 1, 1);
      }

      // 2. Draw lower composite canvas (layers below active layer)
      const compCanvas = compositeCanvasRef.current;
      if (compCanvas) {
        sCtx.drawImage(compCanvas, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
      }

      // 3. Draw active editing canvas (the layer the user is currently working on)
      const actCanvas = activeCanvasRef.current;
      if (actCanvas) {
        sCtx.drawImage(actCanvas, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
      }

      // 4. Draw upper layers canvas (layers above active layer)
      const upCanvas = upperCanvasRef.current;
      if (upCanvas) {
        sCtx.drawImage(upCanvas, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
      }

      const pixel = sCtx.getImageData(0, 0, 1, 1).data;
      const r = pixel[0].toString(16).padStart(2, '0');
      const g = pixel[1].toString(16).padStart(2, '0');
      const b = pixel[2].toString(16).padStart(2, '0');
      const hex = `#${r}${g}${b}`.toUpperCase();

      onColorPick(hex);
    },
    [project.width, project.height, project.backgroundColor, onColorPick]
  );

  // POINTER DOWN HANDLER
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) return; // Ignore drawing while animation is playing

    if (e.button === 1 || activeTool === 'pan' || spaceHeldRef.current || isSpaceHeld) {
      startPanning(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0) return;

    const pt = getCanvasCoordinates(e);

    // Eyedropper is a read-only color picker - operates accurately even on locked layers!
    if (activeTool === 'eyedropper') {
      sampleColorAt(pt);
      setIsDrawing(true);
      return;
    }

    if (isLayerLocked) return;

    if (activeTool === 'select') {
      if (selection.isActive) {
        if (!isInsideSelection(pt)) {
          commitSelection();
          return;
        }
      } else {
        setIsMarqueeSelecting(true);
        setMarqueeStart({ x: pt.x, y: pt.y });
        return;
      }
    }

    lastPointRef.current = pt;
    startPointRef.current = pt;
    strokeBufferRef.current = [pt];
    accumulatedDistRef.current.dist = 0;
    setIsDrawing(true);

    const actCanvas = activeCanvasRef.current;
    if (!actCanvas) return;
    const actCtx = actCanvas.getContext('2d');
    if (!actCtx) return;

    if (activeTool === 'fill') {
      floodFill(
        actCtx,
        pt.x,
        pt.y,
        brushSettings.color,
        brushSettings.opacity,
        brushSettings.tolerance,
        brushSettings.fillBleed || 2
      );
      const newCel = actCanvas.toDataURL('image/png');
      lastCommittedCelRef.current = newCel;
      onCommitCel(newCel);
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'text') {
      setTextInputPos({ x: pt.x, y: pt.y });
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'stamp') {
      const stampSource = getActiveStampSource();
      if (stampSource) {
        setIsDrawing(true);
        strokeBufferRef.current = [pt];
        lastPointRef.current = pt;
        accumulatedDistRef.current.dist = 0;
        const initialRotation = (brushSettings.stampRotation * Math.PI) / 180;
        BrushRenderer.drawSingleStamp(
          actCtx,
          pt.x,
          pt.y,
          initialRotation,
          stampSource,
          brushSettings
        );
        return;
      }
    }

    if (activeTool === 'eraser') {
      BrushRenderer.renderEraser(actCtx, pt, pt, brushSettings);
    } else if (activeTool === 'brush') {
      if (brushSettings.brushStyle === 'image-stamp') {
        const stampSource = getActiveStampSource();
        if (stampSource) {
          accumulatedDistRef.current.dist = 0;
          const initialRotation = (brushSettings.stampRotation * Math.PI) / 180;
          BrushRenderer.drawSingleStamp(
            actCtx,
            pt.x,
            pt.y,
            initialRotation,
            stampSource,
            brushSettings
          );
        }
      } else {
        BrushRenderer.renderSmoothBrush(
          actCtx,
          pt,
          pt,
          { ...pt, x: pt.x + 0.1, y: pt.y + 0.1 },
          brushSettings,
          null,
          accumulatedDistRef.current
        );
      }
    } else if (activeTool === 'pencil') {
      BrushRenderer.renderSmoothPencil(actCtx, pt, pt, { ...pt, x: pt.x + 0.1, y: pt.y + 0.1 }, brushSettings);
    }
  };

  // POINTER MOVE HANDLER
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Update screen coordinates for custom cursor
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (isPanning) return;

    const currentPoint = getCanvasCoordinates(e);

    if (isMarqueeSelecting && marqueeStart) {
      const prevCanvas = previewCanvasRef.current;
      if (!prevCanvas) return;
      const pCtx = prevCanvas.getContext('2d');
      if (!pCtx) return;

      prevCanvas.width = project.width;
      prevCanvas.height = project.height;
      pCtx.clearRect(0, 0, project.width, project.height);

      const mx = Math.min(marqueeStart.x, currentPoint.x);
      const my = Math.min(marqueeStart.y, currentPoint.y);
      const mw = Math.abs(currentPoint.x - marqueeStart.x);
      const mh = Math.abs(currentPoint.y - marqueeStart.y);

      pCtx.save();
      pCtx.strokeStyle = '#000000';
      pCtx.lineWidth = 2;
      pCtx.setLineDash([4, 4]);
      pCtx.strokeRect(mx, my, mw, mh);

      pCtx.strokeStyle = '#FFE600';
      pCtx.lineDashOffset = 4;
      pCtx.strokeRect(mx, my, mw, mh);

      pCtx.fillStyle = 'rgba(255, 230, 0, 0.15)';
      pCtx.fillRect(mx, my, mw, mh);
      pCtx.restore();
      return;
    }

    // Eyedropper real-time drag sampling
    if (activeTool === 'eyedropper') {
      if (isDrawing || e.buttons === 1) {
        sampleColorAt(currentPoint);
      }
      return;
    }

    if (!isDrawing || isLayerLocked) return;

    const actCanvas = activeCanvasRef.current;
    const prevCanvas = previewCanvasRef.current;
    if (!actCanvas || !prevCanvas) return;
    const actCtx = actCanvas.getContext('2d');
    const prevCtx = prevCanvas.getContext('2d');
    if (!actCtx || !prevCtx) return;

    const buf = strokeBufferRef.current;
    buf.push(currentPoint);

    if (
      activeTool === 'stamp' ||
      (activeTool === 'brush' && brushSettings.brushStyle === 'image-stamp')
    ) {
      const stampSource = getActiveStampSource();
      if (stampSource && buf.length >= 3) {
        const p0 = buf[buf.length - 3];
        const p1 = buf[buf.length - 2];
        const p2 = buf[buf.length - 1];
        BrushRenderer.renderStampTrail(
          actCtx,
          p0,
          p1,
          p2,
          brushSettings,
          stampSource,
          accumulatedDistRef.current
        );
      }
      lastPointRef.current = currentPoint;
    } else if (activeTool === 'brush') {
      if (buf.length === 2) {
        const p0 = buf[0];
        const p1 = buf[1];
        const mid = {
          x: (p0.x + p1.x) / 2,
          y: (p0.y + p1.y) / 2,
          pressure: (p0.pressure + p1.pressure) / 2,
        };
        BrushRenderer.renderSmoothBrush(
          actCtx,
          p0,
          p0,
          mid,
          brushSettings,
          null,
          accumulatedDistRef.current
        );
      } else if (buf.length >= 3) {
        const p0 = buf[buf.length - 3];
        const p1 = buf[buf.length - 2];
        const p2 = buf[buf.length - 1];
        BrushRenderer.renderSmoothBrush(
          actCtx,
          p0,
          p1,
          p2,
          brushSettings,
          null,
          accumulatedDistRef.current
        );
      }
      lastPointRef.current = currentPoint;
    } else if (activeTool === 'pencil') {
      if (buf.length === 2) {
        const p0 = buf[0];
        const p1 = buf[1];
        const mid = {
          x: (p0.x + p1.x) / 2,
          y: (p0.y + p1.y) / 2,
          pressure: (p0.pressure + p1.pressure) / 2,
        };
        BrushRenderer.renderSmoothPencil(actCtx, p0, p0, mid, brushSettings);
      } else if (buf.length >= 3) {
        const p0 = buf[buf.length - 3];
        const p1 = buf[buf.length - 2];
        const p2 = buf[buf.length - 1];
        BrushRenderer.renderSmoothPencil(actCtx, p0, p1, p2, brushSettings);
      }
      lastPointRef.current = currentPoint;
    } else if (activeTool === 'eraser') {
      const last = lastPointRef.current || currentPoint;
      BrushRenderer.renderEraser(actCtx, last, currentPoint, brushSettings);
      lastPointRef.current = currentPoint;
    } else if (
      activeTool === 'line' ||
      activeTool === 'rect' ||
      activeTool === 'ellipse' ||
      activeTool === 'arrow'
    ) {
      prevCanvas.width = project.width;
      prevCanvas.height = project.height;
      prevCtx.clearRect(0, 0, project.width, project.height);

      const start = startPointRef.current || currentPoint;
      let endX = currentPoint.x;
      let endY = currentPoint.y;

      if (e.shiftKey) {
        if (currentShapeType === 'rect' || currentShapeType === 'ellipse') {
          const side = Math.max(Math.abs(endX - start.x), Math.abs(endY - start.y));
          endX = start.x + (endX >= start.x ? side : -side);
          endY = start.y + (endY >= start.y ? side : -side);
        } else if (currentShapeType === 'line' || currentShapeType === 'arrow') {
          const dx = endX - start.x;
          const dy = endY - start.y;
          const angle = Math.atan2(dy, dx);
          const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const dist = Math.hypot(dx, dy);
          endX = start.x + dist * Math.cos(snapAngle);
          endY = start.y + dist * Math.sin(snapAngle);
        }
      }

      prevCtx.save();
      prevCtx.strokeStyle = brushSettings.color;
      prevCtx.fillStyle = brushSettings.color;
      prevCtx.lineWidth = brushSettings.size;
      prevCtx.globalAlpha = brushSettings.opacity;
      prevCtx.lineCap = 'round';

      if (currentShapeType === 'line') {
        prevCtx.beginPath();
        prevCtx.moveTo(start.x, start.y);
        prevCtx.lineTo(endX, endY);
        prevCtx.stroke();
      } else if (currentShapeType === 'rect') {
        const x = Math.min(start.x, endX);
        const y = Math.min(start.y, endY);
        const w = Math.abs(endX - start.x);
        const h = Math.abs(endY - start.y);
        prevCtx.strokeRect(x, y, w, h);
      } else if (currentShapeType === 'ellipse') {
        const cx = (start.x + endX) / 2;
        const cy = (start.y + endY) / 2;
        const rx = Math.abs(endX - start.x) / 2;
        const ry = Math.abs(endY - start.y) / 2;
        prevCtx.beginPath();
        prevCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        prevCtx.stroke();
      } else if (currentShapeType === 'arrow') {
        prevCtx.beginPath();
        prevCtx.moveTo(start.x, start.y);
        prevCtx.lineTo(endX, endY);
        prevCtx.stroke();

        const headLen = Math.max(12, brushSettings.size * 3);
        const angle = Math.atan2(endY - start.y, endX - start.x);
        prevCtx.beginPath();
        prevCtx.moveTo(endX, endY);
        prevCtx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        prevCtx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        prevCtx.closePath();
        prevCtx.fill();
      }
      prevCtx.restore();
    }
  };

  // POINTER UP HANDLER
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'eyedropper') {
      setIsDrawing(false);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isMarqueeSelecting && marqueeStart) {
      setIsMarqueeSelecting(false);
      const pt = getCanvasCoordinates(e);
      const sx = Math.min(marqueeStart.x, pt.x);
      const sy = Math.min(marqueeStart.y, pt.y);
      const sw = Math.abs(pt.x - marqueeStart.x);
      const sh = Math.abs(pt.y - marqueeStart.y);

      setMarqueeStart(null);

      const prevCanvas = previewCanvasRef.current;
      if (prevCanvas) {
        const pCtx = prevCanvas.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, project.width, project.height);
      }

      if (sw > 4 && sh > 4) {
        const actCanvas = activeCanvasRef.current;
        if (!actCanvas) return;
        const actCtx = actCanvas.getContext('2d');
        if (!actCtx) return;

        const offscreen = document.createElement('canvas');
        offscreen.width = Math.round(sw);
        offscreen.height = Math.round(sh);
        const oCtx = offscreen.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(actCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          actCtx.clearRect(sx, sy, sw, sh);

          setSelection({
            isActive: true,
            x: Math.round(sx),
            y: Math.round(sy),
            width: Math.round(sw),
            height: Math.round(sh),
            rotation: 0,
            sourceCanvas: offscreen,
            originalX: Math.round(sx),
            originalY: Math.round(sy),
            originalWidth: Math.round(sw),
            originalHeight: Math.round(sh),
          });
        }
      }
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    const actCanvas = activeCanvasRef.current;
    const prevCanvas = previewCanvasRef.current;
    if (!actCanvas || !prevCanvas) return;
    const actCtx = actCanvas.getContext('2d');
    const prevCtx = prevCanvas.getContext('2d');
    if (!actCtx || !prevCtx) return;

    const buf = strokeBufferRef.current;
    if (buf.length >= 2) {
      const p1 = buf[buf.length - 2];
      const p2 = buf[buf.length - 1];
      if (
        activeTool === 'stamp' ||
        (activeTool === 'brush' && brushSettings.brushStyle === 'image-stamp')
      ) {
        const stampSource = getActiveStampSource();
        if (stampSource) {
          BrushRenderer.renderStampTrail(
            actCtx,
            p1,
            p2,
            p2,
            brushSettings,
            stampSource,
            accumulatedDistRef.current
          );
        }
      } else if (activeTool === 'brush') {
        BrushRenderer.renderSmoothBrush(
          actCtx,
          p1,
          p2,
          p2,
          brushSettings,
          null,
          accumulatedDistRef.current
        );
      } else if (activeTool === 'pencil') {
        BrushRenderer.renderSmoothPencil(actCtx, p1, p2, p2, brushSettings);
      }
    }

    if (
      activeTool === 'line' ||
      activeTool === 'rect' ||
      activeTool === 'ellipse' ||
      activeTool === 'arrow'
    ) {
      actCtx.drawImage(prevCanvas, 0, 0);
      prevCtx.clearRect(0, 0, project.width, project.height);
    }

    const newCelUrl = actCanvas.toDataURL('image/png');
    lastCommittedCelRef.current = newCelUrl;
    onCommitCel(newCelUrl);
  };

  // HANDLE TRANSFORM DRAG
  const handleTransformPointerDown = (handle: TransformHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    transformStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      selX: selection.x,
      selY: selection.y,
      selW: selection.width,
      selH: selection.height,
      selRot: selection.rotation,
    };
  };

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!activeHandle || !selection.isActive) return;

      const deltaScreenX = e.clientX - transformStartRef.current.clientX;
      const deltaScreenY = e.clientY - transformStartRef.current.clientY;

      const deltaX = deltaScreenX / transform.zoom;
      const deltaY = deltaScreenY / transform.zoom;

      const { selX, selY, selW, selH } = transformStartRef.current;

      if (activeHandle === 'move') {
        setSelection((prev) => ({
          ...prev,
          x: Math.round(selX + deltaX),
          y: Math.round(selY + deltaY),
        }));
      } else if (activeHandle === 'rotate') {
        const cx = selX + selW / 2;
        const cy = selY + selH / 2;
        const canvasPt = getCanvasCoordinates(e);
        const angleRad = Math.atan2(canvasPt.y - cy, canvasPt.x - cx);
        const angleDeg = Math.round((angleRad * 180) / Math.PI) - 90;
        setSelection((prev) => ({
          ...prev,
          rotation: (angleDeg + 360) % 360,
        }));
      } else {
        let newX = selX;
        let newY = selY;
        let newW = selW;
        let newH = selH;

        if (activeHandle.includes('e')) newW = Math.max(10, selW + deltaX);
        if (activeHandle.includes('s')) newH = Math.max(10, selH + deltaY);
        if (activeHandle.includes('w')) {
          const clampedDeltaX = Math.min(selW - 10, deltaX);
          newX = selX + clampedDeltaX;
          newW = selW - clampedDeltaX;
        }
        if (activeHandle.includes('n')) {
          const clampedDeltaY = Math.min(selH - 10, deltaY);
          newY = selY + clampedDeltaY;
          newH = selH - clampedDeltaY;
        }

        setSelection((prev) => ({
          ...prev,
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        }));
      }
    };

    const handleWindowPointerUp = () => {
      if (activeHandle) {
        setActiveHandle(null);
      }
    };

    if (activeHandle) {
      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', handleWindowPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [activeHandle, selection.isActive, transform.zoom, getCanvasCoordinates]);

  // Commit text
  const handleCommitText = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      setTextInputValue('');
      return;
    }
    const actCanvas = activeCanvasRef.current;
    if (!actCanvas) return;
    const ctx = actCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = brushSettings.color;
    ctx.globalAlpha = brushSettings.opacity;
    const styleStr = `${brushSettings.fontItalic ? 'italic ' : ''}${
      brushSettings.fontBold ? 'bold ' : ''
    }${brushSettings.fontSize}px ${brushSettings.fontFamily || 'Plus Jakarta Sans'}`;
    ctx.font = styleStr;
    ctx.fillText(textInputValue, textInputPos.x, textInputPos.y);
    ctx.restore();

    const newCelUrl = actCanvas.toDataURL('image/png');
    lastCommittedCelRef.current = newCelUrl;
    onCommitCel(newCelUrl);
    setTextInputPos(null);
    setTextInputValue('');
  };

  const handleZoom = (delta: number) => {
    setTransform((prev) => {
      const cur = prev.zoom;
      let nextZoom: number;

      if (delta > 0) {
        // Zoom in: find next step higher than current zoom
        const nextStep = ZOOM_STEPS.find((s) => s > cur + 0.01);
        nextZoom = nextStep !== undefined ? nextStep : Math.min(16.0, cur + 1.0);
      } else {
        // Zoom out: find step immediately lower than current zoom
        const prevSteps = ZOOM_STEPS.filter((s) => s < cur - 0.01);
        nextZoom = prevSteps.length > 0 ? prevSteps[prevSteps.length - 1] : Math.max(0.1, cur - 0.1);
      }

      nextZoom = Math.min(16.0, Math.max(0.1, nextZoom));
      return { ...prev, zoom: Number(nextZoom.toFixed(2)) };
    });
  };

  const handleResetZoom = () => {
    setTransform({ zoom: 1, panX: 0, panY: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setTransform((prev) => {
        const nextZoom = Math.min(16.0, Math.max(0.1, prev.zoom * zoomFactor));
        return { ...prev, zoom: Number(nextZoom.toFixed(2)) };
      });
    }
  };

  const viewportCursor = isPanning
    ? 'grabbing'
    : activeTool === 'pan' || isSpaceHeld
    ? 'grab'
    : STAR_CURSOR;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerEnter={() => setIsHoveringCanvas(true)}
      onPointerLeave={() => {
        setIsHoveringCanvas(false);
        if (document.body) {
          document.body.style.cursor = 'default';
        }
      }}
      onPointerMove={(e) => {
        if (activeTool === 'pan' || isSpaceHeld) {
          setCursorPos({ x: e.clientX, y: e.clientY });
        }
      }}
      onPointerDown={(e) => {
        if (e.button === 1 || activeTool === 'pan' || spaceHeldRef.current || isSpaceHeld) {
          startPanning(e.clientX, e.clientY);
        }
      }}
      className="relative flex-1 h-full overflow-hidden dotted-workspace flex items-center justify-center select-none"
      style={{
        cursor: viewportCursor,
      }}
    >
      {/* Floating Top-Left Zoom & Pan Controls */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 brutal-panel-sm p-1 bg-white">
        <button
          onClick={() => handleZoom(-1)}
          className="brutal-btn w-8 h-8 bg-white hover:bg-neutral-100 text-black text-sm font-black"
          title="Zoom Out (-)"
        >
          -
        </button>
        <span className="px-2 text-xs font-black min-w-16 text-center tabular-nums">
          {Math.round(transform.zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoom(1)}
          className="brutal-btn w-8 h-8 bg-white hover:bg-neutral-100 text-black text-sm font-black"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={handleResetZoom}
          className="brutal-btn px-2.5 h-8 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider"
          title="Reset Zoom & Pan (100%)"
        >
          RESET
        </button>

        <div className="h-5 w-[2px] bg-black/20 mx-0.5" />

        {/* Dedicated Hand Tool Button */}
        <button
          onClick={() => {
            if (setActiveTool) {
              setActiveTool(activeTool === 'pan' ? 'brush' : 'pan');
            }
          }}
          className={`brutal-btn w-8 h-8 text-black flex items-center justify-center transition-all ${
            activeTool === 'pan'
              ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
              : 'bg-white hover:bg-neutral-100'
          }`}
          title="Hand Tool (Pan / Move Canvas) - Shortcut H"
        >
          <Hand className="w-4 h-4 text-black stroke-[2.5]" />
        </button>
      </div>

      {/* Floating Top-Right Onion Skin Controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <div className="relative">
          <div className="brutal-panel-sm flex items-center gap-2 px-3 py-1.5 bg-white">
            <input
              type="checkbox"
              id="onionSkinToggle"
              checked={project.onionSkin.enabled}
              onChange={(e) =>
                onUpdateOnionSkin({
                  ...project.onionSkin,
                  enabled: e.target.checked,
                })
              }
              className="w-4 h-4 accent-black cursor-pointer border-2 border-black"
            />
            <label
              htmlFor="onionSkinToggle"
              className="text-xs font-extrabold cursor-pointer tracking-wider select-none uppercase"
            >
              ONION SKIN
            </label>
            <button
              onClick={() => setShowOnionSkinMenu(!showOnionSkinMenu)}
              className="p-1 hover:bg-neutral-200 border border-black"
              title="Onion Skin Settings"
            >
              <Settings2 size={14} />
            </button>
          </div>

          {showOnionSkinMenu && (
            <div className="absolute right-0 mt-2 w-56 brutal-panel p-3 bg-white z-40">
              <div className="text-xs font-black uppercase mb-2 border-b-2 border-black pb-1">
                Onion Skin Config
              </div>
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Past Frames:</span>
                    <span>{project.onionSkin.prevFrames}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={project.onionSkin.prevFrames}
                    onChange={(e) =>
                      onUpdateOnionSkin({
                        ...project.onionSkin,
                        prevFrames: Number(e.target.value),
                      })
                    }
                    className="w-full brutal-slider"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Next Frames:</span>
                    <span>{project.onionSkin.nextFrames}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={project.onionSkin.nextFrames}
                    onChange={(e) =>
                      onUpdateOnionSkin({
                        ...project.onionSkin,
                        nextFrames: Number(e.target.value),
                      })
                    }
                    className="w-full brutal-slider"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Opacity:</span>
                    <span>{Math.round(project.onionSkin.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={project.onionSkin.opacity * 100}
                    onChange={(e) =>
                      onUpdateOnionSkin({
                        ...project.onionSkin,
                        opacity: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full brutal-slider"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Viewport Container with Pan & Zoom Transform (Zero Friction) */}
      <div
        ref={canvasFrameRef}
        className="will-change-transform"
        style={{
          transform: `translate3d(${transform.panX}px, ${transform.panY}px, 0px) scale(${transform.zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          className={`relative border-3 border-black shadow-[6px_6px_0px_#000] ${
            project.backgroundColor === 'transparent' ? 'checkerboard' : 'bg-white'
          }`}
          style={{
            width: project.width,
            height: project.height,
          }}
        >
          {/* Layer 1: Lower Composite canvas (renders layers below active layer, or all layers during playback) */}
          <canvas
            ref={compositeCanvasRef}
            width={project.width}
            height={project.height}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ imageRendering: transform.zoom >= 2.0 ? 'pixelated' : 'auto' }}
          />

          {/* Layer 2: Active Layer Cel Canvas (interacted with during drawing) */}
          <canvas
            ref={activeCanvasRef}
            width={project.width}
            height={project.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute top-0 left-0 touch-none ${
              isLayerLocked ? 'cursor-not-allowed' : ''
            }`}
            style={{
              cursor: isLayerLocked ? 'not-allowed' : viewportCursor,
              imageRendering: transform.zoom >= 2.0 ? 'pixelated' : 'auto',
            }}
          />

          {/* Layer 3: Upper canvas (renders visible layers strictly above active layer) */}
          <canvas
            ref={upperCanvasRef}
            width={project.width}
            height={project.height}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ imageRendering: transform.zoom >= 2.0 ? 'pixelated' : 'auto' }}
          />

          {/* Layer 4: Preview canvas for shapes & live transformed selection */}
          <canvas
            ref={previewCanvasRef}
            width={project.width}
            height={project.height}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ imageRendering: transform.zoom >= 2.0 ? 'pixelated' : 'auto' }}
          />

          {/* ACTIVE SELECTION BOUNDING BOX & TRANSFORM HANDLES */}
          {selection.isActive && (
            <div
              className="absolute pointer-events-auto"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.width,
                height: selection.height,
                transform: `rotate(${selection.rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <div
                onPointerDown={(e) => handleTransformPointerDown('move', e)}
                className="absolute inset-0 border-2 border-dashed border-black shadow-[0_0_0_1px_#FFE600] cursor-grab active:cursor-grabbing bg-black/5"
                title="Drag to move selection"
              />

              {/* Rotation Handle */}
              <div
                className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-alias"
                onPointerDown={(e) => handleTransformPointerDown('rotate', e)}
                title="Drag to rotate"
              >
                <div className="w-4 h-4 rounded-full bg-[#00E5F0] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] hover:scale-110">
                  <RotateCw size={10} className="text-black" />
                </div>
                <div className="w-0.5 h-3 bg-black" />
              </div>

              {/* 8 Scale Handles */}
              <div
                onPointerDown={(e) => handleTransformPointerDown('nw', e)}
                className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-nwse-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('n', e)}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-ns-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('ne', e)}
                className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-nesw-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('e', e)}
                className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-ew-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('se', e)}
                className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-nwse-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('s', e)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-ns-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('sw', e)}
                className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-nesw-resize hover:scale-125"
              />
              <div
                onPointerDown={(e) => handleTransformPointerDown('w', e)}
                className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000] cursor-ew-resize hover:scale-125"
              />

              {/* Floating Quick Action Pill */}
              <div
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border-2 border-black p-1 shadow-[3px_3px_0px_#000] z-50 whitespace-nowrap"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={commitSelection}
                  className="brutal-btn px-2 py-0.5 bg-[#86EFAC] text-black text-[10px] font-black uppercase flex items-center gap-1 shadow-none"
                  title="Apply / Commit selection (Enter)"
                >
                  <Check size={12} className="stroke-[3]" />
                  <span>COMMIT</span>
                </button>
                <button
                  onClick={resetSelection}
                  className="brutal-btn px-1.5 py-0.5 bg-neutral-100 text-black text-[10px] font-black shadow-none"
                  title="Reset transform (Esc)"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onClick={deleteSelection}
                  className="brutal-btn px-1.5 py-0.5 bg-[#FF5F38] text-white text-[10px] font-black shadow-none"
                  title="Delete selected pixels (Delete / Backspace)"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Text Tool Floating Inline Input */}
          {textInputPos && (
            <div
              className="absolute z-50 brutal-panel p-2 flex flex-col gap-1.5"
              style={{
                left: Math.min(project.width - 200, Math.max(0, textInputPos.x)),
                top: Math.min(project.height - 80, Math.max(0, textInputPos.y - 40)),
              }}
            >
              <input
                autoFocus
                type="text"
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitText();
                  if (e.key === 'Escape') setTextInputPos(null);
                }}
                placeholder="Type text & press Enter"
                className="border-2 border-black px-2 py-1 text-xs font-bold outline-none"
              />
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setTextInputPos(null)}
                  className="brutal-btn px-2 py-0.5 text-[10px] bg-red-400 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommitText}
                  className="brutal-btn px-2 py-0.5 text-[10px] bg-emerald-400 text-black"
                >
                  Place
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hand / Pan Tool Tactical Grabber Icon (Untouched by star cursor) */}
      {(activeTool === 'pan' || isSpaceHeld) && isHoveringCanvas && cursorPos && !isPlaying && (
        <div
          className="fixed pointer-events-none z-[9999] -translate-x-1 -translate-y-2 select-none"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
          }}
        >
          <div className="p-1.5 bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
            <Hand size={18} className="text-black stroke-[2.5]" />
          </div>
        </div>
      )}

      {/* Layer Locked Warning Banner */}
      {isLayerLocked && !isPlaying && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 brutal-panel bg-[#FF5F38] text-white px-4 py-1.5 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 pointer-events-none">
          Active Layer is Locked (Unlock in Layers Panel to Draw)
        </div>
      )}
    </div>
  );
};
