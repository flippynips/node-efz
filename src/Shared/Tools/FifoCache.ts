
import '../Tools/ExtendArray';
import { Dictionary } from './Index';

export interface Link<T> {
  Item: T;
  Key: string;
  Index?: number;
}

export class FifoCache<T> {
  
  //-----------------------------------//
  
  /** Current number of cached items. */
  public get Count(): number {
    return this.Array.length;
  }
  
  /** Current map of key to link */
  public Map: Dictionary<Link<T>>;
  
  /** Current iteratable collection of links */
  public Array: Link<T>[];
  
  //-----------------------------------//
  
  //-----------------------------------//
  
  /** Create a new fife cache container. */
  constructor() {
    
    this.Map = {};
    this.Array = [];
    
  }
  
  /** Get an item by key */
  public GetByKey(key: string): T {
    let link = this.Map[key];
    return link && link.Item;
  }
  
  /** Get an item by index */
  public GetByIndex(index: number): T {
    let link = this.Array[index];
    return link && link.Item;
  }
  
  /** Add an item to the cache in the last position */
  public Add(key: string, item: T): boolean {
    
    let link = this.Map[key];
    if(link) return false;
    
    link = {
      Key: key,
      Item: item
    };
    
    link.Index = this.Array.push(link);
    this.Map[key] = link;
    return true;
    
  }
  
  /** Insert an item at a specified index */
  public Insert(index: number, key: string, item: T): boolean {
    
    let link = this.Map[key];
    if(link) return false;
    
    link = {
      Key: key,
      Item: item
    };
    
    this.Array = [].concat(this.Array.slice(0, index-1), [ link ], this.Array.slice(index));
    link.Index = index;
    return true;
    
  }
  
  /** Pop the last added item from the collection */
  public Pop(): T {
    if(this.Array.length === 0) return null;
    let link: Link<T> = this.Array[this.Array.length-1];
    this.RemoveIndex(this.Array.length-1);
    return link && link.Item;
  }
  
  /** Remove an item form the current collection */
  public Remove(item: T): boolean {
    
    for(let link of this.Array) {
      if(link.Item === item) {
        delete this.Map[link.Key];
        delete this.Array[link.Index];
        return true;
      }
    }
    
    return false;
    
  }
  
  /** Remove an item by key */
  public RemoveKey(key: string): boolean {
    
    let link = this.Map[key];
    if(!link) return false;
    delete this.Map[key];
    if(!this.Array.RemoveAt(link.Index)) return false;
    
    return true;
    
  }
  
  /** Remove an item by index */
  public RemoveIndex(index: number): boolean {
    
    let link = this.Array[index];
    if(!link) return false;
    delete this.Map[link.Key];
    if(!this.Array.RemoveAt(link.Index)) return false;
    
    return true;
    
  }
  
  /** Get the index of an item */
  public IndexOf(item: T, fromIndex?: number): number {
    if(fromIndex == null) fromIndex = 0;
    while(fromIndex < this.Array.length) {
      if(this.Array[fromIndex].Item === item) return fromIndex; 
      ++fromIndex;
    }
  }
  
  //-----------------------------------//
  
}

