import { Sleep, IterationController } from "./Index";

/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class to maintain looping functions.
 * Revision History: None
 ******************************************************/

/** Iteration manager for multiple controllers. */
export class IterationThreads {
  
  //-------------------------------------//
  
  /** Callback on iteration. */
  public Callback: () => Promise<void>;
  
  /** Callback on an iteration error. */
  public CallbackError: (error: any) => boolean;
  
  /** Flag indicating iteration is running. */
  public get Running(): boolean {
    return this._running;
  }
  /** Flag indicating iteration is running. */
  public set Running(v: boolean) {
    this._running = v;
    for(let iterator of this.Threads) {
      iterator.Running = v;
    }
  }
  
  /** Flag indicating the iteration is stopped. */
  public get Stopped(): boolean {
    return this._stopped;
  }
  /** Flag indicating the iteration is stopped. */
  public set Stopped(v: boolean) {
    this._stopped = v;
    for(let iterator of this.Threads) {
      iterator.Stopped = v;
    }
  }
  
  /** Delay between each iteration callback. */
  public get IterationDelay(): number {
    return this._iterationDelay;
  }
  /** Delay between each iteration callback. */
  public set IterationDelay(v: number) {
    this._iterationDelay = v;
    for(let iterator of this.Threads) {
      iterator.IterationDelay = v;
    }
  }
  
  /** Collection of iteration controllers being handled. */
  public Threads: IterationController[];
  
  //-------------------------------------//
  
  protected _iterationDelay: number;
  protected _stopped: boolean;
  protected _running: boolean;
  
  /** Callback on iteration. */
  public _callback: () => Promise<void>;
  
  /** Callback on an iteration error. */
  public _callbackError: (error: any) => boolean;
  
  //-------------------------------------//
  
  /** Construct a new iteration thread controller. */
  public constructor(
    threads: number = 3,
    callback: () => Promise<void>,
    callbackError?: (error: any) => boolean,
    iterationDelay: number = 0
  ) {
    
    this.Threads = [];
    this._callback = callback;
    this._callbackError = callbackError;
    this._iterationDelay = iterationDelay || 0;
    
    this._running = false;
    this._stopped = true;
    
    this.AddThreads(threads);
    
  }
  
  /** Add an interation controller from the handled collection. */
  public AddThreads(count: number = 1): void {
    
    while(--count >= 0) {
      
      let iterationController = new IterationController(
        this._callback,
        this._callbackError,
        this._iterationDelay
      );
      
      this.Threads.push(iterationController);
      
      if(this._running) iterationController.Start();
      
    }
    
  }
  
  /** Pop an interation controller from the handled collection. */
  public async RemoveThreads(count: number = 1): Promise<void> {
    
    while(--count >= 0) {
      
      let iterationController = this.Threads.pop();
      if(!iterationController) return;
      
      await iterationController.Stop();
      
    }
    
  }
  
  /** Start iterating. Will throw if iteration has not stopped. */
  public Start(): void {
    if(!this.Stopped || this.Running) throw new Error(`Iteration is not stopped.`);
    this.Threads.forEach(i => i.Start());
    this._running = true;
  }
  
  /** Stop iterating. Will throw if iteration is stopped. */
  public StopSync(): void {
    if(this.Stopped || !this.Running) throw new Error(`Iteration is stopped.`);
    this._running = false;
    this.Threads.forEach(i => i.StopSync());
    this._stopped = true;
  }
  
  /** Stop iterating and wait for iteration to complete. Will throw if iteration is stopped. */
  public async Stop(): Promise<void> {
    if(this.Stopped || !this.Running) throw new Error(`Iteration is stopped.`);
    this.Running = false;
    await Promise.all(this.Threads.map(i => i.Stop()));
    this._stopped = true;
  }
  
  //-------------------------------------//
  
}

