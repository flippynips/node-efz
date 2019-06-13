import { Sleep } from "./Index";

/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class to maintain looping functions.
 * Revision History: None
 ******************************************************/

/** Iteration controller */
export class IterationController {
  
  //-------------------------------------//
  
  /** Callback on iteration. */
  public Callback: () => Promise<void>;
  
  /** Callback on an iteration error. */
  public CallbackError: (error: any) => boolean;
  
  /** Flag indicating iteration is running. */
  public Running: boolean;
  
  /** Flag indicating the iteration is stopped. */
  public Stopped: boolean;
  
  /** Delay between each iteration callback. */
  public IterationDelay: number;
  
  //-------------------------------------//
  
  //-------------------------------------//
  
  /** Construct a new timeout controller */
  public constructor(callback: () => Promise<void>, callbackError?: (error: any) => boolean, iterationDelay: number = 0) {
    
    this.Callback = callback;
    this.CallbackError = callbackError;
    this.IterationDelay = iterationDelay || 0;
    
    this.Running = false;
    this.Stopped = true;
    
  }
  
  /** Start iterating. Will throw if iteration has not stopped. */
  public Start(): void {
    if(!this.Stopped || this.Running) throw new Error(`Iteration is not stopped.`);
    this.Running = true;
    let self = this;
    this.Update()
      .then(() => {
        self.Stopped = true;
      })
      .catch(error => {
        self.Running = false;
        self.Stopped = true;
        if(self.CallbackError) {
          if(self.CallbackError(error)) self.Start();
        }
      });
  }
  
  /** Stop iterating. Will throw if iteration is stopped. */
  public StopSync(): void {
    if(this.Stopped || !this.Running) throw new Error(`Iteration is stopped.`);
    this.Running = false;
  }
  
  /** Stop iterating and wait for iteration to complete. Will throw if iteration is stopped. */
  public async Stop(): Promise<void> {
    if(this.Stopped || !this.Running) throw new Error(`Iteration is stopped.`);
    this.Running = false;
    while(!this.Stopped) await Sleep(20);
  }
  
  //-------------------------------------//
  
  /** On the timeout callback */
  private async Update(): Promise<void> {
    
    while(this.Running) {
      await this.Callback();
      if(this.IterationDelay > 0) await Sleep(this.IterationDelay);
    }
    
  }
  
}

