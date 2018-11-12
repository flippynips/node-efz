/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class to maintain and control time-outs.
 * Revision History: None
 ******************************************************/

/** Timeout controller */
export class TimeoutController {
  
  //-------------------------------------//
  
  /** Callback for the timeout controller */
  public Callback: () => void;
  
  //-------------------------------------//
  
  /** Time in ms for the timeout between sets */
  private timeoutMs: number;
  /** Integer representing the pending number of resets before the callback will be activated */
  private resetCount: number;
  
  //-------------------------------------//
  
  /** Construct a new timeout controller */
  public constructor(timeoutMs: number, callback: () => void) {
    
    this.timeoutMs = timeoutMs;
    this.Callback = callback;
    
    this.resetCount = 0;
    
  }
  
  /** Set or reset the timeout controller timer */
  public Set = (): void => {
    
    ++this.resetCount;
    setTimeout(this.OnTimeout, this.timeoutMs);
    
  }
  
  /** Stop the timeout controller timer */
  public Stop = (): void => {
    
    this.resetCount = Number.MAX_VALUE;
    
  }
  
  //-------------------------------------//
  
  /** On the timeout callback */
  private OnTimeout = (): void => {
    
    if(--this.resetCount === 0) this.Callback();
    
  }
  
}

