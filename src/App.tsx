import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Project,
  ToolType,
  BrushSettings,
  ViewportTransform,
  Layer,
  Frame,
} from './types';
import {
  createDefaultProject,
  saveProjectToDB,
  getLatestProject,
  getProjectFromDB,
  exportProjectToFile,
  parseProjectFile,
} from './storage/db';
import { HistoryManager } from './history/historyManager';
import { generateFrameThumbnail } from './engine/frameRenderer';
import { audioManager } from './audio/audioManager';
import { DEFAULT_STAMPS } from './constants/defaultStamps';

import { ProjectDashboard } from './components/ProjectDashboard';
import { TopToolbar } from './components/TopToolbar';
import { LeftToolbar } from './components/LeftToolbar';
import { CanvasViewport } from './components/CanvasViewport';
import { RightInspector } from './components/RightInspector';
import { BottomTimeline } from './components/BottomTimeline';
import { NewProjectModal } from './components/NewProjectModal';
import { ExportModal } from './components/ExportModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { ShortcutsModal } from './components/ShortcutsModal';

const history = new HistoryManager();

export default function App() {
  // App view: starts on 'dashboard' on launch as requested
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace'>('dashboard');
  const [project, setProject] = useState<Project>(() => createDefaultProject());
  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 6,
    opacity: 1.0,
    color: '#000000',
    tolerance: 32,
    fillBleed: 2,
    brushStyle: 'solid-round',
    pencilTexture: 'soft-2b',
    eraserSoftness: 0,
    eraserShape: 'round',
    activeShape: 'rect',
    selectedStampId: 'stamp_default_star',
    stampSize: 64,
    stampSpacing: 24,
    stampRotation: 0,
    stampDynamicRotation: false,
    stampTintWithColor: false,
    fontSize: 24,
    fontFamily: 'Plus Jakarta Sans',
    fontBold: true,
    fontItalic: false,
  });

  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pendingImportAsset, setPendingImportAsset] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);

  // Playback timer ref
  const playheadRef = useRef<number>(0);
  const lastPlayTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spacePressTimeRef = useRef<number | null>(null);

  // Load project on mount
  useEffect(() => {
    async function init() {
      const saved = await getLatestProject();
      if (saved && saved.frames && saved.frames.length > 0) {
        if (!saved.stamps || saved.stamps.length === 0) {
          saved.stamps = [...DEFAULT_STAMPS];
        }
        setProject(saved);
        if (saved.audioTrack) {
          audioManager.loadFromDataUrl(saved.audioTrack.dataUrl, saved.audioTrack.name);
        }
      }
    }
    init();
  }, []);

  // Update frame thumbnails helper
  const updateThumbnailForFrame = useCallback(
    async (frameIndex: number, currentProject: Project) => {
      const frame = currentProject.frames[frameIndex];
      if (!frame) return;

      const thumbUrl = await generateFrameThumbnail(
        frame,
        currentProject.layers,
        currentProject.width,
        currentProject.height,
        currentProject.backgroundColor
      );

      setProject((prev) => {
        const newFrames = [...prev.frames];
        if (newFrames[frameIndex]) {
          newFrames[frameIndex] = { ...newFrames[frameIndex], thumbnailUrl: thumbUrl };
        }
        return { ...prev, frames: newFrames };
      });
    },
    []
  );

  // Autosave debounced effect - strictly active only while working in workspace
  useEffect(() => {
    if (currentView !== 'workspace') {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      return;
    }

    setSaveStatus('unsaved');
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    autosaveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveProjectToDB(project);
      setSaveStatus('saved');
    }, 800);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [project, currentView]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioManager.stop();
      return;
    }

    const fps = Math.max(1, project.fps);
    const frameIntervalMs = 1000 / fps;
    lastPlayTimeRef.current = performance.now();
    playheadRef.current = project.activeFrameIndex;

    // Start audio if audio track exists
    if (project.audioTrack) {
      const startTimeSec = project.activeFrameIndex / fps;
      audioManager.play(startTimeSec, project.audioTrack.volume);
    }

    const step = (now: number) => {
      const delta = now - lastPlayTimeRef.current;

      if (delta >= frameIntervalMs) {
        const framesToAdvance = Math.floor(delta / frameIntervalMs);
        lastPlayTimeRef.current = now - (delta % frameIntervalMs);

        setProject((prev) => {
          let nextIndex = prev.activeFrameIndex + framesToAdvance;
          if (nextIndex >= prev.frames.length) {
            if (isLooping) {
              nextIndex = nextIndex % prev.frames.length;
              if (prev.audioTrack) {
                audioManager.play(0, prev.audioTrack.volume);
              }
            } else {
              setIsPlaying(false);
              return { ...prev, activeFrameIndex: prev.frames.length - 1 };
            }
          }
          return { ...prev, activeFrameIndex: nextIndex };
        });
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioManager.stop();
    };
  }, [isPlaying, project.fps, isLooping, project.audioTrack]);

  // Frame operations with History snapshotting
  const handleCommitCel = (celDataUrl: string) => {
    history.push(project, 'Draw on cel');

    setProject((prev) => {
      const newFrames = [...prev.frames];
      const curFrame = { ...newFrames[prev.activeFrameIndex] };
      curFrame.cels = { ...curFrame.cels, [prev.activeLayerId]: celDataUrl };
      newFrames[prev.activeFrameIndex] = curFrame;

      const updatedProj = { ...prev, frames: newFrames };
      // Regenerate thumbnail
      updateThumbnailForFrame(prev.activeFrameIndex, updatedProj);
      return updatedProj;
    });
  };

  const handleClearFrame = () => {
    history.push(project, 'Clear frame');
    setProject((prev) => {
      const newFrames = [...prev.frames];
      const curFrame = { ...newFrames[prev.activeFrameIndex] };
      const newCels = { ...curFrame.cels };
      delete newCels[prev.activeLayerId];
      curFrame.cels = newCels;
      newFrames[prev.activeFrameIndex] = curFrame;

      const updatedProj = { ...prev, frames: newFrames };
      updateThumbnailForFrame(prev.activeFrameIndex, updatedProj);
      return updatedProj;
    });
  };

  const handleAddFrame = () => {
    history.push(project, 'Add Frame');
    setProject((prev) => {
      const newFrameId = 'frame_' + Math.random().toString(36).substring(2, 9);
      const newFrame: Frame = {
        id: newFrameId,
        order: prev.frames.length,
        duration: 1,
        cels: {},
      };
      const nextIndex = prev.activeFrameIndex + 1;
      const newFrames = [...prev.frames];
      newFrames.splice(nextIndex, 0, newFrame);

      return {
        ...prev,
        frames: newFrames,
        activeFrameIndex: nextIndex,
      };
    });
  };

  const handleDuplicateFrame = () => {
    history.push(project, 'Duplicate Frame');
    setProject((prev) => {
      const currentFrame = prev.frames[prev.activeFrameIndex];
      const duplicateFrame: Frame = {
        id: 'frame_' + Math.random().toString(36).substring(2, 9),
        order: prev.frames.length,
        duration: 1,
        cels: { ...currentFrame.cels },
        thumbnailUrl: currentFrame.thumbnailUrl,
      };
      const nextIndex = prev.activeFrameIndex + 1;
      const newFrames = [...prev.frames];
      newFrames.splice(nextIndex, 0, duplicateFrame);

      return {
        ...prev,
        frames: newFrames,
        activeFrameIndex: nextIndex,
      };
    });
  };

  const handleDeleteFrame = () => {
    if (project.frames.length <= 1) return;
    history.push(project, 'Delete Frame');
    setProject((prev) => {
      const newFrames = prev.frames.filter((_, idx) => idx !== prev.activeFrameIndex);
      const nextIndex = Math.max(0, Math.min(prev.activeFrameIndex, newFrames.length - 1));
      return {
        ...prev,
        frames: newFrames,
        activeFrameIndex: nextIndex,
      };
    });
  };

  const handleSelectFrame = (index: number) => {
    if (isPlaying) setIsPlaying(false);
    setProject((prev) => ({
      ...prev,
      activeFrameIndex: Math.max(0, Math.min(index, prev.frames.length - 1)),
    }));
    if (project.audioTrack) {
      audioManager.seek(index / project.fps, project.audioTrack.volume);
    }
  };

  const handleFirstFrame = () => handleSelectFrame(0);
  const handleLastFrame = () => handleSelectFrame(project.frames.length - 1);

  const handleMoveFrame = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= project.frames.length) return;
    history.push(project, 'Reorder Frame');
    setProject((prev) => {
      const newFrames = [...prev.frames];
      const [moved] = newFrames.splice(fromIndex, 1);
      newFrames.splice(toIndex, 0, moved);
      return {
        ...prev,
        frames: newFrames,
        activeFrameIndex: toIndex,
      };
    });
  };

  // Layer operations
  const handleAddLayer = () => {
    history.push(project, 'Add Layer');
    setProject((prev) => {
      const id = 'layer_' + Math.random().toString(36).substring(2, 9);
      const newLayer: Layer = {
        id,
        name: `Layer ${prev.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1.0,
      };
      return {
        ...prev,
        layers: [...prev.layers, newLayer],
        activeLayerId: id,
      };
    });
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    }));
  };

  const handleToggleLayerLock = (layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)),
    }));
  };

  const handleDuplicateLayer = (layerId: string) => {
    history.push(project, 'Duplicate Layer');
    setProject((prev) => {
      const sourceLayer = prev.layers.find((l) => l.id === layerId);
      if (!sourceLayer) return prev;

      const newId = 'layer_' + Math.random().toString(36).substring(2, 9);
      const newLayer: Layer = {
        ...sourceLayer,
        id: newId,
        name: `${sourceLayer.name} Copy`,
      };

      // Clone cels in all frames
      const newFrames = prev.frames.map((frame) => {
        const cel = frame.cels[layerId];
        return cel ? { ...frame, cels: { ...frame.cels, [newId]: cel } } : frame;
      });

      return {
        ...prev,
        layers: [...prev.layers, newLayer],
        frames: newFrames,
        activeLayerId: newId,
      };
    });
  };

  const handleDeleteLayer = (layerId: string) => {
    if (project.layers.length <= 1) return;
    history.push(project, 'Delete Layer');
    setProject((prev) => {
      const remainingLayers = prev.layers.filter((l) => l.id !== layerId);
      const newActiveId =
        prev.activeLayerId === layerId ? remainingLayers[0].id : prev.activeLayerId;

      // Completely purge deleted layer cel data across ALL frames in the timeline
      const cleanedFrames = prev.frames.map((frame) => {
        if (!frame.cels[layerId]) return frame;
        const newCels = { ...frame.cels };
        delete newCels[layerId];
        return {
          ...frame,
          cels: newCels,
        };
      });

      const updatedProj: Project = {
        ...prev,
        layers: remainingLayers,
        frames: cleanedFrames,
        activeLayerId: newActiveId,
      };

      // Regenerate thumbnails across ALL frames in the timeline to completely purge lingering artwork
      Promise.all(
        cleanedFrames.map((frame, idx) =>
          generateFrameThumbnail(
            frame,
            remainingLayers,
            updatedProj.width,
            updatedProj.height,
            updatedProj.backgroundColor
          ).then((thumbUrl) => ({ idx, thumbUrl }))
        )
      ).then((thumbs) => {
        setProject((current) => {
          const reThumbed = [...current.frames];
          thumbs.forEach(({ idx, thumbUrl }) => {
            if (reThumbed[idx]) {
              reThumbed[idx] = { ...reThumbed[idx], thumbnailUrl: thumbUrl };
            }
          });
          return { ...current, frames: reThumbed };
        });
      });

      return updatedProj;
    });
  };

  const handleReorderLayer = (layerId: string, direction: 'up' | 'down') => {
    history.push(project, direction === 'up' ? 'Move Layer Up' : 'Move Layer Down');
    setProject((prev) => {
      const currentIndex = prev.layers.findIndex((l) => l.id === layerId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
      if (targetIndex < 0 || targetIndex >= prev.layers.length) return prev;

      const newLayers = [...prev.layers];
      const [movedLayer] = newLayers.splice(currentIndex, 1);
      newLayers.splice(targetIndex, 0, movedLayer);

      const updatedProj: Project = {
        ...prev,
        layers: newLayers,
      };

      // Regenerate thumbnail with new layer hierarchy order
      updateThumbnailForFrame(prev.activeFrameIndex, updatedProj);

      return updatedProj;
    });
  };

  const handleRenameLayer = (layerId: string, name: string) => {
    setProject((prev) => {
      const targetLayer = prev.layers.find((l) => l.id === layerId);
      // Strictly guard against renaming locked layers
      if (targetLayer?.locked) return prev;

      return {
        ...prev,
        layers: prev.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
      };
    });
  };

  const handleUpdateLayerOpacity = (layerId: string, opacity: number) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, opacity } : l)),
    }));
  };

  // Undo / Redo
  const handleUndo = () => {
    const prevState = history.undo(project);
    if (prevState) {
      setProject((prev) => ({
        ...prev,
        frames: prevState.frames,
        layers: prevState.layers,
        activeFrameIndex: prevState.activeFrameIndex,
        activeLayerId: prevState.activeLayerId,
      }));
    }
  };

  const handleRedo = () => {
    const nextState = history.redo(project);
    if (nextState) {
      setProject((prev) => ({
        ...prev,
        frames: nextState.frames,
        layers: nextState.layers,
        activeFrameIndex: nextState.activeFrameIndex,
        activeLayerId: nextState.activeLayerId,
      }));
    }
  };

  // Audio loading
  const handleLoadAudioFile = async (file: File) => {
    try {
      const audioTrack = await audioManager.loadAudioFile(file);
      setProject((prev) => ({ ...prev, audioTrack }));
    } catch (e) {
      console.error('Failed to load audio file:', e);
      alert('Unable to load audio file. Please check file format.');
    }
  };

  const handleRemoveAudio = () => {
    audioManager.stop();
    setProject((prev) => ({ ...prev, audioTrack: null }));
  };

  // Image import (onto canvas with interactive scale, rotate, and move transformations)
  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Also add to stamps asset library
        setProject((prev) => ({
          ...prev,
          stamps: [
            ...prev.stamps,
            {
              id: 'stamp_' + Math.random().toString(36).substring(2, 9),
              name: file.name,
              dataUrl,
              width: img.width,
              height: img.height,
            },
          ],
        }));

        // Send to CanvasViewport to immediately initiate interactive Scale, Rotate & Move Transform
        setPendingImportAsset({
          dataUrl,
          width: img.width,
          height: img.height,
        });
        setActiveTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleAddStamp = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const newStampId =
          'stamp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const w = Math.max(16, img.naturalWidth || img.width || 128);
        const h = Math.max(16, img.naturalHeight || img.height || 128);

        // Convert into clean off-screen canvas stamp pattern
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const oCtx = offCanvas.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(img, 0, 0, w, h);
        }
        const cleanDataUrl = offCanvas.toDataURL('image/png');

        setProject((prev) => ({
          ...prev,
          stamps: [
            ...prev.stamps,
            {
              id: newStampId,
              name: file.name.replace(/\.[^/.]+$/, ''),
              dataUrl: cleanDataUrl,
              width: w,
              height: h,
            },
          ],
        }));

        setBrushSettings((prev) => ({
          ...prev,
          selectedStampId: newStampId,
          brushStyle: 'image-stamp',
        }));

        setActiveTool('stamp');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Open existing project from Dashboard
  const handleOpenProject = async (projectId: string) => {
    if (document.body) {
      document.body.style.cursor = 'default';
      document.body.style.pointerEvents = 'auto';
    }
    const proj = await getProjectFromDB(projectId);
    if (proj) {
      if (!proj.stamps || proj.stamps.length === 0) {
        proj.stamps = [...DEFAULT_STAMPS];
      }
      setProject(proj);
      if (proj.audioTrack) {
        audioManager.loadFromDataUrl(proj.audioTrack.dataUrl, proj.audioTrack.name);
      } else {
        audioManager.stop();
      }
      history.clear();
      setActiveTool('brush');
      setBrushSettings((prev) => ({ ...prev, activeShape: 'rect' }));
      setCurrentView('workspace');
    }
  };

  // Back to Dashboard from TopToolbar 2Draw Studio logo
  const handleGoToDashboard = async () => {
    setSaveStatus('saving');
    await saveProjectToDB(project);
    setSaveStatus('saved');
    setIsPlaying(false);
    audioManager.stop();
    setCurrentView('dashboard');
  };

  // Handle project deleted on Dashboard
  const handleDeleteProjectFromDashboard = (deletedId: string) => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (project.id === deletedId) {
      const freshStarter = createDefaultProject(800, 600, 12, 'white', 'Neon Bounce Loop // Starter');
      setProject(freshStarter);
    }
  };

  // Create project from modal
  const handleCreateProject = async (
    width: number,
    height: number,
    fps: number,
    bgColor: string,
    name: string
  ) => {
    history.clear();
    const newProject = createDefaultProject(width, height, fps, bgColor, name);
    await saveProjectToDB(newProject);
    setProject(newProject);
    setActiveTool('brush');
    setBrushSettings((prev) => ({ ...prev, activeShape: 'rect' }));
    setIsNewModalOpen(false);
    setCurrentView('workspace');
  };

  // Import / Export native .2draw project
  const handleImportProjectFile = async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseProjectFile(text);
      if (!imported.stamps || imported.stamps.length === 0) {
        imported.stamps = [...DEFAULT_STAMPS];
      }
      history.clear();
      await saveProjectToDB(imported);
      setProject(imported);
      if (imported.audioTrack) {
        audioManager.loadFromDataUrl(imported.audioTrack.dataUrl, imported.audioTrack.name);
      } else {
        audioManager.stop();
      }
      setCurrentView('workspace');
    } catch (e) {
      console.error(e);
      alert('Could not open file. Invalid 2Draw project format.');
    } finally {
      if (document.body) {
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
      }
    }
  };

  // Global Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger workspace shortcuts if on Dashboard
      if (currentView !== 'workspace') return;

      // Don't trigger if user is typing in form controls
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if (isNewModalOpen || isExportModalOpen || isColorPickerOpen || isShortcutsOpen) {
        if (e.key === 'Escape') {
          setIsNewModalOpen(false);
          setIsExportModalOpen(false);
          setIsColorPickerOpen(false);
          setIsShortcutsOpen(false);
        }
        return;
      }

      // Space key hold for Temporary Hand / Pan mode
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat && spacePressTimeRef.current === null) {
          spacePressTimeRef.current = Date.now();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          exportProjectToFile(project);
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case 'b':
          setActiveTool('brush');
          break;
        case 'p':
          setActiveTool('pencil');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 'f':
          setActiveTool('fill');
          break;
        case 'h':
          setActiveTool('pan');
          break;
        case 'u':
          setActiveTool(brushSettings.activeShape || 'rect');
          break;
        case 'i':
          setActiveTool('eyedropper');
          break;
        case 'v':
          setActiveTool('select');
          break;
        case 's':
          setActiveTool('stamp');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'r':
          setBrushSettings((prev) => ({ ...prev, activeShape: 'rect' }));
          setActiveTool('rect');
          break;
        case 'l':
          setBrushSettings((prev) => ({ ...prev, activeShape: 'line' }));
          setActiveTool('line');
          break;
        case 'o':
          setBrushSettings((prev) => ({ ...prev, activeShape: 'ellipse' }));
          setActiveTool('ellipse');
          break;
        case 'a':
          setBrushSettings((prev) => ({ ...prev, activeShape: 'arrow' }));
          setActiveTool('arrow');
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSelectFrame(project.activeFrameIndex - 1);
          break;
        case 'arrowright':
          e.preventDefault();
          handleSelectFrame(project.activeFrameIndex + 1);
          break;
        case 'delete':
        case 'backspace':
          handleDeleteFrame();
          break;
        case '+':
        case '=':
          setTransform((prev) => ({ ...prev, zoom: Math.min(4, prev.zoom + 0.15) }));
          break;
        case '-':
        case '_':
          setTransform((prev) => ({ ...prev, zoom: Math.max(0.2, prev.zoom - 0.15) }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (currentView !== 'workspace') return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (spacePressTimeRef.current !== null) {
          const heldDuration = Date.now() - spacePressTimeRef.current;
          spacePressTimeRef.current = null;
          // Quick tap (< 250ms) toggles play/pause; longer hold was Temporary Hand/Pan
          if (heldDuration < 250) {
            setIsPlaying((prev) => !prev);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    project,
    currentView,
    brushSettings.activeShape,
    handleUndo,
    handleRedo,
    handleSelectFrame,
    handleDeleteFrame,
    isNewModalOpen,
    isExportModalOpen,
    isColorPickerOpen,
    isShortcutsOpen,
  ]);

  // 1. DASHBOARD VIEW (Default on launch)
  if (currentView === 'dashboard') {
    return (
      <>
        <ProjectDashboard
          onOpenProject={handleOpenProject}
          onNewProject={() => setIsNewModalOpen(true)}
          onImportProjectFile={handleImportProjectFile}
          onDeleteProject={handleDeleteProjectFromDashboard}
        />

        {/* Modal for creating a new project from Dashboard */}
        <NewProjectModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={handleCreateProject}
        />
      </>
    );
  }

  // 2. MAIN 2DRAW WORKSPACE VIEW
  return (
    <div className="flex flex-col h-screen w-screen bg-[#DDE1E7] overflow-hidden select-none">
      {/* Top Toolbar */}
      <TopToolbar
        project={project}
        onGoToDashboard={handleGoToDashboard}
        onNewProject={() => setIsNewModalOpen(true)}
        onImportImage={handleImportImage}
        onImportProjectFile={handleImportProjectFile}
        onExportProjectFile={() => exportProjectToFile(project)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        onClearFrame={handleClearFrame}
        onUpdateFPS={(fps) => setProject((prev) => ({ ...prev, fps }))}
        onUpdateProjectName={(name) => setProject((prev) => ({ ...prev, name }))}
        saveStatus={saveStatus}
      />

      {/* Main Workspace (Left Tools + Center Canvas + Right Inspector) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <LeftToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          currentColor={brushSettings.color}
          onOpenColorPicker={() => setIsColorPickerOpen(true)}
          brushSettings={brushSettings}
          setBrushSettings={setBrushSettings}
          stamps={project.stamps}
          onUploadCustomBrush={handleAddStamp}
        />

        {/* Center Drawing Canvas */}
        <CanvasViewport
          project={project}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          brushSettings={brushSettings}
          transform={transform}
          setTransform={setTransform}
          onCommitCel={handleCommitCel}
          onColorPick={(color) => setBrushSettings((prev) => ({ ...prev, color }))}
          onUpdateOnionSkin={(onionSkin) =>
            setProject((prev) => ({ ...prev, onionSkin }))
          }
          isPlaying={isPlaying}
          pendingImportAsset={pendingImportAsset}
          onClearPendingImport={() => setPendingImportAsset(null)}
        />

        {/* Right Inspector */}
        <RightInspector
          project={project}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          brushSettings={brushSettings}
          setBrushSettings={setBrushSettings}
          onAddLayer={handleAddLayer}
          onSelectLayer={(id) => setProject((prev) => ({ ...prev, activeLayerId: id }))}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onToggleLayerLock={handleToggleLayerLock}
          onDuplicateLayer={handleDuplicateLayer}
          onDeleteLayer={handleDeleteLayer}
          onRenameLayer={handleRenameLayer}
          onReorderLayer={handleReorderLayer}
          onUpdateLayerOpacity={handleUpdateLayerOpacity}
          onLoadAudioFile={handleLoadAudioFile}
          onRemoveAudio={handleRemoveAudio}
          onAddStamp={handleAddStamp}
        />
      </div>

      {/* Bottom Timeline & Playback */}
      <BottomTimeline
        project={project}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSelectFrame={handleSelectFrame}
        onAddFrame={handleAddFrame}
        onDuplicateFrame={handleDuplicateFrame}
        onDeleteFrame={handleDeleteFrame}
        onFirstFrame={handleFirstFrame}
        onLastFrame={handleLastFrame}
        onMoveFrame={handleMoveFrame}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
      />

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={project}
      />

      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        currentColor={brushSettings.color}
        onSelectColor={(color) => setBrushSettings((prev) => ({ ...prev, color }))}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
