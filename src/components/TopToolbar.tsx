import React, { useRef } from 'react';
import {
  Film,
  Plus,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Download,
  FolderOpen,
  Save,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { Project } from '../types';

interface TopToolbarProps {
  project: Project;
  onGoToDashboard: () => void;
  onNewProject: () => void;
  onImportImage: (file: File) => void;
  onImportProjectFile: (file: File) => void;
  onExportProjectFile: () => void;
  onOpenExportModal: () => void;
  onOpenShortcutsModal: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearFrame: () => void;
  onUpdateFPS: (fps: number) => void;
  onUpdateProjectName: (name: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  project,
  onGoToDashboard,
  onNewProject,
  onImportImage,
  onImportProjectFile,
  onExportProjectFile,
  onOpenExportModal,
  onOpenShortcutsModal,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearFrame,
  onUpdateFPS,
  onUpdateProjectName,
  saveStatus,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        onImportImage(e.target.files[0]);
      }
    } finally {
      if (e.target) e.target.value = '';
      if (document.body) {
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
      }
    }
  };

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        onImportProjectFile(e.target.files[0]);
      }
    } finally {
      if (e.target) e.target.value = '';
      if (document.body) {
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
      }
    }
  };

  return (
    <header className="h-16 bg-white border-b-3 border-black px-4 flex items-center justify-between gap-3 shrink-0 select-none z-20">
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".2draw"
        className="hidden"
        onChange={handleProjectFileChange}
      />

      {/* Left: Branding & Core File Actions */}
      <div className="flex items-center gap-2.5">
        {/* Brand Lockup directly modeled after reference */}
        <button
          onClick={onGoToDashboard}
          className="bg-[#FFE600] border-3 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-all"
          title="Back to Project Vault // Hub"
        >
          <Film className="w-5 h-5 text-black stroke-[2.5]" />
          <div className="flex flex-col text-left">
            <span className="font-black text-sm tracking-wider uppercase leading-none">
              2DRAW
            </span>
            <span className="text-[9px] font-black tracking-widest text-black/70 leading-tight">
              STUDIO
            </span>
          </div>
        </button>

        {/* Project Name editable */}
        <input
          type="text"
          value={project.name}
          onChange={(e) => onUpdateProjectName(e.target.value)}
          placeholder="Project Title"
          className="border-2 border-black px-2 py-1 text-xs font-black max-w-[140px] truncate outline-none bg-neutral-50 hover:bg-white focus:bg-white focus:border-black"
          title="Click to rename project"
        />

        {/* New Button */}
        <button
          onClick={onNewProject}
          className="brutal-btn px-3 py-1.5 bg-white text-black text-xs font-black uppercase flex items-center gap-1.5"
          title="Create New Project"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>NEW</span>
        </button>

        {/* Import Image Button */}
        <button
          onClick={() => imageInputRef.current?.click()}
          className="brutal-btn px-3 py-1.5 bg-white text-black text-xs font-black uppercase flex items-center gap-1.5"
          title="Import image to canvas as stamp or layer artwork"
        >
          <ImageIcon className="w-4 h-4 stroke-[2.5]" />
          <span>IMPORT IMAGE</span>
        </button>

        {/* Project File Open & Backup dropdown/buttons */}
        <button
          onClick={() => projectInputRef.current?.click()}
          className="brutal-btn px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-black text-xs font-black flex items-center gap-1.5"
          title="Import / Open .2draw Project Archive"
        >
          <FolderOpen className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline text-[11px] font-black uppercase">IMPORT PROJECT</span>
        </button>

        <button
          onClick={onExportProjectFile}
          className="brutal-btn px-3 py-1.5 bg-[#00E5F0] hover:bg-[#00cce0] text-black text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
          title="Export Project (.2draw format archive)"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span className="text-[11px] font-black uppercase">EXPORT PROJECT</span>
        </button>
      </div>

      {/* Middle: Canvas Info / FPS Selector */}
      <div className="flex items-center gap-2">
        <div className="bg-[#00E5F0] border-3 border-black shadow-[3px_3px_0px_#000] px-3 py-1 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-black">
            <span>FPS:</span>
            <select
              value={project.fps}
              onChange={(e) => onUpdateFPS(Number(e.target.value))}
              className="bg-white border-2 border-black px-1.5 py-0.5 text-xs font-black outline-none cursor-pointer"
            >
              <option value={8}>8</option>
              <option value={12}>12 (Standard)</option>
              <option value={15}>15</option>
              <option value={24}>24 (Film)</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div className="h-4 w-[2px] bg-black" />
          <div className="text-xs font-black uppercase tracking-wider">
            <span>RESOLUTION: </span>
            <span className="tabular-nums">
              {project.width}x{project.height}
            </span>
          </div>
        </div>

        {/* Save status pill */}
        <div
          className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${
            saveStatus === 'saved'
              ? 'bg-[#86EFAC]'
              : saveStatus === 'saving'
              ? 'bg-[#FFE600]'
              : 'bg-neutral-200'
          }`}
          title="Autosave status"
        >
          {saveStatus === 'saved' ? '● SAVED' : saveStatus === 'saving' ? '⟳ SAVING...' : '○ UNSAVED'}
        </div>
      </div>

      {/* Right: History, Clear, Shortcuts, Export */}
      <div className="flex items-center gap-2">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="brutal-btn w-9 h-9 bg-white text-black disabled:opacity-40"
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="brutal-btn w-9 h-9 bg-white text-black disabled:opacity-40"
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Clear Frame */}
        <button
          onClick={onClearFrame}
          className="brutal-btn w-9 h-9 bg-white hover:bg-red-50 text-black"
          title="Clear active frame cel"
        >
          <Trash2 className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Shortcuts */}
        <button
          onClick={onOpenShortcutsModal}
          className="brutal-btn w-9 h-9 bg-white text-black"
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Export Button matching reference */}
        <button
          onClick={onOpenExportModal}
          className="brutal-btn px-4 py-2 bg-[#86EFAC] text-black text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-[3px_3px_0px_#000]"
        >
          <Download className="w-4 h-4 stroke-[3]" />
          <span>EXPORT</span>
        </button>
      </div>
    </header>
  );
};
