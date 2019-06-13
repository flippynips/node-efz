/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Time management. Helper methods and functionality related to time.
 * Revision History: None
 ******************************************************/

import { Manager } from "./Manager";
import { Log } from '../Managers/Index';
import '../Tools/ExtendDate';

/** Structure of time records with callbacks. */
export interface TimeEntry {
  IntervalTime: number;
  NextTimestamp: number;
  IntervalCallbacks?: Callback[];
  TimerCallbacks?: Callback[];
}

/** Callback function with identity. */
export interface Callback {
  Identity: number;
  Function: Function;
  Args: any[];
}

/** Manager of time related information. */
export class TimeManager extends Manager {
  
  //-------------------------------------//
  
  /** Number of milliseconds in a day. */
  public readonly MillisecondDay: number = 86400000;
  
  /** Number of milliseconds in an hour. */
  public readonly MillisecondHour: number = 3600000;
  
  /** Number of milliseconds in a minute. */
  public readonly MillisecondMinute: number = 60000;
  
  /** Get the current utc timestamp as number of seconds */
  public get NowSecs(): number {
    return this._now/1000;
  }
  
  /** Get the current utc timestamp in milliseconds */
  public get Now(): number {
    return this._now;
  }
  
  /** Get the current date time in a user-friendly readable format. */
  public get NowString(): string {
    return new Date(this._now).Format('yyyy-MM-dd HH:mm:ss');
  }
  
  //-------------------------------------//
  
  /** Current timestamp. */
  protected _now: number;
  /** Map of interval times to interval instances. */
  protected _timeByInterval: { [Interval: number]: TimeEntry };
  /** Map of callback identities to time entries. */
  protected _timeByCallback: { [Identity: number]: TimeEntry };
  /** Intervals awaiting callbacks */
  protected _timeEntries: TimeEntry[];
  
  /** Timer id. */
  protected _timerId: number;
  
  //-------------------------------------//
  
  /** Construct a new time manager */
  constructor() {
    super();
    this._timeEntries = [];
    this._timeByInterval = {};
    this._timeByCallback = {};
    this._now = Date.now();
    setInterval(this.UpdateTimestamp, 5);
    this._timerId = 0;
  }
  
  /** Add an interval timer. */
  public AddInterval(ms: number, callback: Function, ...args: any[]): number {
    ms = Math.floor(ms);
    ++this._timerId;
    if(this._timerId === Number.MAX_SAFE_INTEGER) this._timerId = 1;
    let interval: TimeEntry = this._timeByInterval[ms];
    if(interval) {
      if(!interval.IntervalCallbacks) interval.IntervalCallbacks = [];
      interval.IntervalCallbacks.push({
        Identity: this._timerId,
        Function: callback,
        Args: args
      });
    } else {
      interval = {
        IntervalTime: ms,
        NextTimestamp: Time.Now + ms,
        IntervalCallbacks: [{
          Identity: this._timerId,
          Function: callback,
          Args: args
        }]
      };
      this._timeEntries.push(interval);
      this._timeByInterval[ms] = interval;
    }
    this._timeByCallback[this._timerId] = interval;
    return this._timerId;
  }
  
  /** Add a timeout callback. */
  public AddTimer(ms: number, callback: Function, ...args: any[]): number {
    ms = Math.floor(ms);
    ++this._timerId;
    if(this._timerId === Number.MAX_SAFE_INTEGER) this._timerId = 1;
    let timestamp: number = Time.Now + ms;
    let interval: TimeEntry;
    for(let inter of this._timeEntries) {
      if(Math.abs(timestamp - inter.NextTimestamp - 5) < 11) {
        interval = inter;
        break;
      }
    }
    if(interval) {
      if(!interval.TimerCallbacks) interval.TimerCallbacks = [];
      interval.TimerCallbacks.push({
        Identity: this._timerId,
        Function: callback,
        Args: args
      });
    } else {
      interval = {
        IntervalTime: ms,
        NextTimestamp: timestamp,
        TimerCallbacks: [{
          Identity: this._timerId,
          Function: callback,
          Args: args
        }]
      };
      this._timeEntries.push(interval);
      this._timeByInterval[ms] = interval;
    }
    this._timeByCallback[this._timerId] = interval;
    return this._timerId;
  }
  
