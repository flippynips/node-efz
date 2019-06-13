
import { Sleep } from './Sleep';
import { CascadeRejection } from './Helpers';

export class RetryFactory {
  
  //------------------------------------------------------//
  
  /** Remaining retry count. */
  public RetryCount: number;
  /** Delay between each retry. */
  public RetryDelay: number;
  
  /** Flag that can be used to cancel iteration. */
  public Cancelled: boolean;
  
  //------------------------------------------------------//
  
  //------------------------------------------------------//
  
  /** Create a new RetryFactory. Will iterate indefinitely if retry count is <1. */
  constructor(retryCount: number = 0, retryDelay: number = 0) {
    this.RetryCount = retryCount;
    this.RetryDelay = retryDelay;
    this.Cancelled = false;
  }
  
  /** Start running the specified promise. Can return undefined if cancelled.
   * Will throw if the promise is rejected and retries exhausted. */
  public async Start<T>(promise: Promise<T>): Promise<T> {
    
    let result: T;
    let error: any;
    let complete: boolean;
    
    // iterate
    while(true) {
      
      // run the promise
      await promise
        .then((res: T) => {
          result = res;
          complete = true;
        }, CascadeRejection)
        .catch((err: any) => {
          error = err;
          complete = false;
        });
      
      // was the promise completed, or cancelled? yes, return
      if(complete || this.Cancelled) return result;
      
      // have retries been exhausted? yes, break
      if(--this.RetryCount === 0) break;
      
      // delay
      if(this.RetryDelay > 0) await Sleep(this.RetryDelay);
      
      // was the factory cancelled? yes, return
      if(this.Cancelled) return result;
      
    }
    
    // the promise wasn't able to be completed
    throw error || new Error('Retries exhausted.');
    
  }
  
  //------------------------------------------------------//
  
}

