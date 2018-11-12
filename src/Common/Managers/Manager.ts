/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Base class for managers. Handles automatic loading/
 *  unloading of configurations.
 * Revision History: None
 ******************************************************/

import { Log } from './Index';
import { IConfiguration } from '../Tools/Index';

/** Base manager class. */
export abstract class Manager<T extends Object> {
  
  //--------------------------------------//
  
  public get Configuration(): T {
    return this._configuration.Item;
  }
  
  //--------------------------------------//
  
  /** Configuration of the manager autoloaded. */
  protected _configuration: IConfiguration<T>;
  
  //--------------------------------------//
  
  /** Create a new manager. */
  constructor(private configuration?: new () => T) {
    
    // get the default configuration
    this._configuration = <IConfiguration<T>>{
      Item: configuration ? new configuration(): null
    };
    
  }
  
  /** Initialize the manager. */
  public async Start(configuration?: IConfiguration<T>): Promise<void> {
    
    // log
    Log.Info(`Starting ${this.constructor.name}`);
    
    // has the configuration been provided?
    if(configuration) {
      // yes, set the configuration callback
      configuration.OnConfiguration = this.OnConfiguration;
      // load the configuration synchronously
      await configuration.Load();
    } else if(this.Configuration) {
      // run the callback with the current configuration
      this.OnConfiguration(this.Configuration);
    }
    
  }
  
  /** Dispose of resources used by the manager. */
  public async Stop(): Promise<void> {
    
    // log
    Log.Info(`Stopping ${this.constructor.name}`);
    
    try {
      
      // save the configuration
      if(this._configuration) await this._configuration.Save();
      
    } catch(error) {
      
      console.log(`Error saving configuration. ${error}`);
      
    }
    
  }
  
  //--------------------------------------//
  
  /** On the manager configuration file being changed. */
  protected OnConfiguration = function(config: T): void {
  }
  
}
