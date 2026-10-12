export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type ToolType =
  | 'select'
  | 'brush'
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'stamp'
  | 'pan';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 to 1.0
}

export interface Frame {
  id: string;
  order: number;
  duration: number; // in frames (exposure, default 1)
  // layerId -> dataURL of canvas image
  cels: Record<string, string>;
  thumbnailUrl?: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  duration: number; // in seconds
  dataUrl: string; // base64 or blob url
  peaks: number[]; // normalized waveform peaks (0..1)
  offset: number; // in seconds
  volume: number; // 0..1
}

export interface OnionSkinSettings {
  enabled: boolean;
  prevFrames: number; // 1 to 3
  nextFrames: number; // 1 to 3
  opacity: number; // 0.1 to 0.8
  prevColor: string; // red/coral
  nextColor: string; // cyan
}

export interface StampAsset {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  backgroundColor: 'white' | 'transparent' | 'black' | string;
  layers: Layer[];
  frames: Frame[];
  activeFrameIndex: number;
  activeLayerId: string;
  onionSkin: OnionSkinSettings;
  audioTrack: AudioTrack | null;
  stamps: StampAsset[];
  createdAt: number;
  updatedAt: number;
}

export type BrushStyle =
  | 'solid-round'
  | 'flat-marker'
  | 'calligraphy'
  | 'airbrush'
  | 'image-stamp';

export type PencilTexture =
  | 'soft-2b'
  | 'hard-4h'
  | 'colored-pencil'
  | 'charcoal';

export interface SelectionTransform {
  isActive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  sourceCanvas: HTMLCanvasElement | null;
  originalX: number;
  originalY: number;
  originalWidth: number;
  originalHeight: number;
}

export type EraserShape = 'round' | 'square' | 'chisel';
export type ShapeType = 'line' | 'rect' | 'ellipse' | 'arrow';

export interface BrushSettings {
  size: number;
  opacity: number;
  color: string;
  tolerance: number; // for fill tool
  fillBleed: number; // expand/bleed pixels under outlines (0 to 4)
  brushStyle: BrushStyle;
  pencilTexture: PencilTexture;
  eraserSoftness: number; // 0 (crisp) to 1 (feathered soft)
  eraserShape: EraserShape;
  activeShape: ShapeType;
  selectedStampId?: string;
  stampSize: number;
  stampSpacing: number;
  stampRotation: number;
  stampDynamicRotation: boolean;
  stampTintWithColor?: boolean;
  fontSize: number;
  fontFamily: string;
  fontBold: boolean;
  fontItalic: boolean;
}

export interface ViewportTransform {
  zoom: number; // 0.25 to 5.0
  panX: number;
  panY: number;
}

export type ExportFormat = 'webm' | 'gif' | 'zip' | 'spritesheet';

export interface ExportProgress {
  status: 'idle' | 'rendering' | 'encoding' | 'done' | 'error';
  progress: number; // 0 to 100
  message: string;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  width: number;
  height: number;
  fps: number;
  framesCount: number;
  thumbnailUrl?: string;
}
