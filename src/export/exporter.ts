import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { Project, ExportProgress } from '../types';
import { renderFrameToCanvas } from '../engine/frameRenderer';
import { audioManager } from '../audio/audioManager';

export async function exportToWebM(
  project: Project,
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress({ status: 'rendering', progress: 5, message: 'Preparing canvas...' });

  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d')!;

  const fps = Math.max(1, project.fps || 12);
  const stream = canvas.captureStream(fps);

  // Audio track synchronization if available
  const audioBuffer = audioManager.getCurrentAudioBuffer();
  if (project.audioTrack && audioBuffer) {
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.start(0);

      dest.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });
    } catch (e) {
      console.warn('Could not attach audio track to WebM stream:', e);
    }
  }

  // Determine supported mime type
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4000000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise<Blob>(async (resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onProgress({ status: 'done', progress: 100, message: 'WebM export complete!' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      reject((e as unknown as { error: Error }).error || new Error('MediaRecorder error'));
    };

    recorder.start();

    // Render frames sequentially
    const frameDurationMs = 1000 / fps;
    const totalFrames = project.frames.length;

    // Render loop
    for (let i = 0; i < totalFrames; i++) {
      const frame = project.frames[i];
      await renderFrameToCanvas(
        frame,
        project.layers,
        project.width,
        project.height,
        project.backgroundColor,
        canvas,
        true
      );

      const pct = Math.round(((i + 1) / totalFrames) * 90);
      onProgress({
        status: 'rendering',
        progress: pct,
        message: `Rendering frame ${i + 1} of ${totalFrames}...`,
      });

      // Wait for exact frame interval
      await new Promise((r) => setTimeout(r, frameDurationMs));
    }

    // Add extra hold time on last frame for video container sync
    await new Promise((r) => setTimeout(r, frameDurationMs * 2));
    onProgress({ status: 'encoding', progress: 95, message: 'Finalizing video stream...' });
    recorder.stop();
  });
}

export async function exportToGIF(
  project: Project,
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress({ status: 'rendering', progress: 5, message: 'Initializing GIF encoder...' });

  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const gif = GIFEncoder();
  const fps = Math.max(1, project.fps || 12);
  const delayMs = Math.round(1000 / fps);
  const totalFrames = project.frames.length;

  for (let i = 0; i < totalFrames; i++) {
    const frame = project.frames[i];
    await renderFrameToCanvas(
      frame,
      project.layers,
      project.width,
      project.height,
      project.backgroundColor,
      canvas,
      true
    );

    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const { data } = imgData;

    // Quantize 256 colors
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, project.width, project.height, {
      palette,
      delay: delayMs,
      repeat: 0,
    });

    const pct = Math.round(((i + 1) / totalFrames) * 90);
    onProgress({
      status: 'encoding',
      progress: pct,
      message: `Encoding GIF frame ${i + 1} of ${totalFrames}...`,
    });

    // Yield main thread
    await new Promise((r) => setTimeout(r, 4));
  }

  gif.finish();
  const buffer = gif.bytes();
  const blob = new Blob([buffer as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
  onProgress({ status: 'done', progress: 100, message: 'GIF export complete!' });
  return blob;
}

export async function exportToZip(
  project: Project,
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress({ status: 'rendering', progress: 5, message: 'Preparing ZIP archive...' });

  const zip = new JSZip();
  const folder = zip.folder('frames')!;
  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;

  const totalFrames = project.frames.length;

  for (let i = 0; i < totalFrames; i++) {
    const frame = project.frames[i];
    await renderFrameToCanvas(
      frame,
      project.layers,
      project.width,
      project.height,
      project.backgroundColor,
      canvas,
      project.backgroundColor !== 'transparent'
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );

    if (blob) {
      const paddedIndex = String(i + 1).padStart(4, '0');
      folder.file(`frame_${paddedIndex}.png`, blob);
    }

    const pct = Math.round(((i + 1) / totalFrames) * 85);
    onProgress({
      status: 'rendering',
      progress: pct,
      message: `Rendering PNG frame ${i + 1} of ${totalFrames}...`,
    });
  }

  // Include project metadata manifest
  const manifest = {
    appName: '2Draw Animation Studio',
    projectName: project.name,
    width: project.width,
    height: project.height,
    fps: project.fps,
    totalFrames,
    backgroundColor: project.backgroundColor,
    exportedAt: new Date().toISOString(),
  };
  zip.file('project-manifest.json', JSON.stringify(manifest, null, 2));

  onProgress({ status: 'encoding', progress: 90, message: 'Compressing ZIP package...' });
  const content = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      onProgress({
        status: 'encoding',
        progress: 90 + Math.round(metadata.percent * 0.1),
        message: `Compressing package: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  onProgress({ status: 'done', progress: 100, message: 'PNG Frame ZIP complete!' });
  return content;
}

export async function exportToSpriteSheet(
  project: Project,
  onProgress: (p: ExportProgress) => void,
  customColumns?: number
): Promise<Blob> {
  onProgress({ status: 'rendering', progress: 5, message: 'Calculating sprite sheet dimensions...' });

  const totalFrames = project.frames.length;
  // Compute optimal grid layout (square or up to 8 cols)
  const columns = customColumns || Math.min(8, Math.max(1, Math.ceil(Math.sqrt(totalFrames))));
  const rows = Math.ceil(totalFrames / columns);

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = columns * project.width;
  sheetCanvas.height = rows * project.height;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) throw new Error('Could not create sprite sheet canvas context');

  // Background
  if (project.backgroundColor && project.backgroundColor !== 'transparent') {
    sheetCtx.fillStyle =
      project.backgroundColor === 'white'
        ? '#FFFFFF'
        : project.backgroundColor === 'black'
        ? '#000000'
        : project.backgroundColor;
    sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  }

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = project.width;
  frameCanvas.height = project.height;

  for (let i = 0; i < totalFrames; i++) {
    const frame = project.frames[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const destX = col * project.width;
    const destY = row * project.height;

    await renderFrameToCanvas(
      frame,
      project.layers,
      project.width,
      project.height,
      project.backgroundColor,
      frameCanvas,
      project.backgroundColor !== 'transparent'
    );

    sheetCtx.drawImage(frameCanvas, destX, destY);

    const pct = Math.round(((i + 1) / totalFrames) * 90);
    onProgress({
      status: 'rendering',
      progress: pct,
      message: `Packing frame ${i + 1} of ${totalFrames} into sprite sheet...`,
    });
  }

  onProgress({ status: 'encoding', progress: 95, message: 'Encoding PNG sprite sheet...' });

  return new Promise<Blob>((resolve, reject) => {
    sheetCanvas.toBlob((blob) => {
      if (blob) {
        onProgress({ status: 'done', progress: 100, message: 'Sprite Sheet export complete!' });
        resolve(blob);
      } else {
        reject(new Error('Failed to create sprite sheet blob'));
      }
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
