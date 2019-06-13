/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Extension methods for buffers.
 * Revision History: None
 ******************************************************/
const z85 = require('z85');
export {};

declare global {
  interface Buffer {
    /** Read a string from the buffer. */
    Read(start: number, end: number, encoding?: string): string;
    /** Custom to JSON function. */
    toJSON(): any;
    /** Get the content of the buffer as an ArrayBuffer instance. */
    toArrayBuffer(): ArrayBuffer;
  }
}

/** Read a string from the buffer. */
Buffer.prototype.Read = function(this: Buffer, start: number, end: number, encoding?: string): string {
  return this.slice(start, end).toString(encoding);
};

/** Get a JSON formattable representation of the buffer. */
Buffer.prototype.toJSON = function(this: Buffer): any {
  let offset: number = 4 - this.length % 4;
  return {
    't': '_buffer',
    'd': z85.encode(Buffer.concat([Buffer.alloc(offset, offset + 74), this]))
  };
}

/** Get the content of the buffer as an ArrayBuffer instance. */
Buffer.prototype.toArrayBuffer = function(this: Buffer): ArrayBuffer {
  return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength) as ArrayBuffer;
}
