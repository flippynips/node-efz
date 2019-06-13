const z85 = require('z85');

/** Custom content serializer. */
export function Stringify(key: string, value: any): any {
  return value;
}

/** Custom content parser. */
export function Parse(key: any, value: any): any {
  if(!value) return value;
  switch(value.t) {
    case '_buffer':
      return value.d ? Z85Decode(value.d) : value;
    default:
      return value;
  }
}

/** Helper to encode a buffer as a string appending bytes as required. */
export function Z85Encode(buffer: Uint8Array): string {
  let offset: number = 4 - buffer.length % 4;
  return z85.encode(Buffer.concat([Buffer.alloc(offset, offset + 74), buffer]));
}

/** Helper to decode an encoded string back to a buffer. */
export function Z85Decode(text: string): Buffer {
  let buffer: Buffer = z85.decode(text);
  return buffer.slice(buffer[0]-74);
}
