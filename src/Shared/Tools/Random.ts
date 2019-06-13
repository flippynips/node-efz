
/** Explored from https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript */

/** Current random number generator. Needs to be assigned before anything uses it. */
export let CurrentRng: () => number = LCG(Math.floor(Math.random() * 4294967296));

/** Initialize with 31-bit seed. */
export function LCG(s: number): () => number {
  return (): number => (2**31-1&(s=Math.imul(48271,s)))/2**31
};

/** Initialize with 32-bit seed. */
export function JSF(seed: number): () => number {
  function jsf(): number {
    let e: number = s[0] - (s[1]<<27 | s[1]>>5);
      s[0] = s[1] ^ (s[2]<<17 | s[2]>>15),
      s[1] = s[2] + s[3],
      s[2] = s[3] + e, s[3] = s[0] + e;
    return (s[3] >>> 0) / 4294967295; // 2^32-1
  }
  seed >>>= 0;
  let s: any = [0xf1ea5eed, seed, seed, seed];
  for(var i=0;i<20;++i) jsf();
  return jsf;
}

/** By Blackman/Vigna; initialized with 4 x 32-bit seeds. */
export function xoshiro128ss(a: number, b: number, c: number, d: number): () => number {
  return function() {
    let t = b << 9, r = a * 5; r = (r << 7 | r >>> 25) * 9;
    c ^= a; d ^= b;
    b ^= c; a ^= d; c ^= t;
    d = d << 11 | d >>> 21;
    return (r >>> 0) / 4294967296;
  }
}

/** From PractRand random number testing suite; initialized with 4 x 32-bit seeds. */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function(): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    var t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

/** Get or fill a buffer with random content. */
export function Buf(count: number, output?: Buffer, rng?: () => number): Buffer {
  if(!rng) rng = CurrentRng;
  if(!output) output = Buffer.allocUnsafe(count);
  for(let i=0;i<count;++i) output[i] = Math.floor(rng()*256);
  return output;
}

export function AlphaNumeric(count: number): string {
  
  let codeNumbers: number[] = new Array<number>(count);
  while(--count >= 0) {
    let number = Math.floor(CurrentRng() * 36);
    
    if(number >= 26) number += 48;
    else number += 65;
    
    codeNumbers[count] = number;
  }
  
  return String.fromCharCode(...codeNumbers);
  
}
