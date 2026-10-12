import { Project, ProjectSummary } from '../types';
import { DEFAULT_STAMPS } from '../constants/defaultStamps';

const DB_NAME = '2draw_animation_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const ACTIVE_PROJECT_KEY = '2draw_active_project_id';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectToDB(project: Project): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ ...project, updatedAt: Date.now() });
      req.onsuccess = () => {
        try {
          localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
        } catch {
          // ignore localStorage errors
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
  }
}

export async function getProjectFromDB(id: string): Promise<Project | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const proj = req.result as Project | null;
        if (proj && (!proj.stamps || proj.stamps.length === 0)) {
          proj.stamps = [...DEFAULT_STAMPS];
        }
        resolve(proj || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get project from IndexedDB:', err);
    return null;
  }
}

export async function getAllProjectsFromDB(): Promise<Array<ProjectSummary>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = req.result as Project[];
        const list: ProjectSummary[] = raw.map((p) => {
          // Find thumbnail from active frame, last frame, or first frame with a thumbnail/cel
          const lastFrame = p.frames && p.frames[p.frames.length - 1];
          const activeFrame = p.frames && (p.frames[p.activeFrameIndex] || p.frames[0]);
          let thumb = activeFrame?.thumbnailUrl || lastFrame?.thumbnailUrl || p.frames?.[0]?.thumbnailUrl;
          if (!thumb && activeFrame?.cels) {
            const firstCel = Object.values(activeFrame.cels)[0];
            if (firstCel) thumb = firstCel;
          }

          return {
            id: p.id,
            name: p.name || 'Untitled Animation',
            updatedAt: p.updatedAt || p.createdAt || Date.now(),
            createdAt: p.createdAt || p.updatedAt || Date.now(),
            width: p.width || 800,
            height: p.height || 600,
            fps: p.fps || 12,
            framesCount: p.frames?.length || 1,
            thumbnailUrl: thumb || '',
          };
        });
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteProjectFromDB(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      
      let isDone = false;
      const finish = () => {
        if (isDone) return;
        isDone = true;
        try {
          const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
          if (activeId === id) {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
          }
        } catch {
          // ignore localStorage error
        }
        resolve(true);
      };

      tx.oncomplete = finish;
      req.onsuccess = () => {
        // Fallback if tx.oncomplete does not immediately fire
        setTimeout(finish, 10);
      };
      tx.onerror = () => reject(tx.error);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete project:', err);
    return false;
  }
}

export async function duplicateProjectInDB(id: string): Promise<Project | null> {
  try {
    const original = await getProjectFromDB(id);
    if (!original) return null;

    const newId = 'proj_' + Math.random().toString(36).substring(2, 9);
    const duplicated: Project = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveProjectToDB(duplicated);
    return duplicated;
  } catch (err) {
    console.error('Failed to duplicate project:', err);
    return null;
  }
}

export async function renameProjectInDB(id: string, newName: string): Promise<void> {
  try {
    const proj = await getProjectFromDB(id);
    if (!proj) return;
    proj.name = newName;
    proj.updatedAt = Date.now();
    await saveProjectToDB(proj);
  } catch (err) {
    console.error('Failed to rename project:', err);
  }
}

