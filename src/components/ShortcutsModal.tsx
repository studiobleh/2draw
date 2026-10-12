import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'B', action: 'Brush / Pencil tool' },
  { key: 'E', action: 'Eraser tool' },
  { key: 'H', action: 'Hand / Pan tool' },
  { key: 'U', action: 'Shapes tool' },
  { key: 'F', action: 'Paint bucket fill' },
  { key: 'Space (hold)', action: 'Temporary Hand / Pan' },
  { key: 'Space (tap)', action: 'Play / Pause playback' },
  { key: 'I', action: 'Eyedropper color picker' },
  { key: 'V', action: 'Selection tool' },
  { key: '← / →', action: 'Previous / Next frame' },
  { key: 'Ctrl/Cmd + Z', action: 'Undo last change' },
  { key: 'Ctrl/Cmd + Y', action: 'Redo change' },
  { key: 'Ctrl/Cmd + S', action: 'Save / backup project' },
  { key: 'Delete', action: 'Delete current frame' },
  { key: '+ / -', action: 'Zoom canvas in / out' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-md p-6 select-none animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b-3 border-black">
          <div className="flex items-center gap-2">
            <Keyboard size={20} className="stroke-[2.5]" />
            <h2 className="font-black text-lg uppercase tracking-wider">KEYBOARD SHORTCUTS</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {SHORTCUTS.map((item, idx) => (
            <div
              key={idx}
              className="border-2 border-black p-2 flex items-center justify-between bg-neutral-50 shadow-[2px_2px_0px_#000]"
            >
              <span className="text-xs font-bold text-neutral-800">{item.action}</span>
              <kbd className="bg-white border-2 border-black px-1.5 py-0.5 text-xs font-mono font-black shadow-[1px_1px_0px_#000]">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button
            onClick={onClose}
            className="w-full brutal-btn py-2 bg-[#FFE600] text-black text-xs font-black uppercase tracking-wider"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
};
