/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Cache management. Functionality for caching items
 *  during runtime and flushing during application shutdown.
 * Revision History: None
 ******************************************************/

import * as NodeCache from "node-cache";
import { Dictionary } from "lodash";

import { Manager, Log } from "./Index";
import { IConfiguration } from "../Tools/Index";

class Configuration {
  
  /** Default number of seconds an item is cached for */
  DefaultCacheSeconds: number = 300;
  
}

/** Manager of cache collections. */
class CacheManager extends Manager<Configuration> {
  
  //-----------------------------------//
  
  //-----------------------------------//
  
  /** Collection of caches */
  private caches: Dictionary<NodeCache>;
  
  //-----------------------------------//
  
  /** Construct a new cache manager. */
  constructor() {
    super(Configuration);
    this.caches = {};
  }
  
  /** Start the cache manager */
  public async Start(configuration?: IConfiguration<Configuration>): Promise<void> {
    await super.Start(configuration);
  }
  
  /** Stop the cache manager */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    // iterate and remove the cache collections
    for(let cacheKey in this.caches) {
      // expire all keys
      let cache: NodeCache = this.caches[cacheKey];
      cache.options.checkperiod = 9999999;
      cache.options.deleteOnExpire = false;
      cache.close();
      for(let key of cache.keys()) cache.emit('expired', cache, cache.get(key));
      cache.flushAll();
      delete this.caches[cacheKey];
    }
    
  }
  
  /** Create a cache collection */
  public CreateCache<T>(cacheKey: string, ttl: number = this.Configuration.DefaultCacheSeconds, ttlCheckRate: number = ttl/4,
    onValueAdded: (key: string, value: T) => void = null,
    onValueRemoved: (key: string, value: T) => void = null,
    onValueExpired: (key: string, value: T) => void = null): void {
    
    // construct a new cache collection
    let nodeCache: NodeCache = new NodeCache({
      forceString: false,
      stdTTL: ttl,
      checkperiod: ttlCheckRate,
      errorOnMissing: false,
      deleteOnExpire: true,
      useClones: false,
      //objectValueSize: 1,
      //arrayValueSize: 1,
    });
    
    // callback specification on values being added
    if(onValueAdded) nodeCache.on('set', onValueAdded);
    // callback specification on values being removed
    if(onValueRemoved) nodeCache.on('del', onValueRemoved);
    // callback specification on values expiring
    if(onValueExpired) nodeCache.on('expired', onValueExpired);
    
    this.caches[cacheKey] = nodeCache;
    
  }
  
  /** Remove the cache collection */
  public DeleteCache(cacheKey: string): void {
    // expire all keys
    let cache: NodeCache = this.caches[cacheKey];
    cache.close();
    for(let key of cache.keys()) cache.emit('expired', cache, cache.get(key));
    cache.flushAll();
    delete this.caches[cacheKey];
  }
  
  /** Try retrieve a value by key from a cache collection specified by key */
  public TryGet<T>(cacheKey: string, valueKey: string): T {
    
    return this.caches[cacheKey].get<T>(valueKey);
    
  }
  
  /** Get all values of a particular cache key */
  public GetAll<T>(cacheKey: string): T[] {
    let cache: NodeCache = this.caches[cacheKey];
    let values: T[] = [];
    let keys = cache.keys();
    for(let key of cache.keys()) {
      let value: T = this.caches[cacheKey].get<T>(key);
      if(value != null) values.push(value);
    }
    return values;
  }
  
  /** Try set a value by key in a cache collection specified by key */
  public TryAdd<T>(cacheKey: string, valueKey: string, value: T): boolean {
    
    return this.caches[cacheKey].set(valueKey, value);
    
  }
  
  /** Try add a value or get an existing value by key to a cache collection specified by key */
  public AddOrGet<T>(cacheKey: string, valueKey: string, value: T): T {
    
    if(value == null) throw new Error(`Cannot set cached value to 'NULL'.`);
    
    let resultValue: T = this.caches[cacheKey].get<T>(valueKey);
    
    while(resultValue == null) {
      if(this.caches[cacheKey].set(valueKey, value)) {
        resultValue = value;
      } else {
        resultValue = this.caches[cacheKey].get<T>(valueKey);
      }
    }
    
    return resultValue;
    
  }
  
  /** Add or replace a cached item in the current collection */
  public Set<T>(cacheKey: string, valueKey: string, value: T): void {
    
    if(value == null) throw new Error(`Cannot set cached value to 'NULL'.`);
    
    // delete the existing cached value
    this.caches[cacheKey].del(valueKey);
    
    // set the cached value
    while(!this.caches[cacheKey].set(valueKey, value)) {
      Log.Debug(`Cache ${cacheKey}:${valueKey} couldn't be set.`);
    }
    
  }
  
  /** Delete a cached value by key. Returns the number of keys deleted. */
  public Delete(cacheKey: string, valueKey: string): number {
    
    return this.caches[cacheKey].del(valueKey);
    
  }
  
  //-----------------------------------//
  
}

/** Global connections manager instance */
export var Caches: CacheManager = new CacheManager();
