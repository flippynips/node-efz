/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Local file-system helper methods.
 * Revision History: None
 ******************************************************/

import * as pathHelpers from 'path';
import * as pug from 'pug';

import { IConfiguration, Application, Manager, Log } from './Index';
import { Folder, File } from '../Tools/FileSystem/Index';
import { Input } from './InputManager';
import { Files } from '../Tools/Index';

/** Resources configuration */
class Configuration {
  
  /** Path to where resources are relative. This directory will be watched. */
  SourceDirectory: string = `./resources/`;
  /** Number of milliseconds buffer between when a file change is detected and a refresh of the file-system occurs. */
  RefreshTimeout: number = 2000;
  
}

/** Manager and caching of required resources. */
class ResourcesManager extends Manager {
  
  //-------------------------------------//
  
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  public get SourceFolder(): Folder {
    return this._sourceFolder;
  }
  
  //-------------------------------------//
  
  /** Filesystem structure starting with the resource folder */
  protected _sourceFolder: Folder;
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-------------------------------------//
  
  /** Construct a new resource manager. */
  constructor() {
    super();
  }
  
  /** Start override to subscript to resource refresh commands */
  public async Start(): Promise<void> {
    await super.Start();
    
    this._configuration = Application.Configuration(
      './config/ResourcesManager.config',
      new Configuration(),
      this.OnConfiguration
    );
    await this._configuration.Load();
    
    Input.SubscribeToFlag('refresh resources', () => {
      this._sourceFolder.Refresh();
    }, `'refresh resources' to cause all cached resource files to be invalidated.`);
    
  }
  
  /** Get a html page resource by path */
  public async GetPage(path: string, options: pug.LocalsObject = null): Promise<string> {
    
    // normalise the path
    path = pathHelpers.normalize(path);
    
    // retrieve the page
    Log.Debug(`Retrieving page at path ${path}`);
    
    // get the file from the file structure
    let file : File = this._sourceFolder.GetFile(path.split(pathHelpers.sep));
    
    // was a file found? no, return null
    if(file == null) {
      Log.Warning(`Page at path ${path} wasn't found`);
      return null;
    }
    
    // get the page string
    let pageString: string = await file.GetPage(options);
    
    // return the complete page string
    return pageString;
    
  }
  
  /** Get the byte buffer at the specified path. */
  public async GetBuffer(...paths: string[]): Promise<Buffer> {
    
    // normalise the path
    for(let i = 0; i < paths.length; ++i) {
      paths[i] = pathHelpers.normalize(paths[i]);
    }
    
    let path: string = pathHelpers.join(...paths);
    
    // TODO : Remove
    // retrieve the buffer
    Log.Debug(`Retrieving buffer at path '${path}'`);
    
    let file: File = this._sourceFolder.GetFile(path.split(pathHelpers.sep));
    
    // was a file found? no, return null
    if(file == null) {
      Log.Verbose(`Buffer at path '${path}' wasn't found`);
      return null;
    }
    
    // return the file buffer
    return await file.GetBuffer();
    
  }
  
  //-------------------------------------//
  
  /** On the resources configuration being updated */
  protected OnConfiguration = (config: Configuration): void => {
    
    // setup the source folder
    if(this._sourceFolder) {
      this._sourceFolder.Dispose();
      this._sourceFolder = null;
    }
    if(config.SourceDirectory) {
      this._sourceFolder = new Folder(null, pathHelpers.resolve(config.SourceDirectory));
    }
    
  }
  
}

/** Global resources manager instance */
export const Resources: ResourcesManager = new ResourcesManager();
