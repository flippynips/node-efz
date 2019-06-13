/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Cache management. Functionality for caching items
 *  during runtime and flushing during application shutdown.
 * Revision History: None
 ******************************************************/

import { Manager } from "./Index";

/** Interface of configuration retrieval and update methods */
export interface IConfiguration<T extends Object> {
  
  //---------------------------------//
  
  /** Configuration object. */
  Item: T;
  
  /** Callback on the configuration being loaded or updated */
  Callback: (config: T) => void;
  
  /** Load or reload the configuration synchronously */
  LoadSync(): void;
  /** Load or reload the configuration */
  Load(): Promise<void>;
  
  /** Save the current configuration synchronously */
  SaveSync(): void;
  /** Save the current configuration */
  Save(): Promise<void>;
  
  //---------------------------------//
  
}

type ConfigConstructor = <T>(path: string, defaults: T, onChange?: (config: T) => void) => IConfiguration<T>;

/** Manager of application state information and control. */
class ApplicationControl {
  
  //-----------------------------------//
  
  /** Get whether the application is running else, it's stopping */
  public get IsRunning(): boolean {
    return this._running;
  }
  
  /** Name of the application. */
  public Name: string;
  /** Major.Minor version of the application. */
  public Version: number;
  
  /** Constructor for local persistance of manager configuration. */
  public Configuration: ConfigConstructor;
  
  /** Current collection of managers. */
  public Managers: Manager[];
  
  //-----------------------------------//
  
  /** Flag indicating application running state. */
  protected _running: boolean;
  
  //-----------------------------------//
  
  /** Run the application */
  public async Run(
    name: string,
    version: number,
    configConstructor: ConfigConstructor,
    managers: Manager[]
  ): Promise<void> {
    
    this.Name = name;
    this.Version = version;
    this.Configuration = configConstructor;
    this.Managers = managers;
    
    try {
      
      // Start
      console.log(`Application started.`);
      this._running = true;
      
      // iterate and start the managers
      for(let i = 0; i < this.Managers.length; ++i) {
        await this.Managers[i].Start();
      }
      
      // start iterator
      this.Iterator();
      
    } catch(error) {
      
      // error out
      console.error(`Unhandled exception running application! > ${error && error.stack || error}`);
      
      // exit with error code
      process.exit(-1);
      
    }
    
  }
  
  /** Halt the application */
  public End = (): void => {
    
    // set running flag
    this._running = false;
    
  }
  
  
  //-----------------------------------//
  
  /** Iteration function */
  private Iterator = (): void => {
    
    // is the application still running?
    if(this._running) {
      
      // yes, iterate again
      setTimeout(this.Iterator, 2000);
      
    } else {
      
      // no, stop the application
      this.StopManagers()
        .then(() => {
          console.log(`Application ended.`);
          process.exit(0);
        })
        .catch((error) => {
          console.error(`Unhandled exception stopping application! ${error}`);
          process.exit(-1);
        });
      
    }
    
  }
  
  /** Stop the managers */
  private async StopManagers(): Promise<void> {
    
    // Stop the managers
    for(let i = this.Managers.length-1; i >= 0; --i) {
      await this.Managers[i].Stop();
    }
    
  }
  
}

/** Application control instance. */
export const Application: ApplicationControl = new ApplicationControl();
