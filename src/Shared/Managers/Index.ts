export * from './Manager';
export * from './Application';

import { Manager } from './Manager';

import { LogManager, Log } from './LogManager';
import { TimeManager, Time } from './TimeManager'; 
import { CacheManager, Caches } from './CacheManager';

export {
  
  // types
  Manager,
  LogManager,
  CacheManager,
  TimeManager,
  
  // instances
  Log,
  Time,
  Caches
  
};

/** Collection of all managers in initialization order */
export const All: Manager[] = [
  Log,
  Time,
  Caches
]
