import React, { useState } from 'react';
import { Download, Video, FilePlay, Archive, LayoutGrid, Loader2, CheckCircle2, AlertCircle, FolderDown } from 'lucide-react';
import { Project, ExportFormat, ExportProgress } from '../types';
import { exportToWebM, exportToGIF, exportToZip, exportToSpriteSheet, downloadBlob } from '../export/exporter';
import { exportProjectToFile } from '../storage/db';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [progress, setProgress] = useState<ExportProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  if (!isOpen) return null;

  const handleExport = async (format: ExportFormat) => {
    try {
      const cleanName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      if (format === 'webm') {
        const blob = await exportToWebM(project, setProgress);
        downloadBlob(blob, `${cleanName}.webm`);
      } else if (format === 'gif') {
        const blob = await exportToGIF(project, setProgress);
        downloadBlob(blob, `${cleanName}.gif`);
      } else if (format === 'zip') {
        const blob = await exportToZip(project, setProgress);
        downloadBlob(blob, `${cleanName}_frames.zip`);
      } else if (format === 'spritesheet') {
        const blob = await exportToSpriteSheet(project, setProgress);
        downloadBlob(blob, `${cleanName}_spritesheet.png`);
      }
    } catch (err: unknown) {
      console.error('Export failed:', err);
      setProgress({
        status: 'error',
        progress: 0,
        message: 'Export failed: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  };

  const isBusy = progress.status === 'rendering' || progress.status === 'encoding';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-md p-6 select-none animate-in fade-in zoom-in-95 duration-100">
        {/* Header directly matching Reference 2 */}
        <div className="flex items-center justify-between pb-3 border-b-3 border-black">
          <h2 className="text-xl font-black uppercase tracking-wider text-black">
            EXPORT ANIMATION
          </h2>
          <Download className="w-6 h-6 text-black stroke-[2.5]" />
        </div>

        {/* Format Cards */}
        <div className="mt-5 space-y-3.5">
          {/* Card 1: WEBM VIDEO (Cyan) */}
          <button
            disabled={isBusy}
            onClick={() => handleExport('webm')}
            className="w-full brutal-btn bg-[#00E5F0] hover:bg-[#00d0dc] border-3 border-black p-3.5 flex items-center gap-4 text-left shadow-[4px_4px_0px_#000]"
          >
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <Video className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-black">
                WEBM VIDEO
              </div>
              <div className="text-xs font-bold text-black/80">
                Best quality animation video {project.audioTrack ? '(with audio)' : ''}
              </div>
            </div>
          </button>

          {/* Card 2: ANIMATED GIF (Yellow) */}
          <button
            disabled={isBusy}
            onClick={() => handleExport('gif')}
            className="w-full brutal-btn bg-[#FFE600] hover:bg-[#ebd400] border-3 border-black p-3.5 flex items-center gap-4 text-left shadow-[4px_4px_0px_#000]"
          >
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <FilePlay className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-black">
                ANIMATED GIF
              </div>
              <div className="text-xs font-bold text-black/80">
                Looping social media format
              </div>
            </div>
          </button>

          {/* Card 3: PNG FRAME ZIP (Purple) */}
          <button
            disabled={isBusy}
            onClick={() => handleExport('zip')}
            className="w-full brutal-btn bg-[#B65CE5] hover:bg-[#a54bd4] border-3 border-black p-3.5 flex items-center gap-4 text-left shadow-[4px_4px_0px_#000]"
          >
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <Archive className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-black">
                 PNG FRAME ZIP
              </div>
              <div className="text-xs font-bold text-black/90">
                Full transparent frame sequence
              </div>
            </div>
          </button>

          {/* Card 4: SPRITE SHEET (Vibrant Coral / Orange) */}
          <button
            disabled={isBusy}
            onClick={() => handleExport('spritesheet')}
            className="w-full brutal-btn bg-[#FF5F38] hover:bg-[#fa5128] border-3 border-black p-3.5 flex items-center gap-4 text-left shadow-[4px_4px_0px_#000]"
          >
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <LayoutGrid className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-white">
                SPRITE SHEET (PNG)
              </div>
              <div className="text-xs font-bold text-white/90">
                Packed grid atlas for 2D games & engines
              </div>
            </div>
          </button>

          {/* Card 5: PROJECT ARCHIVE (.2draw) */}
          <button
            disabled={isBusy}
            onClick={() => {
              try {
                exportProjectToFile(project);
                setProgress({
                  status: 'done',
                  progress: 100,
                  message: `Project archive (.2draw) downloaded successfully!`,
                });
              } catch (err: unknown) {
                console.error(err);
                setProgress({
                  status: 'error',
                  progress: 0,
                  message: 'Export failed: ' + (err instanceof Error ? err.message : String(err)),
                });
              }
            }}
            className="w-full brutal-btn bg-[#86EFAC] hover:bg-[#6ee7b7] border-3 border-black p-3.5 flex items-center gap-4 text-left shadow-[4px_4px_0px_#000]"
            title="Export native project archive (.2draw format)"
          >
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
              <FolderDown className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-black">
                PROJECT ARCHIVE (.2DRAW)
              </div>
              <div className="text-xs font-bold text-neutral-800">
                Full backup with layers, frames, audio & metadata
              </div>
            </div>
          </button>
        </div>

        {/* Progress Display */}
        {progress.status !== 'idle' && (
          <div className="mt-4 p-3 border-2 border-black bg-neutral-50 space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-1.5">
                {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {progress.status === 'done' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {progress.status === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                )}
                {progress.message}
              </span>
              <span className="tabular-nums">{progress.progress}%</span>
            </div>
            <div className="w-full h-3 border-2 border-black bg-white overflow-hidden">
              <div
                className="h-full bg-[#FFE600] transition-all duration-150"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Close Button directly matching Reference 2 */}
        <div className="mt-5">
          <button
            disabled={isBusy}
            onClick={onClose}
            className="w-full brutal-btn py-2.5 bg-white hover:bg-neutral-100 text-black text-sm font-black uppercase tracking-wider shadow-[4px_4px_0px_#000]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
