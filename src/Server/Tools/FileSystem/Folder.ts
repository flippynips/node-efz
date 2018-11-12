/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Maintains the state of a file-system folder.
 * Revision History: None
 ******************************************************/

import * as pathHelpers from 'path';
import * as fs from 'fs';

import { TimeoutController } from '../Index';

import { File } from './File';
import { Log, Resources } from '../../Managers/Index';

/** Class representing a watchable folder */
export class Folder {
  
  //-----------------------------------------//
  
  /** Path of the folder */
  public Path: string;
  /** Name of the folder */
  public Name: string;
  
  /** Parent of this folder (can be null) */
  public Parent: Folder;
  
  //-----------------------------------------//
  
  /** Collection of files within the folder */
  private files: Array<File>;
  /** Collection of folders within this folder */
  private folders: Array<Folder>;
  
  /** Watcher for the folder */
  private watcher: fs.FSWatcher;
  
  /** Timer for staggered refreshes */
  private onRefreshTimer: TimeoutController;
  
  //-----------------------------------------//
  
  /** Create a new folder representation */
  public constructor(parent: Folder, path: string) {
    
    this.Parent = parent;
    this.Path = path;
    this.Name = pathHelpers.basename(path);
    
    // watch for changes to the folder
    this.watcher = fs.watch(this.Path, { recursive: false, persistent: false });
    this.watcher.on('change', this.OnEvent);
    this.watcher.on('rename', this.OnEvent)
    this.watcher.on('error', this.OnError);
    
    this.onRefreshTimer = new TimeoutController(Resources.Configuration.RefreshTimeout, this.OnRefreshContent);
    
    this.files = [];
    this.folders = [];
    
    // initial content build
    this.OnRefreshContent();
    
  }
  
  /** Dispose of the folder watcher */
  public Dispose(): void {
    
    this.watcher.close();
    
    // dispose of the content
    for(let i = 0; i < this.files.length; ++i) this.files[i].Dispose();
    for(let i = 0; i < this.folders.length; ++i) this.folders[i].Dispose();
    
    this.onRefreshTimer.Stop();
    
    delete this.onRefreshTimer;
    delete this.watcher;
    delete this.files;
    delete this.folders;
    
  }
  
  /** Get a file by path returns 'Null' if not found */
  public Get(path: string[], index: number = 0): File {
    while(path[index] === '') ++index;
    
    if(index === path.length-1) {
      
      for(let i = 0; i < this.files.length; ++i) {
        if(path[index] === '') continue;
        if(this.files[i].Name === path[index]) return this.files[i];
      }
      
    } else {
      
      for(let i = 0; i < this.folders.length; ++i) {
        if(this.folders[i].Name === path[index]) return this.folders[i].Get(path, ++index);
      }
      
    }
    
    return null;
    
  }
  
  /** Rebuild the content of the folder */
  public Refresh(): void {
    
    if(Resources.Configuration.RefreshTimeout) {
      this.onRefreshTimer.Set();
    } else {
      this.OnRefreshContent();
    }
    
  }
  
  //-----------------------------------------//
  
  /** On timeout of the content being refreshed */
  private OnRefreshContent = (): void => {
    
    Log.Debug(`Rebuilding folder '${this.Path}'`);
    
    let files: File[] = [];
    let folders: Folder[] = [];
    
    // populate the files and folders
    var children = fs.readdirSync(this.Path);
    
    // iterate the child elements
    for(let i = 0; i < children.length; ++i) {
      children[i] = pathHelpers.join(this.Path, children[i]);
      let statistics: fs.Stats = fs.statSync(children[i]);
      if(statistics.isFile()) {
        files.push(new File(this, children[i]));
      } else {
        folders.push(new Folder(this, children[i]));
      }
    }
    
    // persist prior files and folders
    let oldFiles: File[] = this.files;
    let oldFolders: Folder[] = this.folders;
    
    // reference new files and folders
    this.files = files;
    this.folders = folders;
    
    // dispose of the old content
    for(let i = 0; i < oldFiles.length; ++i) oldFiles[i].Dispose();
    for(let i = 0; i < oldFolders.length; ++i) oldFolders[i].Dispose();
    
  }
  
  /** Callback on the folder updating */
  private OnEvent = (event: string, filename: string): void => {
    
    this.Refresh();
    
  }
  
  /** On an FSWatch error */
  private OnError = (error: Error) => {
    
    // refresh the parent folder
    if(this.Parent) this.Parent.Refresh();
    
  }
  
}
