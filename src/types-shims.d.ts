// Minimal ambient declarations for untyped pure-JS dependencies.

declare module 'blueimp-md5' {
  function md5(input: string): string;
  export default md5;
}

declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
  const lamejs: { Mp3Encoder: typeof Mp3Encoder };
  export default lamejs;
}

declare module 'gifenc' {
  export interface GifWriteOptions {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    repeat?: number;
  }
  export interface GIFEncoderInstance {
    writeFrame(index: Uint8Array | number[], width: number, height: number, opts?: GifWriteOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array | number[],
    maxColors: number,
  ): number[][];
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array | number[],
    palette: number[][],
  ): Uint8Array;
}
