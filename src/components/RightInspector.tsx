import React, { useRef } from 'react';
import {
  Sliders,
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Headphones,
  Music,
  X,
  Upload,
  Paintbrush,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Project, BrushSettings, ToolType, BrushStyle, PencilTexture } from '../types';

interface RightInspectorProps {
  project: Project;
  activeTool: ToolType;
  onSelectTool?: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onAddLayer: () => void;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onReorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  onUpdateLayerOpacity: (layerId: string, opacity: number) => void;
  onLoadAudioFile: (file: File) => void;
  onRemoveAudio: () => void;
  onAddStamp: (file: File) => void;
}

const BRUSH_STYLES: { id: BrushStyle; name: string }[] = [
  { id: 'solid-round', name: 'Solid Round' },
  { id: 'flat-marker', name: 'Flat Marker' },
  { id: 'calligraphy', name: 'Calligraphy' },
  { id: 'airbrush', name: 'Soft Airbrush' },
  { id: 'image-stamp', name: 'Custom Stamp' },
];

const PENCIL_TEXTURES: { id: PencilTexture; name: string }[] = [
  { id: 'soft-2b', name: 'Soft 2B' },
  { id: 'hard-4h', name: 'Hard 4H' },
  { id: 'colored-pencil', name: 'Colored Pencil' },
  { id: 'charcoal', name: 'Charcoal' },
];

