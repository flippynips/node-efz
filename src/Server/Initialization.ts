/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: NodeJS application entry point
 * Revision History: None
 ******************************************************/

// source-map support
require('source-map-support').install();
process.on('unhandledRejection', console.log);

import { Application, Input, All } from './Managers/Index';
import { ConfigurationFile } from './Tools/Index';

/** Application initialization. */
export class Initialization {
  
  //---------------------------------------//
  
  //---------------------------------------//
  
  //---------------------------------------//
  
  /** Run the application */
  public static async Run(): Promise<void> {
    
    try {
      
      await Application.Run(
        'app',
        1.0,
        (path, version, onChange) => new ConfigurationFile(path, version, onChange),
        All
      );
      
      // subscribe to quit events
      Input.SubscribeToFlag('quit', Application.End, "'quit' closes the application");
      
    } catch(error) {
      
      // error out
      console.error(`Unhandled exception running application! > ${error && error.stack || error}`);
      
      // exit with error code
      process.exit(-1);
      
    }
    
  }
  
  //---------------------------------------//
  
}

Initialization.Run();
