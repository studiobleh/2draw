declare module 'gifenc' {
  export interface GIFEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }
  export interface WriteFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: number[][];
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  }
  export interface GIFEncoderInstance {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    buffer: ArrayBuffer;
    writeHeader(): void;
    writeFrame(index: Uint8Array | number[], width: number, height: number, opts?: WriteFrameOptions): void;
  }
  export function GIFEncoder(opt?: GIFEncoderOptions): GIFEncoderInstance;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: any): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
  export default GIFEncoder;
}
