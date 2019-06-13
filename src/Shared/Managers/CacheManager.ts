/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Cache management. Functionality for caching items
 *  during runtime and flushing during application shutdown.
 * Revision History: None
 ******************************************************/

import { IConfiguration, Manager, Application, Time } from "./Index";
import { Dictionary } from "../Tools/Index";

/** Represents a single cached item. */
interface CacheItem<T> {
  /** Cached item. */
  Item: any;
  /** Cached item time-to-live. */
  TimeoutStamp: number;
}

/** Represents a collection of cached items. */
interface Cache<T> {
  
  /** Default ttl for each cached item. */
  DefaultTtl: number;
  /** Number of items */
  ItemCount: number;
  /** Collection of cached items. */
  Items: Dictionary<CacheItem<T>>;
  
  /** On a cache item being added. */
  OnValueAdded: (key: string, value: T, timeoutStamp: number) => void;
  /** On a cache item being expired. */
  OnValueExpired: (key: string, value: T, timeoutStamp: number) => void;
  
}

/** Represents a timer of one or more cache collections. */
interface CacheTimer {
  /** Timer reference id. */
  TimerId: number;
  /** Check interval milliseconds. */
  CheckInterval: number;
  /** Collection of caches to be checked each interval. */
  Caches: Cache<any>[];
}

/** Cache manager configuration. */
class Configuration {
  
  /** Default number of seconds an item is cached for */
  DefaultCacheSeconds: number = 300;
  
}

/** Manager of cache collections. */
export class CacheManager extends Manager {
  
  //-----------------------------------//
  
  /** Current configuration. */
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  //-----------------------------------//
  
  /** Collection of caches */
  private _caches: Dictionary<Cache<any>>;
  /** Collection of cache timers. */
  private _timers: CacheTimer[];
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-----------------------------------//
  
  /** Construct a new cache manager. */
  constructor() {
    super();
    
    this._caches = {};
    this._timers = [];
    
  }
  
  /** Start the cache manager */
  public async Start(): Promise<void> {
    await super.Start();
    
    // load the configuration
    this._configuration = Application.Configuration(
      './config/CacheManager.config',
      new Configuration()
    );
    await this._configuration.Load();
    
  }
  
  /** Stop the cache manager */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    // iterate and remove the cache collections
    for(let cacheTimer of this._timers) {
      
      Time.RemoveInterval(cacheTimer.TimerId);
      let caches = cacheTimer.Caches;
      cacheTimer.Caches = [];
      
      // expire all keys
      for(let cache of caches) {
        if(cache.OnValueExpired) {
          for(let key in cache.Items) {
            cache.OnValueExpired(key, cache.Items[key].Item, cache.Items[key].TimeoutStamp);
          }
        }
      }
      
    }
    
