import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (width: number, height: number, fps: number, bgColor: string, name: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('My Animation');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [fps, setFps] = useState(12);
  const [bgColor, setBgColor] = useState('white');

  if (!isOpen) return null;

  const handlePreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedW = Math.max(100, Math.min(3840, width));
    const clampedH = Math.max(100, Math.min(2160, height));
    onCreate(clampedW, clampedH, fps, bgColor, name.trim() || 'Untitled Animation');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-md p-6 select-none animate-in fade-in zoom-in-95 duration-100">
        {/* Header directly matching Reference 3 */}
        <div className="flex items-center justify-between pb-3 border-b-3 border-black">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black uppercase tracking-wider text-black">
              NEW PROJECT
            </h2>
          </div>
          <Sparkles className="w-6 h-6 text-black stroke-[2.5]" />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">
              PROJECT TITLE:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-3 border-black p-2 text-sm font-black outline-none focus:bg-neutral-50"
              placeholder="Project Name"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">
              CANVAS WIDTH (PX):
            </label>
            <input
              type="number"
              min="100"
              max="3840"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full border-3 border-black p-2 text-sm font-black outline-none focus:bg-neutral-50 tabular-nums"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">
              CANVAS HEIGHT (PX):
            </label>
            <input
              type="number"
              min="100"
              max="2160"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full border-3 border-black p-2 text-sm font-black outline-none focus:bg-neutral-50 tabular-nums"
              required
            />
          </div>

          {/* Quick Resolution Presets */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              QUICK RESOLUTION PRESETS:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset(800, 600)}
                className={`py-1 text-[11px] font-black border-2 border-black ${
                  width === 800 && height === 600 ? 'bg-[#FFE600]' : 'bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                800x600
              </button>
              <button
                type="button"
                onClick={() => handlePreset(1280, 720)}
                className={`py-1 text-[11px] font-black border-2 border-black ${
                  width === 1280 && height === 720 ? 'bg-[#FFE600]' : 'bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                720p HD
              </button>
              <button
                type="button"
                onClick={() => handlePreset(1920, 1080)}
                className={`py-1 text-[11px] font-black border-2 border-black ${
                  width === 1920 && height === 1080 ? 'bg-[#FFE600]' : 'bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                1080p FHD
              </button>
              <button
                type="button"
                onClick={() => handlePreset(1080, 1080)}
                className={`py-1 text-[11px] font-black border-2 border-black ${
                  width === 1080 && height === 1080 ? 'bg-[#FFE600]' : 'bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                1080 Sq
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                FRAMERATE (FPS):
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full border-3 border-black p-2 text-sm font-black outline-none bg-white cursor-pointer"
              >
                <option value={8}>8 FPS</option>
                <option value={12}>12 FPS (Standard)</option>
                <option value={24}>24 FPS (Film)</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                BACKGROUND COLOR:
              </label>
              <select
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-full border-3 border-black p-2 text-sm font-black outline-none bg-white cursor-pointer"
              >
                <option value="white">White</option>
                <option value="transparent">Transparent</option>
                <option value="black">Black</option>
              </select>
            </div>
          </div>

          {/* Bottom Actions directly matching Reference 3 */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="brutal-btn flex-1 py-2.5 bg-[#FF5F38] text-black text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="brutal-btn flex-1 py-2.5 bg-[#86EFAC] text-black text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000]"
            >
              CREATE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
