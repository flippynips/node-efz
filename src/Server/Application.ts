/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: NodeJS application entry point
 * Revision History: None
 ******************************************************/

import * as Managers from './Managers/Index';
import { Configuration, IConfiguration } from './Tools/Index';

const JsScripts = require("../Common/Js/Index");

/** Main application */
export class Application {
  
  //---------------------------------------//
  
  /** Get whether the application is running else, it's stopping */
  public static get IsRunning(): boolean {
    return Application._running;
  }
  
  //---------------------------------------//
  
  /** Flag indicating whether the application is still running */
  private static _running: boolean;
  
  /** Collection of managers that are started and stopped during application execution */
  private static _managers: Array<Managers.Manager<any>>;
  
  //---------------------------------------//
  
  /** Run the application */
  public static async Run(): Promise<void> {
    
    try {
      
      // Start
      console.log(`Application started.`);
      Application._running = true;
      
      // add managers to list in order of execution
      Application._managers = [
        Managers.Log,
        Managers.Caches,
        Managers.Crypto,
        Managers.Database,
        Managers.Resources,
        Managers.Input,
        Managers.Server,
        Managers.Email
      ];
      
      // iterate and start the managers
      for(let i = 0; i < Application._managers.length; ++i) {
        let configuration: any = null;
        if(Application._managers[i].Configuration) {
          configuration = new Configuration(
            `./config/${Application._managers[i].constructor.name}.config`,
            Application._managers[i].Configuration);
        }
        await Application._managers[i].Start(configuration);
      }
      
      // start iterator
      this.Iterator();
      
      // subscribe to quit events
      Managers.Input.SubscribeToFlag('quit', Application.End, "'quit' closes the application");
      
    } catch(error) {
      
      // error out
      console.error("Unhandled exception running application! > " + error);
      
      // exit with error code
      process.exit(-1);
      
    }
    
  }
  
  /** Halt the application */
  public static End(): void {
    
    // set running flag
    Application._running = false;
    
  }
  
  //---------------------------------------//
  
  /** Iteration function */
  private static Iterator(): void {
    
    // is the application still running?
    if(Application._running) {
      
      // yes, iterate again
      setTimeout(Application.Iterator, 2000);
      
    } else {
      
      // no, stop the application
      Application.StopManagers()
        .then(() => {
          console.log(`Application ended.`);
          process.exit(0);
        })
        .catch(reason => {
          console.error(`Unhandled exception stopping application! ${reason}`);
          process.exit(-1);
        });
      
    }
    
  }
  
  /** Stop the managers */
  private static async StopManagers(): Promise<void> {
    
    // Stop the managers
    for(let i = Application._managers.length-1; i >= 0; --i) {
      await Application._managers[i].Stop();
    }
    
  }
  
}

// run the application!
Application.Run();
