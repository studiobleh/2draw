import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Brush,
  Pencil,
  Eraser,
  PaintBucket,
  Stamp,
  Minus,
  Square,
  Circle,
  MoveUpRight,
  Type,
  Hand,
  Pipette,
  Check,
  Upload,
  X,
  Sparkles,
  Shapes,
} from 'lucide-react';
import { ToolType, BrushSettings, BrushStyle, PencilTexture, StampAsset, ShapeType } from '../types';

interface LeftToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  currentColor: string;
  onOpenColorPicker: () => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  stamps: StampAsset[];
  onUploadCustomBrush: (file: File) => void;
}

interface ToolConfig {
  id: ToolType | 'shapes';
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  hasSubmenu?: boolean;
}

const BRUSH_STYLES: { id: BrushStyle; name: string; desc: string }[] = [
  { id: 'solid-round', name: 'Solid Round', desc: 'Smooth, pressure-sensitive round brush' },
  { id: 'flat-marker', name: 'Flat Marker', desc: 'Chiseled flat nib with bold strokes' },
  { id: 'calligraphy', name: 'Calligraphy / Chisel', desc: '45° angled dynamic ribbon tip' },
  { id: 'airbrush', name: 'Soft Airbrush', desc: 'Dithered spray paint particle dispersion' },
  { id: 'image-stamp', name: 'Custom Stamp Brush', desc: 'Repeated image stamp along path' },
];

const PENCIL_TEXTURES: { id: PencilTexture; name: string; desc: string }[] = [
  { id: 'soft-2b', name: 'Soft Graphite (2B)', desc: 'Organic graphite grain with pressure opacity' },
  { id: 'hard-4h', name: 'Hard Graphite (4H)', desc: 'Crisp, light, fine line sketch feel' },
  { id: 'colored-pencil', name: 'Colored Pencil', desc: 'Waxy, scattered soft pigment grain' },
  { id: 'charcoal', name: 'Charcoal / Rough', desc: 'Heavy rough crumbly texture' },
];