export async function getLatestProject(): Promise<Project | null> {
  try {
    const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (activeId) {
      const proj = await getProjectFromDB(activeId);
      if (proj) {
        if (!proj.stamps || proj.stamps.length === 0) {
          proj.stamps = [...DEFAULT_STAMPS];
        }
        return proj;
      }
    }
    const all = await getAllProjectsFromDB();
    if (all.length > 0) {
      const proj = await getProjectFromDB(all[0].id);
      if (proj) {
        if (!proj.stamps || proj.stamps.length === 0) {
          proj.stamps = [...DEFAULT_STAMPS];
        }
        return proj;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export function createDefaultProject(
  width = 800,
  height = 600,
  fps = 12,
  backgroundColor = 'white',
  name = 'Untitled Animation'
): Project {
  const layer1Id = 'layer_' + Math.random().toString(36).substring(2, 9);
  const frame1Id = 'frame_' + Math.random().toString(36).substring(2, 9);

  return {
    id: 'proj_' + Math.random().toString(36).substring(2, 9),
    name,
    width,
    height,
    fps,
    backgroundColor,
    layers: [
      {
        id: layer1Id,
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1.0,
      },
    ],
    frames: [
      {
        id: frame1Id,
        order: 0,
        duration: 1,
        cels: {},
      },
    ],
    activeFrameIndex: 0,
    activeLayerId: layer1Id,
    onionSkin: {
      enabled: false,
      prevFrames: 1,
      nextFrames: 1,
      opacity: 0.35,
      prevColor: '#FF5F38',
      nextColor: '#00E5F0',
    },
    audioTrack: null,
    stamps: [...DEFAULT_STAMPS],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Native Project Export / Import as .2draw JSON file
export interface ProjectArchiveFile {
  format: '2draw';
  version: 1;
  generator: '2Draw Animation Studio';
  exportedAt: number;
  project: Project;
}

export function exportProjectToFile(project: Project) {
  // Ensure the active project has at least one thumbnail if cels exist
  const frames = project.frames.map((frame, idx) => {
    let thumb = frame.thumbnailUrl;
    if (!thumb && frame.cels) {
      const firstCel = Object.values(frame.cels)[0];
      if (firstCel) thumb = firstCel;
    }
    return {
      ...frame,
      thumbnailUrl: thumb,
    };
  });

  const archive: ProjectArchiveFile = {
    format: '2draw',
    version: 1,
    generator: '2Draw Animation Studio',
    exportedAt: Date.now(),
    project: {
      ...project,
      frames,
      updatedAt: Date.now(),
    },
  };
  const data = JSON.stringify(archive, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (project.name || 'untitled_animation')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  a.download = `${safeName}.2draw`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProjectFile(fileContent: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid .2draw file: Corrupted or non-JSON data');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid .2draw file format: Root JSON object missing');
  }

  // Handle both structured { format: '2draw', project: {...} } and direct Project objects
  const rawProject =
    'project' in parsed && typeof (parsed as { project: unknown }).project === 'object' && (parsed as { project: unknown }).project !== null
      ? (parsed as { project: Record<string, unknown> }).project
      : (parsed as Record<string, unknown>);

  if (!rawProject || typeof rawProject !== 'object') {
    throw new Error('Invalid .2draw project archive: Project payload missing or corrupted');
  }

  const width = Number(rawProject.width);
  const height = Number(rawProject.height);
  if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
    throw new Error('Invalid .2draw project: Dimensions (width/height) missing or invalid');
  }

  if (!Array.isArray(rawProject.layers) || rawProject.layers.length === 0) {
    throw new Error('Invalid .2draw project: Layers definition missing or empty');
  }

  if (!Array.isArray(rawProject.frames) || rawProject.frames.length === 0) {
    throw new Error('Invalid .2draw project: Frames definition missing or empty');
  }

  // Validate & sanitize layers
  const layers = (rawProject.layers as Array<Record<string, unknown>>).map((l, idx) => ({
    id: typeof l.id === 'string' && l.id ? l.id : `layer_${idx}_${Math.random().toString(36).substring(2, 7)}`,
    name: typeof l.name === 'string' && l.name ? l.name : `Layer ${idx + 1}`,
    visible: l.visible !== false,
    locked: Boolean(l.locked),
    opacity: typeof l.opacity === 'number' && !isNaN(l.opacity) ? Math.max(0, Math.min(1, l.opacity)) : 1.0,
  }));

  // Validate & sanitize frames and base64 cels
  const frames = (rawProject.frames as Array<Record<string, unknown>>).map((f, idx) => {
    const rawCels = f.cels && typeof f.cels === 'object' ? (f.cels as Record<string, unknown>) : {};
    const sanitizedCels: Record<string, string> = {};
    for (const [layerId, celVal] of Object.entries(rawCels)) {
      if (typeof celVal === 'string' && celVal.startsWith('data:')) {
        sanitizedCels[layerId] = celVal;
      } else if (typeof celVal === 'string') {
        sanitizedCels[layerId] = celVal;
      }
    }

    let thumb = typeof f.thumbnailUrl === 'string' ? f.thumbnailUrl : undefined;
    if (!thumb) {
      const firstCel = Object.values(sanitizedCels)[0];
      if (firstCel) thumb = firstCel;
    }

    return {
      id: typeof f.id === 'string' && f.id ? f.id : `frame_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      order: typeof f.order === 'number' ? f.order : idx,
      duration: typeof f.duration === 'number' && f.duration >= 1 ? Math.round(f.duration) : 1,
      cels: sanitizedCels,
      thumbnailUrl: thumb,
    };
  });

  // Validate & sanitize audioTrack
  let audioTrack = null;
  if (rawProject.audioTrack && typeof rawProject.audioTrack === 'object') {
    const a = rawProject.audioTrack as Record<string, unknown>;
    if (typeof a.dataUrl === 'string' && a.dataUrl) {
      audioTrack = {
        id: typeof a.id === 'string' ? a.id : `audio_${Date.now()}`,
        name: typeof a.name === 'string' ? a.name : 'Audio Track',
        duration: typeof a.duration === 'number' ? a.duration : 0,
        dataUrl: a.dataUrl,
        peaks: Array.isArray(a.peaks) ? (a.peaks as number[]) : [],
        offset: typeof a.offset === 'number' ? a.offset : 0,
        volume: typeof a.volume === 'number' ? Math.max(0, Math.min(1, a.volume)) : 1.0,
      };
    }
  }

  // Active indices
  const activeFrameIndex =
    typeof rawProject.activeFrameIndex === 'number'
      ? Math.max(0, Math.min(rawProject.activeFrameIndex, frames.length - 1))
      : 0;
  const activeLayerId =
    typeof rawProject.activeLayerId === 'string' && layers.some((l) => l.id === rawProject.activeLayerId)
      ? (rawProject.activeLayerId as string)
      : layers[0].id;

  const p = rawProject as Partial<Project>;

  return {
    id: typeof p.id === 'string' && p.id ? p.id : 'proj_' + Math.random().toString(36).substring(2, 9),
    name: typeof p.name === 'string' && p.name ? p.name : 'Imported Animation',
    width,
    height,
    fps: typeof p.fps === 'number' && p.fps > 0 ? Math.min(60, Math.max(1, p.fps)) : 12,
    backgroundColor: typeof p.backgroundColor === 'string' ? p.backgroundColor : 'white',
    layers,
    frames,
    activeFrameIndex,
    activeLayerId,
    onionSkin: p.onionSkin || {
      enabled: false,
      prevFrames: 1,
      nextFrames: 1,
      opacity: 0.35,
      prevColor: '#FF5F38',
      nextColor: '#00E5F0',
    },
    audioTrack,
    stamps: Array.isArray(p.stamps) && p.stamps.length > 0 ? p.stamps : [...DEFAULT_STAMPS],
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}