  /** Remove an interval timer. */
  public RemoveInterval(id: number): boolean {
    if(!id) return false;
    // get the time entry matching the id
    let timeEntry: TimeEntry = this._timeByCallback[id];
    if(!timeEntry || !timeEntry.IntervalCallbacks) return false;
    delete this._timeByCallback[id];
    if(timeEntry.IntervalCallbacks.length === 1) {
      if(timeEntry.TimerCallbacks) {
        timeEntry.IntervalCallbacks = undefined;
      } else {
        this._timeEntries.Remove(timeEntry);
        delete this._timeByInterval[timeEntry.IntervalTime];
      }
      return true;
    }
    for(let i = timeEntry.IntervalCallbacks.length-1; i >= 0; --i) {
      if(timeEntry.IntervalCallbacks[i].Identity === id) {
        timeEntry.IntervalCallbacks.RemoveAt(i);
        return true;
      }
    }
    return false;
  }
  
  /** Remove a timeout callback. */
  public RemoveTimer(id: number): boolean {
    if(!id) return false;
    let timeEntry: TimeEntry = this._timeByCallback[id];
    if(!timeEntry || !timeEntry.TimerCallbacks) return false;
    delete this._timeByCallback[id];
    if(timeEntry.TimerCallbacks.length === 1) {
      if(timeEntry.IntervalCallbacks) {
        timeEntry.TimerCallbacks = undefined;
      } else {
        this._timeEntries.Remove(timeEntry);
        delete this._timeByInterval[timeEntry.IntervalTime];
      }
      return true;
    }
    for(let i = timeEntry.TimerCallbacks.length-1; i >= 0; --i) {
      if(timeEntry.TimerCallbacks[i].Identity === id) {
        timeEntry.TimerCallbacks.RemoveAt(i);
        return true;
      }
    }
    return false;
  }
  
  //-------------------------------------//
  
  /** Update the current timestamp, run callbacks if appropriate. */
  protected UpdateTimestamp = (): void => {
    this._now = Date.now();
    
    for(let i = this._timeEntries.length-1; i >= 0; --i) {
      let entry = this._timeEntries[i];
      if(!entry) continue;
      
      if(entry.NextTimestamp > this._now) continue;
      
      // run inteval callbacks
      if(entry.IntervalCallbacks) {
        for(let j = entry.IntervalCallbacks.length-1; j >= 0; --j) {
          let callback = entry.IntervalCallbacks[j];
          if(!callback) continue;
          try {
            callback.Function(...callback.Args);
          } catch(error) {
            Log.Warning(`Unhandled error thrown by interval callback. ${error && error.stack || error}`);
          }
        }
      }
      
      // are there timeout callbacks?
      if(entry.TimerCallbacks) {
        
        // yes, copy timeout callbacks
        let callbacks = entry.TimerCallbacks;
        // clear timeout callbacks
        entry.TimerCallbacks = undefined;
        for(let j = callbacks.length-1; j >= 0; --j) {
          let callback = callbacks[j];
          if(!callback) continue;
          try {
            callback.Function(...callback.Args);
          } catch(error) {
            Log.Warning(`Unhandled error thrown by timer callback. ${error && error.stack || error}`);
          }
          delete this._timeByCallback[callback.Identity];
        }
        
        // are there interval callbacks or more timer callbacks?
        if(entry.IntervalCallbacks || entry.TimerCallbacks) {
          // yes, set the next timestamp
          entry.NextTimestamp = this._now + entry.IntervalTime;
        } else {
          // no, remove the entry
          this._timeEntries.RemoveAt(i);
          delete this._timeByInterval[entry.IntervalTime];
        }
        
      } else {
        
        // no, set the next timestamp
        entry.NextTimestamp = this._now + entry.IntervalTime;
        
      }
      
    }
    
  }
  
}

/** Global email manager instance */
export const Time: TimeManager = new TimeManager();
