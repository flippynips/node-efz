/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class for loading and saving a Json configuration to and loading
 *  a configuration from a file.
 * Revision History: None
 ******************************************************/

import { IConfiguration, Log } from '../Managers/Index';
import { Json } from '../Tools/Index';

/** Class for easy management of configurations stored in json files. */
export class ConfigurationStore<T extends Object> implements IConfiguration<T> {
  
  //----------------------------------------//
  
  /** Configuration object. */
  public Item: T;
  /** Optional callback on the configuration file being loaded or updated. */
  public Callback: (config: T) => any;
  
  //----------------------------------------//
  
  /** Path of the configuration. */
  protected _path: string;
  
  /** Flag indicating the configuration is being written. */
  protected _writing: boolean;
  
  /** Default structure for configuration upon which loaded values will be overlayed */
  protected _defaultConfig: any;
  
  //----------------------------------------//
  
  /** Constructor of a new configuration */
  constructor(path: string, defaultConfig: T, onChange?: (config: any) => void) {
    
    // persist the path
    this._path = path;
    
    // persist the default configuration
    this._defaultConfig = defaultConfig;
    
    // persist the callback if set
    this.Callback = onChange;
    
  }
  
  /** Load or reload the configuration. */
  public LoadSync(): void {
    
    // set the object
    this.Item = this._defaultConfig;
    
    // open and read the file
    let configurationString: string;
    try {
      configurationString = window.localStorage.getItem(this._path);
    } catch(error) {
      Log.Warning(`Error reading from configuration file '${this._path}'. ${error}`);
      return;
    }
      
    let newConfig: any
    try {
      newConfig = JSON.parse(configurationString, Json.Parse);
    } catch(error) {
      Log.Warning(`Error loading configuration json from '${this._path}'. ${error}`);
      return;
    }
    
    // read the configuration object
    this.Item = { ...this._defaultConfig, ...newConfig };
    
    // run the callback if set
    try {
      if(this.Callback) this.Callback(this.Item);
    } catch(error) {
      Log.Error(`Error running configuration callback. ${error && error.stack || error}`);
    }
    
  }
  
  /** Load or reload the configuration */
  public async Load(): Promise<void> {
    
    // set the object
    this.Item = this._defaultConfig;
    let path: string = this._path;
    
    // read the file using a promise
    try {
      
      let configurationString = window.localStorage.getItem(this._path);
      
      let newConfig: any;
      try {
        newConfig = JSON.parse(configurationString, Json.Parse);
      } catch(error) {
        Log.Warning(`Error loading configuration json from '${this._path}'. ${error}`);
        return;
      }
      
      // read the configuration object
      this.Item = { ...this._defaultConfig, ...newConfig };
      
      // run the callback if set
      try {
        if(this.Callback) this.Callback(this.Item);
      } catch(error) {
        Log.Error(`Error running configuration callback. ${error && error.stack || error}`);
      }
      
    } catch(error) {
      
      // log the error
      Log.Error(`Coudn't load configuration from '${path}'. ${error}`);
      
    }
    
  }
  
  /** Save the current configuration */
  public SaveSync(): void {
    
    this._writing = true;
    try {
      
      // write the json configuration
      window.localStorage.setItem(this._path, JSON.stringify(this.Item, Json.Stringify, 2));
      
    } catch(error) {
      // log the error
      Log.Error(`There was an error saving the configuration file '${this._path}'. ${error}`);
    } finally {
      this._writing = false;
    }
    
  }
  
  /** Save the current configuration */
  public async Save(): Promise<void> {
    
    this._writing = true;
    try {
      
      // write the json configuration
      window.localStorage.setItem(this._path, JSON.stringify(this.Item, Json.Stringify, 2));
      
    } catch(error) {
      // log the error
      Log.Error(`There was an error saving the configuration file '${this._path}'. ${error}`);
    } finally {
      this._writing = false;
    }
      
    
  }
  
  //----------------------------------------//
  
}

