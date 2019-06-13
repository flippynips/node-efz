/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Base class for managers. Handles automatic loading/
 *  unloading of configurations.
 * Revision History: None
 ******************************************************/

import { Log } from './Index';

/** Base manager class. */
export abstract class Manager {
  
  //--------------------------------------//
  
  //--------------------------------------//
  
  //--------------------------------------//
  
  /** Create a new manager. */
  constructor() {
  }
  
  /** Initialize the manager. */
  public async Start(): Promise<void> {
    
    // log
    Log.Info(`Starting ${this.constructor.name}`);
    
  }
  
  /** Dispose of resources used by the manager. */
  public async Stop(): Promise<void> {
    
    // log
    Log.Info(`Stopping ${this.constructor.name}`);
    
  }
  
  //--------------------------------------//
  
}
