import { Time } from '../Managers/Index';

/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class to maintain and control time-outs.
 * Revision History: None
 ******************************************************/

/** Timeout controller */
export class TimeoutController {
  
  //-------------------------------------//
  
  /** Time in ms for the timeout between sets */
  public TimeoutMs: number;
  /** Callback for the timeout controller */
  public Callback: () => void;
  
  //-------------------------------------//
  
  /** Current timeout identity. */
  public _timeoutId: any;
  
  //-------------------------------------//
  
  /** Construct a new timeout controller */
  public constructor(timeoutMs: number, callback: () => void) {
    
    this.TimeoutMs = timeoutMs;
    this.Callback = callback;
    
  }
  
  /** Set or reset the timeout controller timer */
  public Set = (time?: number): void => {
    
    if(time) this.TimeoutMs = time;
    if(this._timeoutId) Time.RemoveTimer(this._timeoutId);
    this._timeoutId = Time.AddTimer(this.TimeoutMs, this.OnTimeout);
    
  }
  
  /** Stop the timeout controller timer */
  public Stop = (): void => {
    
    if(this._timeoutId) {
      Time.RemoveTimer(this._timeoutId);
      this._timeoutId = undefined;
    }
    
  }
  
  //-------------------------------------//
  
  /** On the timeout callback */
  private OnTimeout = (): void => {
    
    this._timeoutId = undefined;
    this.Callback();
    
  }
  
}

