import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pipette, X, Check, Palette, Sliders } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
}

const PALETTE = [
  '#000000',
  '#FFFFFF',
  '#FFE600',
  '#FF5F38',
  '#00E5F0',
  '#2DD4BF',
  '#86EFAC',
  '#B65CE5',
  '#F43F5E',
  '#FB923C',
  '#FBBF24',
  '#A3E635',
  '#38BDF8',
  '#818CF8',
  '#C084FC',
  '#475569',
  '#64748B',
  '#94A3B8',
  '#CBD5E1',
  '#E2E8F0',
];

// Color Math Utilities
function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = (h % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onSelectColor,
}) => {
  const [activeTab, setActiveTab] = useState<'swatches' | 'spectrum'>('swatches');
  const [colorInput, setColorInput] = useState(currentColor);

  // HSV state for Spectrum tab
  const [hue, setHue] = useState(0); // 0-360
  const [sat, setSat] = useState(1); // 0-1
  const [val, setVal] = useState(1); // 0-1

  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingSpectrum = useRef(false);
  const isDraggingHue = useRef(false);

  // Sync HSV when colorInput changes from outside
  useEffect(() => {
    if (colorInput.startsWith('#') && (colorInput.length === 7 || colorInput.length === 4)) {
      const [r, g, b] = hexToRgb(colorInput);
      const [h, s, v] = rgbToHsv(r, g, b);
      setHue(h);
      setSat(s);
      setVal(v);
    }
  }, [isOpen]);

  // Draw 2D Saturation-Value spectrum canvas
  const drawSpectrum = useCallback(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Horizontal white to base Hue color
    const baseColor = `hsl(${hue}, 100%, 50%)`;
    const horizGrad = ctx.createLinearGradient(0, 0, width, 0);
    horizGrad.addColorStop(0, '#FFFFFF');
    horizGrad.addColorStop(1, baseColor);
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, 0, width, height);

    // Vertical black overlay
    const vertGrad = ctx.createLinearGradient(0, 0, 0, height);
    vertGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vertGrad.addColorStop(1, '#000000');
    ctx.fillStyle = vertGrad;
    ctx.fillRect(0, 0, width, height);
  }, [hue]);

  useEffect(() => {
    if (activeTab === 'spectrum') {
      drawSpectrum();
    }
  }, [activeTab, hue, drawSpectrum]);

  const updateColorFromHsv = (h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    setColorInput(hex);
  };

  // Handle 2D Spectrum box pointer drag
  const handleSpectrumPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDraggingSpectrum.current = true;
    handleSpectrumMove(e);
  };

  const handleSpectrumPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingSpectrum.current) return;
    handleSpectrumMove(e);
  };

  const handleSpectrumMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const newSat = x / rect.width;
    const newVal = 1 - y / rect.height;

    setSat(newSat);
    setVal(newVal);
    updateColorFromHsv(hue, newSat, newVal);
  };

  const handleSpectrumPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingSpectrum.current) {
      isDraggingSpectrum.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Handle Hue slider pointer drag
  const handleHueChange = (newHue: number) => {
    setHue(newHue);
    updateColorFromHsv(newHue, sat, val);
  };

  if (!isOpen) return null;

  const handleApply = (color: string) => {
    onSelectColor(color);
    onClose();
  };

  const [currentR, currentG, currentB] = hexToRgb(colorInput);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-sm p-5 select-none animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Pipette size={18} className="stroke-[2.5]" />
            <h3 className="font-black text-sm uppercase tracking-wider">COLOR PICKER</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded-none border border-black" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation Header: [ SWATCHES ] | [ SPECTRUM ] */}
        <div className="flex mt-3 border-2 border-black bg-neutral-100 p-1 gap-1">
          <button
            onClick={() => setActiveTab('swatches')}
            className={`flex-1 py-1.5 text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'swatches'
                ? 'bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_#000]'
                : 'bg-transparent hover:bg-white text-neutral-700'
            }`}
          >
            <Palette size={14} className="stroke-[2.5]" />
            <span>SWATCHES</span>
          </button>
          <button
            onClick={() => setActiveTab('spectrum')}
            className={`flex-1 py-1.5 text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'spectrum'
                ? 'bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_#000]'
                : 'bg-transparent hover:bg-white text-neutral-700'
            }`}
          >
            <Sliders size={14} className="stroke-[2.5]" />
            <span>SPECTRUM</span>
          </button>
        </div>

        {/* Current Color Indicator + Live Preview */}
        <div className="mt-3 p-2 border-2 border-black flex items-center gap-3 bg-neutral-50">
          <div
            className="w-12 h-12 border-2 border-black shadow-[2px_2px_0px_#000] shrink-0"
            style={{ backgroundColor: colorInput }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] font-black uppercase text-neutral-500">HEX CODE</span>
              <span className="text-[10px] font-mono font-bold text-neutral-600">
                RGB({currentR}, {currentG}, {currentB})
              </span>
            </div>
            <input
              type="text"
              value={colorInput}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setColorInput(val);
                if (val.startsWith('#') && val.length === 7) {
                  const [r, g, b] = hexToRgb(val);
                  const [h, s, v] = rgbToHsv(r, g, b);
                  setHue(h);
                  setSat(s);
                  setVal(v);
                }
              }}
              className="w-full border-2 border-black p-1 text-xs font-mono font-black uppercase outline-none focus:bg-white"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* TAB 1: SWATCHES GRID */}
        {activeTab === 'swatches' && (
          <div className="mt-3">
            <span className="text-[10px] font-black uppercase tracking-wider block mb-1.5">
              PRESET PALETTE
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColorInput(c);
                    const [r, g, b] = hexToRgb(c);
                    const [h, s, v] = rgbToHsv(r, g, b);
                    setHue(h);
                    setSat(s);
                    setVal(v);
                  }}
                  className={`w-full aspect-square border-2 border-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
                    colorInput.toUpperCase() === c.toUpperCase() ? 'ring-2 ring-black scale-105 shadow-[2px_2px_0px_#000]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {colorInput.toUpperCase() === c.toUpperCase() && (
                    <Check
                      size={14}
                      className={c === '#FFFFFF' || c === '#FFE600' || c === '#86EFAC' ? 'text-black stroke-[3]' : 'text-white stroke-[3]'}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE SPECTRUM CANVAS & HUE SLIDER */}
        {activeTab === 'spectrum' && (
          <div className="mt-3 space-y-3">
            {/* 2D Saturation / Value Canvas */}
            <div className="relative border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]">
              <canvas
                ref={spectrumCanvasRef}
                width={280}
                height={140}
                onPointerDown={handleSpectrumPointerDown}
                onPointerMove={handleSpectrumPointerMove}
                onPointerUp={handleSpectrumPointerUp}
                className="w-full h-36 cursor-crosshair block touch-none"
              />
              {/* Draggable Crosshair Handle */}
              <div
                className="absolute w-4 h-4 rounded-full spectrum-thumb border-2 border-black bg-white shadow-[0_0_2px_#000] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${sat * 100}%`,
                  top: `${(1 - val) * 100}%`,
                  backgroundColor: colorInput,
                }}
              />
            </div>

            {/* Dynamic Rainbow Hue Slider */}
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                <span>HUE SPECTRUM</span>
                <span className="tabular-nums">{Math.round(hue)}°</span>
              </div>
              <div className="relative h-6 border-2 border-black shadow-[2px_2px_0px_#000]">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => handleHueChange(Number(e.target.value))}
                  className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                />
                <div
                  className="w-full h-full"
                  style={{
                    background:
                      'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                  }}
                />
                {/* Visual Thumb Marker */}
                <div
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 border-2 border-black bg-white pointer-events-none shadow-[1px_1px_0px_#000]"
                  style={{ left: `${(hue / 360) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="brutal-btn flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-xs font-black uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={() => handleApply(colorInput)}
            className="brutal-btn flex-1 py-2 bg-[#FFE600] hover:bg-[#ebd400] text-black text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_#000]"
          >
            Apply Color
          </button>
        </div>
      </div>
    </div>
  );
};
