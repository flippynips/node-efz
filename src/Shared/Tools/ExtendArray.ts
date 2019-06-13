
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
    /** Remove a single matching item from the array. */
    Remove(item: T): boolean;
    /** Remove a collection from the array. */
    RemoveCollection(items: T[]): void;
    /** Remove an item at a specified index from the array. */
    RemoveAt(index: number): boolean;
    /** Append a collection of items to the array. */
    Append(items: T[]): void;
    /** Reduce a multi-dimensional collection to a single collection. */
    Reduce(): T[];
    /** Run a function and map all items to a single string, optionally with a separator. */
    Join(callback: (item: T) => string, separator?: string): string;
    /** Clone an array. */
    Clone(): T[];
    /** Shuffle the array; randomizing indices of items. Mutates the current array. */
    Shuffle(): T[];
  }
}

Array.prototype.Remove = function<T>(item: T): boolean {
  for(let i = this.length-1; i >= 0; --i) {
    if(this[i] === item) {
      this.splice(i, 1);
      return true;
    }
  }
  return false;
}

Array.prototype.RemoveCollection = function<T>(items: T[]): void {
  for(let i = this.length-1; i >= 0; --i) {
    for(let j = items.length-1; j >= 0; --j) {
      if(this[i] === items[j]) {
        this.splice(i, 1);
        break;
      }
    }
  }
}

Array.prototype.RemoveAt = function(index: number): boolean {
  if(index < 0 || index >= this.length) return false;
  this.splice(index, 1);
  return true;
};

Array.prototype.Append = function<T>(this: T[], items: T[]): void {
  for(let item of items) this.push(item);
};

Array.prototype.Reduce = function<T>(): T[] {
  let items: T[] = [];
  for(let x of this) {
    for(let y of x) {
      items.push(y);
    }
  }
  return items;
};

Array.prototype.Join = function<T>(callback: (item: T) => string, separator: string = ', '): string {
  if(this.length === 0) return '';
  let str: string;
  let first: boolean = true;
  for(let x of this) {
    if(first) {
      str = callback(x);
      first = false;
    } else {
      str = `${str}${separator}${callback(x)}`;
    }
  }
  return str;
};

Array.prototype.Clone = function<T>(): T[] {
  let array: T[] = new Array<T>(this.length);
  for(let i = this.length-1; i >= 0; --i) {
    array[i] = this[i];
  }
  return array;
}

Array.prototype.Shuffle = function<T>(): T[] {
  
  let currentIndex: number = this.length;
  let randomIndex: number;
  
  // while there remain elements to shuffle...
  while(currentIndex !== 0) {
    
    // pick a random index
    randomIndex = Math.floor(Math.random() * currentIndex);
    
    // decrement current index
    --currentIndex;
    
    // skip if current index and random are the same
    if(currentIndex === randomIndex) continue;

    // swap random index with current index
    let temporaryValue = this[currentIndex];
    this[currentIndex] = this[randomIndex];
    this[randomIndex] = temporaryValue;
    
  }
  
  return this;
  
}