const SHAPE_PRESETS: { id: ShapeType; name: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: 'line', name: 'Straight Line', icon: Minus, desc: 'Connect two points directly' },
  { id: 'rect', name: 'Rectangle / Box', icon: Square, desc: 'Geometric rectangle or square' },
  { id: 'ellipse', name: 'Circle / Ellipse', icon: Circle, desc: 'Circles and organic ellipses' },
  { id: 'arrow', name: 'Arrow Pointer', icon: MoveUpRight, desc: 'Line ending in directional arrowhead' },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  setActiveTool,
  currentColor,
  onOpenColorPicker,
  brushSettings,
  setBrushSettings,
  stamps,
  onUploadCustomBrush,
}) => {
  const [openSubmenu, setOpenSubmenu] = useState<'brush' | 'pencil' | 'shapes' | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number }>({ top: 0 });

  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup if clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openSubmenu && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenSubmenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openSubmenu]);

  // Determine current active shape icon
  const getActiveShapeIcon = () => {
    switch (brushSettings.activeShape) {
      case 'line': return Minus;
      case 'rect': return Square;
      case 'ellipse': return Circle;
      case 'arrow': return MoveUpRight;
      default: return Square;
    }
  };

  const isShapeActive =
    activeTool === 'line' ||
    activeTool === 'rect' ||
    activeTool === 'ellipse' ||
    activeTool === 'arrow';

  const TOOLS: ToolConfig[] = [
    { id: 'select', name: 'Select & Transform', icon: MousePointer, shortcut: 'V' },
    { id: 'brush', name: 'Brush (Hold for styles)', icon: Brush, shortcut: 'B', hasSubmenu: true },
    { id: 'pencil', name: 'Pencil (Hold for textures)', icon: Pencil, shortcut: 'P', hasSubmenu: true },
    { id: 'eraser', name: 'Eraser', icon: Eraser, shortcut: 'E' },
    { id: 'fill', name: 'Fill Bucket', icon: PaintBucket, shortcut: 'F' },
    { id: 'shapes', name: 'Shapes (Hold for presets)', icon: getActiveShapeIcon(), shortcut: 'U', hasSubmenu: true },
    { id: 'stamp', name: 'Image Stamp', icon: Stamp, shortcut: 'S' },
    { id: 'text', name: 'Text Tool', icon: Type, shortcut: 'T' },
    { id: 'eyedropper', name: 'Eyedropper', icon: Pipette, shortcut: 'I' },
    { id: 'pan', name: 'Pan / Hand', icon: Hand, shortcut: 'H' },
  ];

  const handlePointerDown = (tool: ToolConfig, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!tool.hasSubmenu) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.top });
    isLongPressRef.current = false;

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setOpenSubmenu(tool.id as 'brush' | 'pencil' | 'shapes');
      if (tool.id === 'shapes') {
        setActiveTool(brushSettings.activeShape || 'rect');
      } else {
        setActiveTool(tool.id as ToolType);
      }
    }, 380); // 380ms long press
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleContextMenu = (tool: ToolConfig, e: React.MouseEvent<HTMLButtonElement>) => {
    if (tool.hasSubmenu) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({ top: rect.top });
      setOpenSubmenu(tool.id as 'brush' | 'pencil' | 'shapes');
      if (tool.id === 'shapes') {
        setActiveTool(brushSettings.activeShape || 'rect');
      } else {
        setActiveTool(tool.id as ToolType);
      }
    }
  };

  const handleToolClick = (tool: ToolConfig) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (tool.id === 'shapes') {
      setActiveTool(brushSettings.activeShape || 'rect');
    } else if (tool.id === 'stamp') {
      if (!brushSettings.selectedStampId && stamps.length > 0) {
        setBrushSettings((prev) => ({ ...prev, selectedStampId: stamps[0].id }));
      }
      setActiveTool('stamp');
    } else {
      setActiveTool(tool.id as ToolType);
    }
  };

  const handleBrushStyleSelect = (style: BrushStyle) => {
    setBrushSettings((prev) => ({
      ...prev,
      brushStyle: style,
      selectedStampId:
        style === 'image-stamp' && !prev.selectedStampId && stamps.length > 0
          ? stamps[0].id
          : prev.selectedStampId,
    }));
    setActiveTool('brush');
    setOpenSubmenu(null);
  };

  const handlePencilTextureSelect = (texture: PencilTexture) => {
    setBrushSettings((prev) => ({ ...prev, pencilTexture: texture }));
    setActiveTool('pencil');
    setOpenSubmenu(null);
  };

  const handleShapeSelect = (shape: ShapeType) => {
    setBrushSettings((prev) => ({ ...prev, activeShape: shape }));
    setActiveTool(shape);
    setOpenSubmenu(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadCustomBrush(e.target.files[0]);
      setOpenSubmenu(null);
    }
    e.target.value = '';
  };

  return (
    <aside
      ref={containerRef}
      className="relative w-18 bg-white border-r-3 border-black flex flex-col items-center py-2 shrink-0 select-none z-30 overflow-y-auto"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Tools Section Header */}
      <div className="w-full text-center pb-2 mb-2 border-b-2 border-black">
        <span className="text-[10px] font-black tracking-widest text-black uppercase">
          TOOLS
        </span>
      </div>

      {/* Tool Icons Grid / List */}
      <div className="flex flex-col gap-1.5 w-full items-center px-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive =
            tool.id === 'shapes' ? isShapeActive : activeTool === tool.id;

          return (
            <div key={tool.id} className="relative">
              <button
                onClick={() => handleToolClick(tool)}
                onPointerDown={(e) => handlePointerDown(tool, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(e) => handleContextMenu(tool, e)}
                className={`relative w-11 h-11 border-3 border-black flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#FFE600] shadow-[3px_3px_0px_#000] translate-x-[1px]'
                    : 'bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000]'
                }`}
                title={tool.name}
              >
                <Icon className="w-5 h-5 text-black stroke-[2.5]" />

                {/* Corner triangle mark for tools with long-press submenu */}
                {tool.hasSubmenu && (
                  <div
                    className="absolute bottom-0.5 right-0.5 w-0 h-0 border-b-[5px] border-r-[5px] border-b-black border-r-black border-t-[5px] border-t-transparent border-l-[5px] border-l-transparent"
                    title="Right-click or hold for options"
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Neo-Brutalist Popover Menu for Brush, Pencil & Consolidated Shapes */}
      {openSubmenu && (
        <div
          className="fixed left-20 z-50 w-72 bg-white border-3 border-black shadow-[6px_6px_0px_#000] p-3 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.max(16, Math.min(window.innerHeight - 380, menuPosition.top - 20)) }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black">
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-black" />
              <span className="text-xs font-black uppercase tracking-wider">
                {openSubmenu === 'brush'
                  ? 'BRUSH STYLES'
                  : openSubmenu === 'pencil'
                  ? 'PENCIL TEXTURES'
                  : 'SHAPE PRESETS'}
              </span>
            </div>
            <button
              onClick={() => setOpenSubmenu(null)}
              className="p-1 hover:bg-neutral-100 rounded-none border border-black"
              title="Close Submenu"
            >
              <X size={14} />
            </button>
          </div>

          {/* Submenu 1: Brush Styles */}
          {openSubmenu === 'brush' && (
            <div className="space-y-1.5">
              {BRUSH_STYLES.map((b) => {
                const isSelected = brushSettings.brushStyle === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => handleBrushStyleSelect(b.id)}
                    className={`w-full text-left p-2 border-2 border-black flex items-start justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000] font-black'
                        : 'bg-white hover:bg-neutral-50 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black text-black">{b.name}</div>
                      <div className="text-[10px] text-neutral-600 font-medium">
                        {b.desc}
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="stroke-[3] mt-0.5 shrink-0" />}
                  </button>
                );
              })}

              <div className="pt-2 mt-2 border-t border-black">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full brutal-btn py-1.5 bg-[#00E5F0] hover:bg-[#00cde0] text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
                >
                  <Upload size={14} className="stroke-[2.5]" />
                  <span>+ UPLOAD CUSTOM BRUSH TIP</span>
                </button>
              </div>
            </div>
          )}

          {/* Submenu 2: Pencil Textures */}
          {openSubmenu === 'pencil' && (
            <div className="space-y-1.5">
              {PENCIL_TEXTURES.map((p) => {
                const isSelected = brushSettings.pencilTexture === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePencilTextureSelect(p.id)}
                    className={`w-full text-left p-2 border-2 border-black flex items-start justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000] font-black'
                        : 'bg-white hover:bg-neutral-50 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black text-black">{p.name}</div>
                      <div className="text-[10px] text-neutral-600 font-medium">
                        {p.desc}
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="stroke-[3] mt-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Submenu 3: Consolidated Shapes */}
          {openSubmenu === 'shapes' && (
            <div className="space-y-1.5">
              {SHAPE_PRESETS.map((s) => {
                const ShapeIcon = s.icon;
                const isSelected = brushSettings.activeShape === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleShapeSelect(s.id)}
                    className={`w-full text-left p-2 border-2 border-black flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000] font-black'
                        : 'bg-white hover:bg-neutral-50 shadow-[1px_1px_0px_#000]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 border-2 border-black bg-white flex items-center justify-center shrink-0">
                        <ShapeIcon className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-black">{s.name}</div>
                        <div className="text-[10px] text-neutral-600 font-medium">
                          {s.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="stroke-[3] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Color Section at Bottom */}
      <div className="w-full mt-auto pt-3 border-t-2 border-black flex flex-col items-center">
        <span className="text-[10px] font-black tracking-widest text-black uppercase mb-1">
          COLOR
        </span>
        <button
          onClick={onOpenColorPicker}
          className="w-11 h-11 border-3 border-black shadow-[3px_3px_0px_#000] relative cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          style={{ backgroundColor: currentColor }}
          title="Click to choose color"
        >
          {currentColor === '#FFFFFF' && (
            <div className="absolute inset-0 border border-neutral-300" />
          )}
        </button>
      </div>
    </aside>
  );
};
