import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  Search,
  Plus,
  Play,
  Copy,
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  Upload,
  Film,
  Sparkles,
  Calendar,
  Layers,
  Clock,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { ProjectSummary } from '../types';
import {
  getAllProjectsFromDB,
  deleteProjectFromDB,
  duplicateProjectInDB,
  renameProjectInDB,
  saveProjectToDB,
  createDefaultProject,
  getProjectFromDB,
  exportProjectToFile,
  parseProjectFile,
} from '../storage/db';

interface ProjectDashboardProps {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
  onImportProjectFile: (file: File) => void;
  onDeleteProject?: (projectId: string) => void;
}

// Format timestamp to "OCT 11, 2026 - 03:42 AM" format exactly
function formatProjectTimestamp(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
    return `${month} ${day}, ${year} - ${time}`;
  } catch {
    return 'RECENT';
  }
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onOpenProject,
  onNewProject,
  onImportProjectFile,
  onDeleteProject,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  // Import notifications
  const [importNotification, setImportNotification] = useState<{
    id: string;
    name: string;
    framesCount: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    setLoading(true);
    let list = await getAllProjectsFromDB();

    // If the database has zero projects on very first launch, seed an initial friendly starter project once
    if (list.length === 0) {
      const hasSeeded = localStorage.getItem('2draw_db_seeded');
      if (!hasSeeded) {
        const demoProj = createDefaultProject(800, 600, 12, 'white', 'Neon Bounce Loop // Starter');
        await saveProjectToDB(demoProj);
        localStorage.setItem('2draw_db_seeded', 'true');
        list = await getAllProjectsFromDB();
      }
    }

    setProjects(list);
    setLoading(false);
  };

  useEffect(() => {
    // Explicitly restore default system pointer visibility and pointer events upon entering dashboard
    if (document.body) {
      document.body.style.cursor = 'default';
      document.body.style.pointerEvents = 'auto';
    }
    loadProjects();

    const input = importInputRef.current;
    if (input) {
      const handleCancel = () => {
        if (document.body) {
          document.body.style.cursor = 'default';
          document.body.style.pointerEvents = 'auto';
        }
      };
      input.addEventListener('cancel', handleCancel);
      return () => input.removeEventListener('cancel', handleCancel);
    }
  }, []);

  const handleStartRename = (proj: ProjectSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(proj.id);
    setEditingName(proj.name);
  };

  const handleSaveRename = async (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const cleanName = editingName.trim();
    if (cleanName) {
      await renameProjectInDB(id, cleanName);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: cleanName, updatedAt: Date.now() } : p))
      );
    }
    setEditingId(null);
  };

  const handleCancelRename = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated = await duplicateProjectInDB(id);
    if (duplicated) {
      await loadProjects();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    // 1. Immediate optimistic UI state update - removes project folder instantly from grid view
    setProjects((prev) => prev.filter((p) => p.id !== targetId));
    setDeleteTarget(null);

    // 2. Notify parent app state immediately so autosave is cancelled and project reference purged
    if (onDeleteProject) {
      onDeleteProject(targetId);
    }

    // 3. Complete IndexedDB purge of all canvas frame blobs, audio tracks, and metadata
    await deleteProjectFromDB(targetId);

    // 4. Synchronize with fresh storage query to guarantee clean state
    const freshList = await getAllProjectsFromDB();
    setProjects(freshList);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setImportError(null);
        const text = await file.text();
        const imported = parseProjectFile(text);
        if (!imported.stamps || imported.stamps.length === 0) {
          imported.stamps = [...createDefaultProject().stamps];
        }

        // Prevent collision if a project with the same ID already exists in storage
        const existing = await getProjectFromDB(imported.id);
        if (existing) {
          imported.id = 'proj_' + Math.random().toString(36).substring(2, 9);
          if (existing.name === imported.name) {
            imported.name = `${imported.name} (Imported)`;
          }
        }
        imported.updatedAt = Date.now();

        // Write the project data and frame blobs into IndexedDB
        await saveProjectToDB(imported);

        // Instantly refresh the Dashboard grid to display the imported project without errors
        await loadProjects();

        // Display Neo-Brutalist confirmation badge
        setImportNotification({
          id: imported.id,
          name: imported.name,
          framesCount: imported.frames.length,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to import .2draw file:', err);
      setImportError(err instanceof Error ? err.message : 'Invalid .2draw file format');
    } finally {
      // Explicitly restore default cursor and pointer events immediately upon import completion
      if (e.target) {
        e.target.value = '';
      }
      if (document.body) {
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
      }
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      className="min-h-screen w-full bg-[#F9F9FB] flex flex-col text-black select-none font-sans overflow-x-hidden"
      style={{ cursor: 'default', pointerEvents: 'auto' }}
    >
      {/* Hidden file input restricted strictly to .2draw format */}
      <input
        ref={importInputRef}
        type="file"
        accept=".2draw"
        className="hidden"
        onChange={handleFileImport}
      />

      {/* TOP NEO-BRUTALIST NAVBAR */}
      <header className="w-full bg-white border-b-3 border-black px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-[0_4px_0px_#000]">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="bg-[#FFE600] border-3 border-black shadow-[4px_4px_0px_#000] px-3.5 py-2 flex items-center gap-2.5">
            <Film className="w-6 h-6 text-black stroke-[3]" />
            <div className="flex flex-col">
              <span className="font-black text-base tracking-wider leading-none">2DRAW</span>
              <span className="text-[10px] font-black tracking-widest text-black/70 leading-tight">
                STUDIO
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-black tracking-widest text-neutral-800 uppercase">
              PROJECT VAULT // HUB
            </span>
            <span className="text-[10px] font-bold text-neutral-500">
              FRAME-BY-FRAME 2D ENGINE
            </span>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Quick Import Project Button */}
          <button
            onClick={() => {
              if (document.body) {
                document.body.style.cursor = 'default';
                document.body.style.pointerEvents = 'auto';
              }
              importInputRef.current?.click();
            }}
            className="brutal-btn px-3.5 py-2 bg-white hover:bg-neutral-100 text-xs font-black uppercase flex items-center gap-2 border-3 border-black shadow-[3px_3px_0px_#000]"
            title="Import an existing .2draw project file"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden md:inline">IMPORT PROJECT</span>
            <span className="md:hidden">IMPORT</span>
          </button>

          {/* Compact "NEW PROJECT" Button directly matching prompt */}
          <button
            onClick={onNewProject}
            className="brutal-btn rounded-none px-4 py-2 bg-[#FFE600] hover:bg-[#FFE600]/90 active:bg-[#FFE600] text-black text-xs font-black uppercase flex items-center gap-2 border-3 border-black shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000]"
            style={{ borderRadius: 0 }}
            title="Create a New Animation Project"
          >
            <FolderPlus className="w-4 h-4 stroke-[3]" />
            <span>NEW PROJECT</span>
          </button>
        </div>
      </header>

      {/* MAIN DASHBOARD CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {/* HERO TITLE & CHUNKY SEARCH SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b-3 border-black">
          <div>
            <div className="inline-block bg-[#00E5F0] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider mb-2 shadow-[2px_2px_0px_#000]">
              LOCAL OFFLINE STORAGE // INDEXEDDB
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight leading-none">
              2DRAW STUDIO // PROJECT VAULT
            </h1>
            <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-1">
              Select any project folder to enter the workspace, or create a fresh canvas.
            </p>
          </div>

          {/* CHUNKY BRUTALIST SEARCH BAR */}
          <div className="w-full md:w-80 relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH PROJECTS BY NAME..."
                className="w-full bg-white border-3 border-black px-3.5 py-2 pl-9 text-xs font-black uppercase tracking-wider placeholder:text-neutral-400 placeholder:normal-case outline-none focus:bg-white shadow-[4px_4px_0px_#000] focus:shadow-[5px_5px_0px_#000] transition-shadow"
              />
              <Search className="w-4 h-4 text-black absolute left-3 pointer-events-none stroke-[2.5]" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-0.5 hover:bg-neutral-200 text-black"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* METRICS & VIEW SUMMARY BAR */}
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span className="bg-white border-2 border-black px-2.5 py-1 shadow-[2px_2px_0px_#000]">
              TOTAL SAVED: <span className="text-[#2563EB]">{projects.length}</span>
            </span>
            {searchQuery && (
              <span className="bg-[#FFE600] border-2 border-black px-2.5 py-1 shadow-[2px_2px_0px_#000]">
                MATCHING: {filteredProjects.length}
              </span>
            )}
          </div>
        </div>

        {/* IMPORT NOTIFICATION BANNER */}
        {importNotification && (
          <div className="bg-[#86EFAC] border-3 border-black p-3.5 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-black text-[#86EFAC] flex items-center justify-center font-black">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-black">
                  PROJECT IMPORTED SUCCESSFULLY (.2DRAW)
                </div>
                <div className="text-[11px] font-bold text-neutral-800">
                  "{importNotification.name}" ({importNotification.framesCount} frames) has been added to your vault.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenProject(importNotification.id)}
                className="brutal-btn px-3 py-1.5 bg-[#FFE600] text-black text-xs font-black uppercase flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000]"
                title="Open imported project immediately"
              >
                <Play className="w-3.5 h-3.5 fill-black stroke-black" />
                <span>OPEN IN WORKSPACE</span>
              </button>
              <button
                onClick={() => setImportNotification(null)}
                className="p-1.5 hover:bg-black/10 border-2 border-transparent hover:border-black text-black"
                title="Dismiss banner"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* IMPORT ERROR BANNER */}
        {importError && (
          <div className="bg-[#FF5F38] text-white border-3 border-black p-3.5 shadow-[4px_4px_0px_#000] flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 stroke-[2.5] text-white" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider">
                  IMPORT ERROR (.2DRAW FORMAT)
                </div>
                <div className="text-[11px] font-bold text-white/90">
                  {importError}
                </div>
              </div>
            </div>
            <button
              onClick={() => setImportError(null)}
              className="p-1 hover:bg-black/20 text-white"
              title="Dismiss error"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* BLUE FOLDER PROJECT CARDS GRID */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 bg-[#FFE600] border-3 border-black shadow-[3px_3px_0px_#000] animate-bounce" />
            <span className="text-xs font-black uppercase tracking-wider">
              LOADING SAVED PROJECTS...
            </span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 px-6 bg-white border-3 border-black shadow-[6px_6px_0px_#000] flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-[#2563EB] border-3 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-white stroke-[2.5]" />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tight">
              {searchQuery ? 'NO MATCHING PROJECTS FOUND' : 'NO PROJECTS SAVED YET'}
            </h3>
            <p className="text-xs font-bold text-neutral-600 mt-1 mb-6">
              {searchQuery
                ? `No project titles match "${searchQuery}". Clear your search query.`
                : 'Create your first 2D animation project to start drawing frame-by-frame.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="brutal-btn px-4 py-2 bg-white text-xs font-black uppercase border-3 border-black shadow-[3px_3px_0px_#000]"
              >
                CLEAR SEARCH FILTER
              </button>
            ) : (
              <button
                onClick={onNewProject}
                className="brutal-btn px-5 py-2.5 bg-[#FFE600] text-xs font-black uppercase border-3 border-black shadow-[4px_4px_0px_#000] flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                CREATE NEW PROJECT
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* TACTILE "NEW PROJECT" FOLDER CARD IN GRID (Matches Blue Folder Architecture) */}
            <div
              onClick={onNewProject}
              className="group relative flex flex-col transition-all hover:-translate-y-1 cursor-pointer"
              title="Click to launch New Project Setup"
            >
              {/* Folder Top Tab */}
              <div className="flex items-center">
                <div className="h-6 px-3 bg-[#FFE600] border-t-3 border-x-3 border-black text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[-2px_-2px_0px_#000_inset]">
                  <FolderPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ NEW PROJECT</span>
                </div>
                <div className="w-3 h-6 border-b-3 border-black relative" />
              </div>

              {/* Folder Main Body */}
              <div className="bg-white hover:bg-[#FFE600]/10 border-3 border-black p-3.5 shadow-[5px_5px_0px_#000] flex flex-col justify-between gap-3 min-h-[285px]">
                <div className="bg-neutral-50 border-2 border-dashed border-black p-4 flex flex-col items-center justify-center gap-2 aspect-[4/3] group-hover:border-solid group-hover:bg-[#FFE600]/20 transition-all">
                  <div className="w-12 h-12 bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FolderPlus className="w-6 h-6 text-black stroke-[2.5]" />
                  </div>
                  <span className="font-black text-xs uppercase tracking-wider text-black text-center">
                    CREATE NEW CANVAS
                  </span>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase text-center">
                    CUSTOM FPS & RESOLUTION
                  </span>
                </div>

                <div className="bg-[#FFE600] border-2 border-black p-2 shadow-[2px_2px_0px_#000] text-center">
                  <span className="font-black text-xs uppercase tracking-wider text-black flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4 stroke-[3]" />
                    LAUNCH SETUP MODAL
                  </span>
                </div>
              </div>
            </div>

            {/* TACTILE BLUE FOLDER PROJECT CARDS */}
            {filteredProjects.map((proj) => {
              const isEditing = editingId === proj.id;

              return (
                <div
                  key={proj.id}
                  className="group relative flex flex-col transition-all hover:-translate-y-1"
                >
                  {/* FOLDER TOP TAB (Tactile Blue Tab with thick border) */}
                  <div className="flex items-center">
                    <div className="h-6 px-3 bg-[#1D4ED8] border-t-3 border-x-3 border-black text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[-2px_-2px_0px_#000_inset]">
                      <Folder className="w-3 h-3 fill-white stroke-black" />
                      <span>PROJECT FOLDER</span>
                    </div>
                    {/* Folder Tab diagonal transition notch */}
                    <div className="w-3 h-6 border-b-3 border-black relative" />
                  </div>

                  {/* FOLDER MAIN BODY (Deep Blue with 3px black border & hard box-shadow) */}
                  <div className="bg-[#2563EB] border-3 border-black p-3.5 shadow-[5px_5px_0px_#000] flex flex-col gap-3 min-h-[285px]">
                    {/* EMBEDDED PREVIEW WINDOW / ARTWORK FRAME */}
                    <div
                      onClick={() => onOpenProject(proj.id)}
                      className="bg-white border-2 border-black p-1 shadow-[2px_2px_0px_#000] cursor-pointer group-hover:border-black relative overflow-hidden aspect-[4/3] flex items-center justify-center"
                    >
                      {proj.thumbnailUrl ? (
                        <img
                          src={proj.thumbnailUrl}
                          alt={proj.name}
                          className="w-full h-full object-contain bg-white"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-100 flex flex-col items-center justify-center text-neutral-400 p-2 text-center">
                          <Film className="w-8 h-8 stroke-[1.5] mb-1 text-neutral-300" />
                          <span className="text-[10px] font-black uppercase text-neutral-500">
                            BLANK CANVAS
                          </span>
                        </div>
                      )}

                      {/* Hover Overlay "OPEN" Indicator */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-[#FFE600] border-2 border-black px-3 py-1 text-black text-xs font-black uppercase flex items-center gap-1.5 shadow-[3px_3px_0px_#000]">
                          <Play className="w-3.5 h-3.5 fill-black stroke-black" />
                          <span>OPEN IN WORKSPACE</span>
                        </div>
                      </div>

                      {/* Badges on preview: FPS & Frame Count */}
                      <div className="absolute top-1 left-1 bg-black/80 text-white px-1.5 py-0.5 text-[9px] font-black tracking-wider border border-black uppercase">
                        {proj.framesCount} {proj.framesCount === 1 ? 'FRAME' : 'FRAMES'}
                      </div>
                      <div className="absolute bottom-1 right-1 bg-[#FFE600] text-black px-1.5 py-0.5 text-[9px] font-black tracking-wider border border-black uppercase">
                        {proj.fps} FPS
                      </div>
                    </div>

                    {/* PROJECT TITLE & INLINE RENAME */}
                    <div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_#000]">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(proj.id, e);
                              if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            className="w-full border-2 border-black px-1.5 py-0.5 text-xs font-black uppercase outline-none bg-neutral-50"
                          />
                          <button
                            onClick={(e) => handleSaveRename(proj.id, e)}
                            className="p-1 bg-[#86EFAC] border border-black hover:bg-[#86EFAC]/80"
                            title="Save Title (Enter)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 bg-neutral-200 border border-black hover:bg-neutral-300"
                            title="Cancel (Esc)"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <h2
                            onClick={() => onOpenProject(proj.id)}
                            className="font-black text-xs uppercase tracking-tight truncate cursor-pointer hover:underline flex-1"
                            title={proj.name}
                          >
                            {proj.name}
                          </h2>
                          <button
                            onClick={(e) => handleStartRename(proj, e)}
                            className="p-1 text-black/60 hover:text-black hover:bg-neutral-100 rounded-none border border-transparent hover:border-black"
                            title="Edit Project Title"
                          >
                            <Edit2 className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      )}

                      {/* DETAILED TIMESTAMP */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-600 mt-1">
                        <Clock className="w-3 h-3 shrink-0 stroke-[2.5]" />
                        <span className="truncate">{formatProjectTimestamp(proj.updatedAt)}</span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS (Open, Export .2draw, Copy, Del) */}
                    <div className="grid grid-cols-2 gap-1.5 mt-auto pt-1">
                      {/* QUICK OPEN BUTTON */}
                      <button
                        onClick={() => onOpenProject(proj.id)}
                        className="brutal-btn py-1.5 bg-[#FFE600] text-black text-[11px] font-black uppercase flex items-center justify-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000]"
                        title="Open project in workspace"
                      >
                        <Play className="w-3 h-3 fill-black stroke-black" />
                        <span>OPEN</span>
                      </button>

                      {/* EXPORT PROJECT BUTTON (.2draw) */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const fullProj = await getProjectFromDB(proj.id);
                          if (fullProj) {
                            exportProjectToFile(fullProj);
                          }
                        }}
                        className="brutal-btn py-1.5 bg-[#00E5F0] text-black text-[10px] sm:text-[11px] font-black uppercase flex items-center justify-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000]"
                        title="Export Project archive (.2draw format)"
                      >
                        <Download className="w-3 h-3 stroke-[2.5]" />
                        <span className="truncate">EXPORT PROJECT</span>
                      </button>

                      {/* DUPLICATE BUTTON */}
                      <button
                        onClick={(e) => handleDuplicate(proj.id, e)}
                        className="brutal-btn py-1.5 bg-white text-black text-[11px] font-black uppercase flex items-center justify-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000]"
                        title="Duplicate project"
                      >
                        <Copy className="w-3 h-3 stroke-[2.5]" />
                        <span>COPY</span>
                      </button>

                      {/* BOLD RED DELETE BUTTON */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(proj);
                        }}
                        className="brutal-btn py-1.5 bg-[#FF5F38] text-white text-[11px] font-black uppercase flex items-center justify-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-red-600"
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3 stroke-[2.5]" />
                        <span>DEL</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[8px_8px_0px_#000] p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 bg-[#FF5F38] text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                <AlertTriangle className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-black text-base uppercase">DELETE PROJECT?</h3>
                <span className="text-[10px] font-bold text-neutral-500">THIS ACTION CANNOT BE UNDONE</span>
              </div>
            </div>

            <p className="text-xs font-bold text-neutral-700 mb-6 bg-neutral-100 p-3 border-2 border-black">
              Are you sure you want to permanently delete{' '}
              <span className="font-black text-black">"{deleteTarget.name}"</span>? All artwork,
              frames, and layers stored in your vault will be wiped.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="brutal-btn px-4 py-2 bg-neutral-200 text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="brutal-btn px-4 py-2 bg-[#FF5F38] text-white text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-red-600"
              >
                YES, DELETE PROJECT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
