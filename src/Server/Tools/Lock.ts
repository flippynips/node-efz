import { Time, Log, Locks } from '../Managers/Index';

/** Pending lock instance. */
export interface PendingLock {
  /** Callback. */
  OnUnlock: (lock: Lock) => void;
  /** Queue index. */
  QueueIndex: number;
  /** Number of milliseconds before the lock times out
   * and is unlocked. */
  Timeout: number;
}

/** Lock. */
export class Lock {
  
  //----------------------------------------//
  
  /** Id of the locked entity. */
  public readonly Id: string;
  
  /** Flag indicating locked status. */
  public IsLocked: boolean;
  
  /** Current lock index. */
  public IndexCurrent: number;
  /** Last lock index. */
  public IndexNext: number;
  
  /** On the lock being released from local lock state. */
  public OnLocalUnlock: () => Promise<void>;
  
  //----------------------------------------//
  
  /** Pending queue. */
  protected _pending: PendingLock[];
  /** Current timeout timer. */
  protected _currentTimer: number;
  
  //----------------------------------------//
  
  constructor(id: string) {
    this.Id = id;
    this.IsLocked = false;
    this._pending = [];
    this.IndexNext = 0;
    this.IndexCurrent = 0;
  }
  
  /** Take the lock. */
  public Take = async (timeout?: number): Promise<Lock> => {
    
    // can we callback immediately?
    if(this.IndexCurrent === this.IndexNext) {
      
      // yes, lock
      this.IsLocked = true;
      ++this.IndexNext;
      
      // set timeout
      if(timeout) {
        let currentIndex: number = this.IndexCurrent;
        this._currentTimer = Time.AddTimer(
          timeout,
          () => this.OnTimeout(currentIndex)
        );
      }
      
      return this;
      
    } else {
      
      let queueIndex = ++this.IndexNext;
      
      let self = this;
      return new Promise<Lock>((resolve) => {
        self._pending.push({
          OnUnlock: resolve,
          QueueIndex: queueIndex,
          Timeout: timeout
        });
      });
      
    }
  }
  
  /** Try take the lock. Will return null if the
   * lock wasn't taken immediately. */
  public TryTake = async (timeout?: number): Promise<Lock> => {
    
    // can we callback immediately?
    if(this.IndexCurrent === this.IndexNext) {
      
      // yes increment the next index
      ++this.IndexNext;
      
      // yes, set timeout
      if(timeout) {
        let currentIndex: number = this.IndexCurrent;
        this._currentTimer = Time.AddTimer(
          timeout,
          () => this.OnTimeout(currentIndex)
        );
      }
      
      return this;
      
    } else {
      
      return null;
      
    }
    
  }
  
  /** Release the lock. */
  public Release = (): void => {
    
    if(this._currentTimer) {
      Time.RemoveTimer(this._currentTimer);
      this._currentTimer = undefined;
    }
    
    // increment the current lock index
    ++this.IndexCurrent;
    
    // any local pending locks?
    if(this._pending.length === 0) {
      
      // no, unlock
      this.IsLocked = false;
      
      // run on local unlock callback
      if(this.OnLocalUnlock) this.OnLocalUnlock();
      
      // dispose of the lock
      Locks.RemoveLock(this);
      
      return;
    }
    
    // is the next local callback the next for the lock?
    if(this.IndexCurrent+1 === this._pending[0].QueueIndex) {
      
      let pending = this._pending.shift();
      
      // yes, remove from the pending queue
      if(pending.Timeout) {
        let currentIndex: number = this.IndexCurrent;
        this._currentTimer = Time.AddTimer(
          pending.Timeout,
          () => this.OnTimeout(currentIndex)
        );
      }
      
      // run callback
      pending.OnUnlock(this);
      
    } else {
      
      // run on local unlock callback
      if(this.OnLocalUnlock) this.OnLocalUnlock();
      
    }
    
  }
  
  //----------------------------------------//
  
  /** On the current timer timing out. */
  protected OnTimeout = (index: number): void => {
    
    if(index !== this.IndexCurrent) return;
    
    Log.Debug(`Lock '${this.Id}' timed out.`);
    
    // nullify the timer
    this._currentTimer = undefined;
    
    // release the lock
    this.Release();
    
  }
  
}