export const RightInspector: React.FC<RightInspectorProps> = ({
  project,
  activeTool,
  onSelectTool,
  brushSettings,
  setBrushSettings,
  onAddLayer,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onDuplicateLayer,
  onDeleteLayer,
  onRenameLayer,
  onReorderLayer,
  onUpdateLayerOpacity,
  onLoadAudioFile,
  onRemoveAudio,
  onAddStamp,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const activeLayer = project.layers.find((l) => l.id === project.activeLayerId);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadAudioFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleStampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddStamp(e.target.files[0]);
    }
    e.target.value = '';
  };

  return (
    <aside className="w-80 bg-white border-l-3 border-black flex flex-col h-full shrink-0 select-none overflow-y-auto p-3 gap-3">
      {/* Hidden File Inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
        className="hidden"
        onChange={handleAudioChange}
      />
      <input
        ref={stampInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleStampChange}
      />

      {/* 1. BRUSH & TOOL OPTIONS PANEL */}
      <div className="brutal-panel p-3 bg-white">
        <div className="flex items-center gap-2 mb-3 pb-1 border-b-2 border-black">
          <Sliders className="w-4 h-4 stroke-[2.5]" />
          <span className="text-xs font-black uppercase tracking-wider">
            {activeTool === 'text'
              ? 'TEXT OPTIONS'
              : activeTool === 'fill'
              ? 'BUCKET OPTIONS'
              : activeTool === 'stamp'
              ? 'STAMP OPTIONS'
              : activeTool === 'pencil'
              ? 'PENCIL TEXTURES'
              : 'BRUSH OPTIONS'}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Preset selector for Brush */}
          {activeTool === 'brush' && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                BRUSH STYLE
              </span>
              <div className="grid grid-cols-2 gap-1">
                {BRUSH_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, brushStyle: style.id }))
                    }
                    className={`p-1.5 border-2 border-black text-[11px] font-black text-left truncate transition-colors ${
                      brushSettings.brushStyle === style.id
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
                        : 'bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset selector for Pencil */}
          {activeTool === 'pencil' && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                PENCIL TEXTURE
              </span>
              <div className="grid grid-cols-2 gap-1">
                {PENCIL_TEXTURES.map((tex) => (
                  <button
                    key={tex.id}
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, pencilTexture: tex.id }))
                    }
                    className={`p-1.5 border-2 border-black text-[11px] font-black text-left truncate transition-colors ${
                      brushSettings.pencilTexture === tex.id
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
                        : 'bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    {tex.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Image Stamp Brush specific settings */}
          {(activeTool === 'stamp' || (activeTool === 'brush' && brushSettings.brushStyle === 'image-stamp')) && (
            <div className="pt-2 border-t-2 border-black space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase">BRUSH TIP STAMP</span>
                <button
                  onClick={() => stampInputRef.current?.click()}
                  className="brutal-btn px-2 py-0.5 text-[10px] bg-[#00E5F0] flex items-center gap-1 shadow-none"
                >
                  <Upload size={12} /> + UPLOAD TIP
                </button>
              </div>

              {/* Stamp library thumbnails */}
              <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-neutral-50 border-2 border-black">
                {project.stamps.map((stamp) => {
                  const isSelected =
                    (brushSettings.selectedStampId || project.stamps[0]?.id) === stamp.id;
                  return (
                    <button
                      key={stamp.id}
                      onClick={() =>
                        setBrushSettings((prev) => ({
                          ...prev,
                          selectedStampId: stamp.id,
                        }))
                      }
                      className={`aspect-square p-1 border-2 border-black flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000] scale-105'
                          : 'bg-white hover:bg-neutral-100'
                      }`}
                      title={stamp.name}
                    >
                      <img
                        src={stamp.dataUrl}
                        alt={stamp.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                  );
                })}
                {project.stamps.length === 0 && (
                  <div className="col-span-4 text-center py-2 text-[10px] text-neutral-500 font-bold">
                    No custom tips. Click + UPLOAD TIP.
                  </div>
                )}
              </div>

              {/* Stamp Size slider */}
              <div>
                <div className="flex justify-between font-black mb-1 text-[11px]">
                  <span>STAMP SCALE</span>
                  <span className="tabular-nums">{brushSettings.stampSize}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="256"
                  value={brushSettings.stampSize}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      stampSize: Number(e.target.value),
                    }))
                  }
                  className="w-full brutal-slider"
                />
              </div>

              {/* Stamp Spacing slider */}
              <div>
                <div className="flex justify-between font-black mb-1 text-[11px]">
                  <span>STAMP SPACING</span>
                  <span className="tabular-nums">{brushSettings.stampSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="120"
                  value={brushSettings.stampSpacing}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      stampSpacing: Number(e.target.value),
                    }))
                  }
                  className="w-full brutal-slider"
                />
              </div>

              {/* Stamp Angle / Rotation Slider */}
              <div>
                <div className="flex justify-between font-black mb-1 text-[11px]">
                  <span>STAMP ANGLE</span>
                  <span className="tabular-nums">{brushSettings.stampRotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={brushSettings.stampRotation}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      stampRotation: Number(e.target.value),
                    }))
                  }
                  className="w-full brutal-slider"
                />
              </div>

              {/* Modulation Toggles */}
              <div className="space-y-1.5 pt-1">
                {/* Dynamic Path Rotation */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dynRotToggle"
                    checked={brushSettings.stampDynamicRotation}
                    onChange={(e) =>
                      setBrushSettings((prev) => ({
                        ...prev,
                        stampDynamicRotation: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 accent-black border-2 border-black cursor-pointer"
                  />
                  <label htmlFor="dynRotToggle" className="text-[11px] font-black cursor-pointer">
                    Rotate along stroke path (Dynamic)
                  </label>
                </div>

                {/* Color Tinting Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tintToggle"
                    checked={!!brushSettings.stampTintWithColor}
                    onChange={(e) =>
                      setBrushSettings((prev) => ({
                        ...prev,
                        stampTintWithColor: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 accent-black border-2 border-black cursor-pointer"
                  />
                  <label htmlFor="tintToggle" className="text-[11px] font-black cursor-pointer flex items-center gap-1.5">
                    <span>Tint with active color</span>
                    <span
                      className="inline-block w-3 h-3 border border-black shadow-[1px_1px_0px_#000]"
                      style={{ backgroundColor: brushSettings.color }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Size Slider (Hidden for dedicated Stamp tool since Stamp Scale is above) */}
          {activeTool !== 'stamp' && (
            <div>
              <div className="flex justify-between font-black mb-1">
                <span className="uppercase">SIZE</span>
                <span className="tabular-nums">{brushSettings.size}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={brushSettings.size}
                onChange={(e) =>
                  setBrushSettings((prev) => ({ ...prev, size: Number(e.target.value) }))
                }
                className="w-full brutal-slider"
              />
            </div>
          )}

          {/* Opacity Slider */}
          <div>
            <div className="flex justify-between font-black mb-1">
              <span className="uppercase">OPACITY</span>
              <span className="tabular-nums">
                {Math.round(brushSettings.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={Math.round(brushSettings.opacity * 100)}
              onChange={(e) =>
                setBrushSettings((prev) => ({
                  ...prev,
                  opacity: Number(e.target.value) / 100,
                }))
              }
              className="w-full brutal-slider"
            />
          </div>

          {/* Eraser Options */}
          {activeTool === 'eraser' && (
            <div className="pt-2 border-t-2 border-black space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                  ERASER SHAPE
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['round', 'square', 'chisel'] as const).map((shape) => (
                    <button
                      key={shape}
                      onClick={() =>
                        setBrushSettings((prev) => ({ ...prev, eraserShape: shape }))
                      }
                      className={`p-1.5 border-2 border-black text-[11px] font-black uppercase transition-colors ${
                        brushSettings.eraserShape === shape
                          ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
                          : 'bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between font-black mb-1 text-[11px]">
                  <span>EDGE FEATHERING / SOFTNESS</span>
                  <span className="tabular-nums">
                    {Math.round(brushSettings.eraserSoftness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(brushSettings.eraserSoftness * 100)}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      eraserSoftness: Number(e.target.value) / 100,
                    }))
                  }
                  className="w-full brutal-slider"
                />
                <div className="flex justify-between text-[9px] font-bold text-neutral-500 mt-0.5">
                  <span>CRISP (HARD PIXEL)</span>
                  <span>FEATHERED (SOFT)</span>
                </div>
              </div>
            </div>
          )}

          {/* Fill tolerance and Bleed Expansion */}
          {activeTool === 'fill' && (
            <div className="pt-2 border-t-2 border-black space-y-3">
              <div>
                <div className="flex justify-between font-black mb-1">
                  <span className="uppercase">COLOR TOLERANCE</span>
                  <span className="tabular-nums">{brushSettings.tolerance}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={brushSettings.tolerance}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      tolerance: Number(e.target.value),
                    }))
                  }
                  className="w-full brutal-slider"
                />
              </div>

              <div>
                <div className="flex justify-between font-black mb-1">
                  <span className="uppercase">OUTLINE BLEED / EXPAND</span>
                  <span className="tabular-nums">+{brushSettings.fillBleed}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={brushSettings.fillBleed}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      fillBleed: Number(e.target.value),
                    }))
                  }
                  className="w-full brutal-slider"
                />
                <div className="text-[10px] text-neutral-600 font-bold mt-1">
                  Pushes filled pixels under lines to eliminate anti-aliased edge gaps.
                </div>
              </div>
            </div>
          )}

          {/* Shape Selection options */}
          {(activeTool === 'line' ||
            activeTool === 'rect' ||
            activeTool === 'ellipse' ||
            activeTool === 'arrow') && (
            <div className="pt-2 border-t-2 border-black space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                GEOMETRIC SHAPE
              </span>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { id: 'line', name: 'Straight Line' },
                    { id: 'rect', name: 'Rectangle' },
                    { id: 'ellipse', name: 'Circle/Ellipse' },
                    { id: 'arrow', name: 'Arrow' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setBrushSettings((prev) => ({ ...prev, activeShape: s.id }));
                      onSelectTool?.(s.id);
                    }}
                    className={`p-1.5 border-2 border-black text-[11px] font-black uppercase transition-colors ${
                      brushSettings.activeShape === s.id
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
                        : 'bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text options */}
          {activeTool === 'text' && (
            <div className="pt-2 border-t border-black space-y-2">
              <div>
                <span className="font-bold block mb-1">FONT SIZE</span>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={brushSettings.fontSize}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      fontSize: Number(e.target.value),
                    }))
                  }
                  className="w-full border-2 border-black p-1 text-xs font-bold"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      fontBold: !prev.fontBold,
                    }))
                  }
                  className={`brutal-btn flex-1 py-1 text-xs font-black ${
                    brushSettings.fontBold ? 'bg-[#FFE600]' : 'bg-neutral-100'
                  }`}
                >
                  BOLD
                </button>
                <button
                  onClick={() =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      fontItalic: !prev.fontItalic,
                    }))
                  }
                  className={`brutal-btn flex-1 py-1 text-xs font-black italic ${
                    brushSettings.fontItalic ? 'bg-[#FFE600]' : 'bg-neutral-100'
                  }`}
                >
                  ITALIC
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. LAYERS PANEL */}
      <div className="brutal-panel p-3 bg-white flex-1 flex flex-col min-h-56">
        <div className="flex items-center justify-between mb-3 pb-1 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-black uppercase tracking-wider">LAYERS</span>
          </div>
          <button
            onClick={onAddLayer}
            className="brutal-btn w-6 h-6 bg-white hover:bg-neutral-100"
            title="Add New Layer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Layer items list */}
        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
          {project.layers
            .slice()
            .reverse()
            .map((layer) => {
              const isActive = layer.id === project.activeLayerId;
              const originalIndex = project.layers.findIndex((l) => l.id === layer.id);
              const canMoveUp = originalIndex < project.layers.length - 1;
              const canMoveDown = originalIndex > 0;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`border-3 border-black p-1.5 flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#FFE600] shadow-[3px_3px_0px_#000]'
                      : 'bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {/* Layer Reordering buttons (Move Up / Move Down in stack) */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={!canMoveUp}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderLayer(layer.id, 'up');
                        }}
                        className={`p-0.5 border border-black rounded-none ${
                          canMoveUp
                            ? 'hover:bg-black/10 active:bg-black/20 text-black'
                            : 'opacity-25 cursor-not-allowed text-neutral-400'
                        }`}
                        title="Move Layer Up (Bring Forward)"
                      >
                        <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
                      </button>
                      <button
                        disabled={!canMoveDown}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderLayer(layer.id, 'down');
                        }}
                        className={`p-0.5 border border-black rounded-none ${
                          canMoveDown
                            ? 'hover:bg-black/10 active:bg-black/20 text-black'
                            : 'opacity-25 cursor-not-allowed text-neutral-400'
                        }`}
                        title="Move Layer Down (Send Backward)"
                      >
                        <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLayerVisibility(layer.id);
                      }}
                      className="p-1 hover:bg-black/10 rounded-none"
                      title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-neutral-400 stroke-[2.5]" />
                      )}
                    </button>

                    {/* Layer Name with Lock protection */}
                    {layer.locked ? (
                      <div
                        className="flex items-center gap-1 min-w-0 flex-1 cursor-not-allowed select-none py-0.5"
                        title="Layer is locked. Unlock to rename or edit."
                      >
                        <Lock className="w-3 h-3 text-red-600 shrink-0 stroke-[2.5]" />
                        <span className="font-black text-xs text-neutral-600 truncate line-through">
                          {layer.name}
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={layer.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRenameLayer(layer.id, e.target.value)}
                        className="font-black text-xs bg-transparent border-b border-transparent hover:border-black focus:border-black outline-none w-full truncate"
                        title="Click to rename layer"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLayerLock(layer.id);
                      }}
                      className="p-1 hover:bg-black/10 rounded-none"
                      title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                    >
                      {layer.locked ? (
                        <Lock className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-black/50 stroke-[2.5]" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateLayer(layer.id);
                      }}
                      className="p-1 hover:bg-black/10 rounded-none"
                      title="Duplicate Layer"
                    >
                      <Copy className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                    </button>

                    {project.layers.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLayer(layer.id);
                        }}
                        className="p-1 hover:bg-red-500 hover:text-white rounded-none"
                        title="Delete Layer"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Selected Layer Opacity */}
        {activeLayer && (
          <div className="mt-2 pt-2 border-t border-black text-xs">
            <div className="flex justify-between font-bold mb-1">
              <span>LAYER OPACITY</span>
              <span className="tabular-nums">
                {Math.round((activeLayer.opacity ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round((activeLayer.opacity ?? 1.0) * 100)}
              onChange={(e) =>
                onUpdateLayerOpacity(activeLayer.id, Number(e.target.value) / 100)
              }
              className="w-full brutal-slider"
            />
          </div>
        )}
      </div>

      {/* 3. AUDIO SYNC PANEL */}
      <div className="brutal-panel p-3 bg-[#F0FDF4]">
        <div className="flex items-center gap-2 mb-2 pb-1 border-b-2 border-black">
          <Headphones className="w-4 h-4 stroke-[2.5]" />
          <span className="text-xs font-black uppercase tracking-wider">AUDIO SYNC</span>
        </div>

        {!project.audioTrack ? (
          <button
            onClick={() => audioInputRef.current?.click()}
            className="w-full brutal-btn py-2 bg-white hover:bg-neutral-50 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000]"
          >
            <Headphones className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>LOAD AUDIO TRACK</span>
          </button>
        ) : (
          <div className="space-y-2 bg-white border-2 border-black p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                <Music className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span className="text-xs font-black truncate">
                  {project.audioTrack.name}
                </span>
              </div>
              <button
                onClick={onRemoveAudio}
                className="p-1 hover:bg-red-100 text-red-600 rounded-none border border-black"
                title="Remove Audio Track"
              >
                <X size={14} />
              </button>
            </div>

            {/* Waveform Visualization Bars */}
            <div className="h-8 bg-neutral-100 border border-black flex items-center gap-[1px] px-1 overflow-hidden">
              {project.audioTrack.peaks.map((peak, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-[#2DD4BF] rounded-none"
                  style={{
                    height: `${Math.max(10, peak * 100)}%`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-neutral-600">
              <span>Duration: {project.audioTrack.duration.toFixed(1)}s</span>
              <span>Synced with timeline</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
