import React, { useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  Copy,
  Trash2,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Music,
} from 'lucide-react';
import { Project, Frame } from '../types';

interface BottomTimelineProps {
  project: Project;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  onMoveFrame: (fromIndex: number, toIndex: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
}

export const BottomTimeline: React.FC<BottomTimelineProps> = ({
  project,
  isPlaying,
  onTogglePlay,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onFirstFrame,
  onLastFrame,
  onMoveFrame,
  isLooping,
  onToggleLoop,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active frame when it changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(
        `[data-frame-index="${project.activeFrameIndex}"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    }
  }, [project.activeFrameIndex]);

  const totalFrames = project.frames.length;
  const currentFrameNum = project.activeFrameIndex + 1;

  return (
    <div className={`${project.audioTrack ? 'h-44' : 'h-36'} bg-white border-t-3 border-black flex flex-col shrink-0 select-none z-20 transition-all`}>
      {/* Top Controls Row directly matching Reference 1 */}
      <div className="h-12 border-b-2 border-black px-4 flex items-center justify-between gap-3 bg-white">
        {/* Playback Actions */}
        <div className="flex items-center gap-2">
          {/* PLAY / PAUSE BUTTON */}
          <button
            onClick={onTogglePlay}
            className={`brutal-btn px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[3px_3px_0px_#000] ${
              isPlaying ? 'bg-[#FFE600]' : 'bg-[#86EFAC]'
            }`}
            title="Play / Pause Animation (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-black stroke-black" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-black stroke-black" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* FIRST FRAME */}
          <button
            onClick={onFirstFrame}
            className="brutal-btn w-9 h-8 bg-white hover:bg-neutral-100 text-black"
            title="First Frame"
          >
            <SkipBack className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* LAST FRAME */}
          <button
            onClick={onLastFrame}
            className="brutal-btn w-9 h-8 bg-white hover:bg-neutral-100 text-black"
            title="Last Frame"
          >
            <SkipForward className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* FRAME COUNTER BADGE */}
          <div className="bg-black text-white px-3 py-1 font-black text-xs tracking-wider border-2 border-black">
            <span>FRAME </span>
            <span className="tabular-nums">
              {currentFrameNum} / {totalFrames}
            </span>
          </div>

          {/* LOOP TOGGLE */}
          <button
            onClick={onToggleLoop}
            className={`brutal-btn px-2.5 h-8 text-xs font-bold flex items-center gap-1 ${
              isLooping ? 'bg-[#FFE600]' : 'bg-white'
            }`}
            title={isLooping ? 'Loop: ON' : 'Loop: OFF'}
          >
            <Repeat className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Frame Actions Matching Reference 1 */}
        <div className="flex items-center gap-2">
          {/* ADD FRAME */}
          <button
            onClick={onAddFrame}
            className="brutal-btn px-3 py-1.5 bg-[#00E5F0] text-black text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[3px_3px_0px_#000]"
            title="Add blank frame"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ADD FRAME</span>
          </button>

          {/* DUPLICATE FRAME */}
          <button
            onClick={onDuplicateFrame}
            className="brutal-btn px-3 py-1.5 bg-[#FFE600] text-black text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[3px_3px_0px_#000]"
            title="Duplicate current frame"
          >
            <Copy className="w-4 h-4 stroke-[2.5]" />
            <span>DUPLICATE</span>
          </button>

          {/* DELETE FRAME */}
          <button
            onClick={onDeleteFrame}
            disabled={totalFrames <= 1}
            className="brutal-btn px-3 py-1.5 bg-[#FF5F38] text-black text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[3px_3px_0px_#000] disabled:opacity-40"
            title="Delete current frame"
          >
            <Trash2 className="w-4 h-4 stroke-[2.5]" />
            <span>DELETE</span>
          </button>
        </div>
      </div>

      {/* Optional Audio Sync Waveform Lane with Real-time Scrubbing */}
      {project.audioTrack && (
        <div className="h-8 bg-[#F0FDF4] border-b-2 border-black px-4 flex items-center gap-3 shrink-0 select-none">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-black shrink-0 max-w-44 truncate">
            <Music className="w-3.5 h-3.5 text-black stroke-[3] shrink-0" />
            <span className="truncate">{project.audioTrack.name}</span>
          </div>

          {/* Interactive Scrubbing Waveform Strip */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const targetIdx = Math.min(
                project.frames.length - 1,
                Math.floor(ratio * project.frames.length)
              );
              onSelectFrame(targetIdx);
            }}
            className="relative flex-1 h-5 bg-white border border-black cursor-pointer overflow-hidden flex items-center gap-[1px] px-1 hover:border-black"
            title="Click or drag to scrub audio timeline position"
          >
            {project.audioTrack.peaks.map((peak, idx) => (
              <div
                key={idx}
                className="w-1 bg-[#2DD4BF] rounded-none shrink-0"
                style={{ height: `${Math.max(15, peak * 100)}%` }}
              />
            ))}

            {/* Playhead Sync Marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-[#FF5F38] shadow-[1px_0_0_#000] pointer-events-none transition-all duration-75"
              style={{
                left: `${Math.min(
                  100,
                  Math.max(
                    0,
                    (project.activeFrameIndex / Math.max(1, project.frames.length - 1)) * 100
                  )
                )}%`,
              }}
            />
          </div>

          <div className="text-[10px] font-mono font-black text-neutral-700 shrink-0 tabular-nums">
            {(project.activeFrameIndex / Math.max(1, project.fps)).toFixed(2)}s /{' '}
            {project.audioTrack.duration.toFixed(2)}s
          </div>
        </div>
      )}

      {/* Bottom Frame Thumbnails Reel */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center gap-3 px-4 overflow-x-auto py-2 bg-neutral-100"
      >
        {project.frames.map((frame, index) => {
          const isActive = index === project.activeFrameIndex;

          return (
            <div
              key={frame.id}
              data-frame-index={index}
              onClick={() => onSelectFrame(index)}
              className={`relative group shrink-0 w-20 h-20 border-3 border-black flex flex-col cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#FFE600] shadow-[3px_3px_0px_#000] scale-105 z-10'
                  : 'bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]'
              }`}
            >
              {/* Frame thumbnail image or preview */}
              <div className="flex-1 w-full bg-white overflow-hidden relative flex items-center justify-center p-0.5">
                {frame.thumbnailUrl ? (
                  <img
                    src={frame.thumbnailUrl}
                    alt={`Frame ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-[10px] text-neutral-400 font-bold">Empty</div>
                )}
              </div>

              {/* Bottom black badge with #FrameNumber */}
              <div className="w-full bg-black text-white text-[10px] font-black py-0.5 text-center">
                #{index + 1}
              </div>

              {/* Quick Reorder Frame Controls (visible on hover) */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-black p-0.5 rounded-none border border-black shadow">
                {index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveFrame(index, index - 1);
                    }}
                    className="text-white hover:text-[#FFE600] p-0.5"
                    title="Move Frame Left"
                  >
                    <ChevronLeft size={10} />
                  </button>
                )}
                {index < project.frames.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveFrame(index, index + 1);
                    }}
                    className="text-white hover:text-[#FFE600] p-0.5"
                    title="Move Frame Right"
                  >
                    <ChevronRight size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Plus button at end of reel */}
        <button
          onClick={onAddFrame}
          className="shrink-0 w-16 h-20 border-3 border-dashed border-black hover:border-solid hover:bg-white flex flex-col items-center justify-center gap-1 transition-all"
          title="Add Frame"
        >
          <Plus className="w-5 h-5 text-black stroke-[3]" />
          <span className="text-[9px] font-black uppercase">ADD</span>
        </button>
      </div>
    </div>
  );
};
