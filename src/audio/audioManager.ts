import { AudioTrack } from '../types';

class AudioManager {
  private ctx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime = 0;
  private startOffset = 0;
  private isPlaying = false;
  private currentTrackDataUrl = '';

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async loadAudioFile(file: File): Promise<AudioTrack> {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = this.getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    this.currentBuffer = audioBuffer;

    // Convert file to dataUrl for persistence
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    this.currentTrackDataUrl = dataUrl;

    // Calculate peaks for waveform visualizer
    const peaks = this.calculatePeaks(audioBuffer, 120);

    return {
      id: 'audio_' + Math.random().toString(36).substring(2, 9),
      name: file.name,
      duration: audioBuffer.duration,
      dataUrl,
      peaks,
      offset: 0,
      volume: 1.0,
    };
  }

  async loadFromDataUrl(dataUrl: string, name = 'Audio Track'): Promise<AudioTrack> {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const ctx = this.getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.currentBuffer = audioBuffer;
    this.currentTrackDataUrl = dataUrl;

    const peaks = this.calculatePeaks(audioBuffer, 120);

    return {
      id: 'audio_' + Math.random().toString(36).substring(2, 9),
      name,
      duration: audioBuffer.duration,
      dataUrl,
      peaks,
      offset: 0,
      volume: 1.0,
    };
  }

  calculatePeaks(buffer: AudioBuffer, numPeaks = 100): number[] {
    const channelData = buffer.getChannelData(0);
    const step = Math.floor(channelData.length / numPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < numPeaks; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(Math.min(1, Math.max(0.05, max)));
    }
    return peaks;
  }

  play(timeOffset = 0, volume = 1.0) {
    if (!this.currentBuffer) return;
    this.stop();

    const ctx = this.getAudioContext();
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = volume;
    this.gainNode.connect(ctx.destination);

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.connect(this.gainNode);

    const offset = Math.max(0, Math.min(timeOffset, this.currentBuffer.duration));
    this.sourceNode.start(0, offset);
    this.startTime = ctx.currentTime;
    this.startOffset = offset;
    this.isPlaying = true;
  }

  seek(timeOffset = 0, volume = 1.0) {
    if (this.isPlaying) {
      this.play(timeOffset, volume);
    }
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // ignore already stopped
      }
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.isPlaying = false;
  }

  setVolume(vol: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  getCurrentAudioBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }
}

export const audioManager = new AudioManager();