    // save the configuration
    await this._configuration.Save();
    
  }
  
  /** Create a cache collection */
  public CreateCache<T>(
    cacheKey: string,
    ttl: number = this.Configuration.DefaultCacheSeconds,
    ttlCheckInterval: number = 30000,
    onValueAdded: (key: string, value: T, timeoutStamp: number) => void = null,
    onValueExpired: (key: string, value: T, timeoutStamp: number) => void = null
  ): void {
    
    if(this._caches[cacheKey]) {
      throw new Error(`Cache with cache key '${cacheKey}' already exists.`);
    }
    
    let cache: Cache<T>;
    this._caches[cacheKey] = cache = {
      DefaultTtl: ttl,
      ItemCount: 0,
      Items: {},
      OnValueAdded: onValueAdded,
      OnValueExpired: onValueExpired
    };
    
    // does a cache timer exist for the specified check rate?
    let cacheTimer = this._timers.find(t => ttlCheckInterval === t.CheckInterval);
    if(!cacheTimer) {
      cacheTimer = {
        TimerId: undefined,
        CheckInterval: ttlCheckInterval,
        Caches: []
      };
      cacheTimer.TimerId = Time.AddInterval(ttlCheckInterval, this.CheckCache, cacheTimer);
    }
    
    cacheTimer.Caches.push(cache);
    
  }
  
  /** Remove a cache collection */
  public DeleteCache(cacheKey: string): void {
    
    // expire all keys
    let cache = this._caches[cacheKey];
    for(let i = 0; i < this._timers.length; ++i) {
      let cacheTimer = this._timers[i];
      let removed: boolean = false;
      for(let j = 0; j < cacheTimer.Caches.length; ++j) {
        if(cacheTimer.Caches[j] === cache) {
          cacheTimer.Caches.RemoveAt(j);
          if(cacheTimer.Caches.length === 0) {
            this._timers.RemoveAt(i);
          }
          removed = true;
          break;
        }
      }
      if(removed) break;
    }
    delete this._caches[cacheKey];
    if(cache.OnValueExpired) {
      for(let key in cache.Items) {
        cache.OnValueExpired(key, cache.Items[key].Item, cache.Items[key].TimeoutStamp);
      }
    }
    
  }
  
  /** Try retrieve a value by key from a cache collection specified by key */
  public TryGet<T>(cacheKey: string, valueKey: string, ttl?: number): T {
    
    let cache = this._caches[cacheKey];
    let item = cache.Items[valueKey];
    if(!item) return undefined;
    if(ttl) item.TimeoutStamp = Time.Now + ttl;
    return item.Item;
    
  }
  
  /** Try retrieve a value and its timeout stamp by key from a cache collection specified by key */
  public TryGetTimestamp<T>(cacheKey: string, valueKey: string): { timeoutStamp: number, value: T } {
    
    let cache = this._caches[cacheKey];
    let item = cache.Items[valueKey];
    if(!item) return undefined;
    return { timeoutStamp: item.TimeoutStamp, value: item.Item };
    
  }
  
  /** Get all key-value pairs of a particular cache key. */
  public GetAll<T>(cacheKey: string): { key: string, value: T }[] {
    
    let values: { key: string, value: T }[] = [];
    let cache = this._caches[cacheKey];
    for(let key in cache.Items) {
      let item = cache.Items[key];
      if(item) values.push({ key: key, value: item.Item });
    }
    return values;
    
  }
  
  /** Get all key-value-timestamp trebles of a particular cache key. */
  public GetAllTimestamps<T>(cacheKey: string): { key: string, value: T, timeoutStamp: number }[] {
    
    let values: { key: string, value: T, timeoutStamp: number }[] = [];
    let cache = this._caches[cacheKey];
    for(let key in cache.Items) {
      let item = cache.Items[key];
      if(item) values.push({ key: key, value: item.Item, timeoutStamp: item.TimeoutStamp });
    }
    return values;
    
  }
  
  /** Try add a value or get an existing value by key to a cache collection specified by key */
  public SetOrGet<T>(cacheKey: string, valueKey: string, value: T, ttl?: number): T {
    
    if(value === undefined) throw new Error(`Cannot set cached value to "undefined".`);
    
    // try get an existing value
    let cache = this._caches[cacheKey];
    let item = cache.Items[valueKey];
    
    // was a cached value found?
    if(item !== undefined) {
      // yes, return it
      if(ttl) item.TimeoutStamp = Time.Now + ttl;
      return item.Item;
    }
    
    // no, create a new item
    item = {
      Item: value,
      TimeoutStamp: Time.Now + (ttl || cache.DefaultTtl)
    };
    
    cache.Items[valueKey] = item;
    ++cache.ItemCount;
    
    if(cache.OnValueAdded) cache.OnValueAdded(valueKey, value, item.TimeoutStamp);
    
    return value;
    
  }
  
  /** Add or replace a cached item in the current collection */
  public Set<T>(cacheKey: string, valueKey: string, value: T, ttl?: number): void {
    
    if(value === undefined) throw new Error(`Cannot set cached value to "undefined".`);
    let cache = this._caches[cacheKey];
    let item = cache.Items[valueKey];
    if(item) {
      if(ttl) item.TimeoutStamp = Time.Now + ttl;
      item.Item = value;
    } else {
      cache.Items[valueKey] = item = {
        Item: value,
        TimeoutStamp: Time.Now + (ttl || cache.DefaultTtl)
      };
      ++cache.ItemCount;
    }
    if(cache.OnValueAdded) cache.OnValueAdded(valueKey, value, item.TimeoutStamp);
    
  }
  
  /** Delete a cached value by key. Returns whether a cached value was removed. */
  public Delete(cacheKey: string, valueKey: string): boolean {
    
    let cache = this._caches[cacheKey];
    let item = cache.Items[valueKey];
    if(!item) return false;
    --cache.ItemCount;
    delete cache.Items[valueKey];
    if(cache.OnValueExpired) cache.OnValueExpired(valueKey, item.Item, item.TimeoutStamp);
    return true;
    
  }
  
  /** Clear a cache collection by key, expiring all values. */
  public Clear(cacheKey: string): void {
    
    let cache = this._caches[cacheKey];
    if(!cache) return;
    
    if(cache.OnValueExpired) {
      let items = cache.Items;
      cache.ItemCount = 0;
      cache.Items = {};
      for(let key in items) {
        cache.OnValueExpired(
          key,
          cache.Items[key].Item,
          cache.Items[key].TimeoutStamp
        );
      }
    } else {
      cache.ItemCount = 0;
      cache.Items = {};
    }
    
  }
  
  //-----------------------------------//
  
  protected CheckCache(cacheTimer: CacheTimer): void {
    
    for(let cache of cacheTimer.Caches) {
      if(cache.ItemCount === 0) continue;
      for(let key in cache.Items) {
        if(Time.Now > cache.Items[key].TimeoutStamp) {
          --cache.ItemCount;
          if(cache.OnValueExpired) {
            cache.OnValueExpired(key, cache.Items[key].Item, cache.Items[key].TimeoutStamp);
          }
          delete cache.Items[key];
        }
      }
    }
    
  }
  
}

/** Global cache manager instance */
export const Caches: CacheManager = new CacheManager();
