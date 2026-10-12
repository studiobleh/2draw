import { Project } from '../types';

export interface HistorySnapshot {
  frames: Project['frames'];
  layers: Project['layers'];
  activeFrameIndex: number;
  activeLayerId: string;
  description: string;
}

export class HistoryManager {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private maxStates = 30;

  push(project: Project, description: string) {
    // Deep clone frames and layers
    const snapshot: HistorySnapshot = {
      frames: JSON.parse(JSON.stringify(project.frames)),
      layers: JSON.parse(JSON.stringify(project.layers)),
      activeFrameIndex: project.activeFrameIndex,
      activeLayerId: project.activeLayerId,
      description,
    };

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(currentProject: Project): HistorySnapshot | null {
    if (this.undoStack.length === 0) return null;

    // Save current state into redo stack
    const currentSnapshot: HistorySnapshot = {
      frames: JSON.parse(JSON.stringify(currentProject.frames)),
      layers: JSON.parse(JSON.stringify(currentProject.layers)),
      activeFrameIndex: currentProject.activeFrameIndex,
      activeLayerId: currentProject.activeLayerId,
      description: 'Current State',
    };
    this.redoStack.push(currentSnapshot);

    const prev = this.undoStack.pop()!;
    return prev;
  }

  redo(currentProject: Project): HistorySnapshot | null {
    if (this.redoStack.length === 0) return null;

    const currentSnapshot: HistorySnapshot = {
      frames: JSON.parse(JSON.stringify(currentProject.frames)),
      layers: JSON.parse(JSON.stringify(currentProject.layers)),
      activeFrameIndex: currentProject.activeFrameIndex,
      activeLayerId: currentProject.activeLayerId,
      description: 'Current State',
    };
    this.undoStack.push(currentSnapshot);

    const next = this.redoStack.pop()!;
    return next;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
