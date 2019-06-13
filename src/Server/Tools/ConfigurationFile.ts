/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Helper class for loading and saving a Json configuration to and loading
 *  a configuration from a file.
 * Revision History: None
 ******************************************************/

import * as fs from 'fs';

import { IConfiguration, Log } from '../Managers/Index';
import { TimeoutController, Json } from '../Tools/Index';

/** Class for easy management of configurations stored in json files. */
export class ConfigurationFile<T extends Object> implements IConfiguration<T> {
  
  //----------------------------------------//
  
  /** Configuration object. */
  public Item: T;
  /** Optional callback on the configuration file being loaded or updated. */
  public Callback: (config: T) => any;
  
  //----------------------------------------//
  
  /** Path of the configuration. */
  protected _path: string;
  
  /** Watcher of changes to the configuration file. */
  protected _watcher: fs.FSWatcher; 
  
  /** Timeout controller for refreshing the configuration. */
  protected _onRefreshTimer: TimeoutController;
  
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
    
    // check the configuration file exists
    if (!fs.existsSync(this._path)) {
      let dir = this._path.substr(0, this._path.lastIndexOf('/'));
      try {
        fs.mkdirSync(dir);
      } catch(error) {
        // if the error isn't that the directory already exists, rethrow
        if(error.code !== 'EEXIST') throw error;
      }
      fs.writeFileSync(this._path, '{}', 'utf8');
    }
    
    // watch the configuration file for changes
    this._watcher = fs.watch(path, { encoding: 'utf8', recursive: false, persistent: false });
    this._watcher.on('change', this.OnEvent);
    this._watcher.on('rename', this.OnEvent);
    this._watcher.on('error', this.OnError);
    
    this._onRefreshTimer = new TimeoutController(2000, this.OnRefresh);
    
  }
  
  /** Load or reload the configuration. */
  public LoadSync(): void {
    
    // set the object
    this.Item = this._defaultConfig;
    
    // open and read the file
    let configurationString: string;
    try {
      configurationString = fs.readFileSync(this._path, 'utf8');
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
      
      let configurationString: string = await new Promise<string>(
        function(resolve, reject): void {
          fs.readFile(path, 'utf8',
            (error: NodeJS.ErrnoException, data: string) => {
              error ? reject(error) : resolve(data);
            });
        });
      
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
      fs.writeFileSync(this._path, JSON.stringify(this.Item, Json.Stringify, 2), 'utf8');
    } catch(error) {
      // log the error
      Log.Error(`There was an error saving the configuration file '${this._path}'. ${error}`);
    } finally {
      this._writing = false;
    }
    
  }
  
  /** Save the current configuration */
  public async Save(): Promise<void> {
    
    let configurationString: string = JSON.stringify(this.Item, Json.Stringify, 2);
    this._writing = true;
    let path: string = this._path;
    let self = this;
    
    // await the save promise
    await new Promise(
      function(resolve, reject) {
        fs.writeFile(path, configurationString, 'utf8',
          (error: NodeJS.ErrnoException) => {
            error ? reject(error) : resolve();
          });
      })
      .then(() => {
        self._writing = false;
      })
      .catch((error) => {
        self._writing = false;
        Log.Error(`There was an error saving the configuration file '${path}'. ${error}`);
      });
      
    
  }
  
  //----------------------------------------//
  
  /** On the refresh timer completing */
  protected OnRefresh = (): void => {
    let path: string = this._path;
    try {
      
      Log.Info(`Refreshing the configuration at '${path}'.`);
      
      fs.readFile(path, 'utf8', (error: NodeJS.ErrnoException, data: string) => {
        if(error) {
          // log the error
          Log.Warning(`There was an error reading the configuration file ${path}. ${error}`);
          return;
        }
        
        // read the configuration object
        let newConfig: any
        try {
          newConfig = JSON.parse(data, Json.Parse);
        } catch(error) {
          Log.Warning(`Error loading configuration json from '${this._path}'. ${error}`);
          return;
        }
        
        this.Item = { ...this._defaultConfig, ...newConfig };
        if(this.Callback) this.Callback(this.Item);
        
      });
      
    } catch(error) {
      
      Log.Error(`Coudn't load configuration from '${path}'. ${error}`);
      
    }
  }
  
  /** Callback on the file updating */
  protected OnEvent = (event: string, filename: string): void => {
    
    if(this._writing) return;
    this._onRefreshTimer.Set();
    
  }
  
  /** On an FSWatch error */
  protected OnError = (error: Error) => {
    
    if(this._writing) return;
    this._onRefreshTimer.Set();
    
  }
  
}

