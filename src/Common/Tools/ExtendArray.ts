/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Extension methods for arrays.
 * Revision History: None
 ******************************************************/

// treat this as a module
export {};

declare global {
  interface Array<T> {
    /** Remove an item at a specified index from the array */
    RemoveAt(index: number): boolean;
    /** Append a collection of items to the array */
    Append<T>(items: T[]): void;
  }
}

Array.prototype.RemoveAt = function(index: number): boolean {
  if(index < 0 || index >= this.length) return false;
  this.splice(index, 1);
  return true;
};

Array.prototype.Append = function<T>(items: T[]): void {
  for(let item of items) {
    this.push(item);
  }
};
