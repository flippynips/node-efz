/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Extension methods for arrays.
 * Revision History: None
 ******************************************************/

// treat this as a module
export {};

/*
declare global {
  interface Buffer {
    toJSON(): any;
  }
}
*/

/** Override default toJSON implementation with safer alternative */
Buffer.prototype.toJSON = function(): any {
  return {
    _type: 'buffer',
    _data: this.toString('hex')
  };
};
