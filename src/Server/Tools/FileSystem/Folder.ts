/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Maintains the state of a file-system folder.
 * Revision History: None
 ******************************************************/

import * as pathHelpers from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

import { TimeoutController } from '../Index';

import { File } from './File';
import { Log, Resources, Time } from '../../Managers/Index';

/** Class representing a watchable folder.
 * Emits :
 * - 'refresh(folder: Folder, changedFolders: string[], changedFiles: string[])'.
 * - 'dispose(folder: Folder)'.
 */
export class Folder extends EventEmitter {
  
  //-----------------------------------------//
  
  /** Path of the folder */
  public Path: string;
  /** Name of the folder */
  public Name: string;
  
  /** Parent of this folder (can be null) */
  public Parent: Folder;
  
  /** Flag indicating any change in this folder and
   * its children will cause this folder to be refreshed. */
  public get Cascade(): boolean {
    return this._cascade;
  }
  public set Cascade(value: boolean) {
    this._cascade = value;
    for(let folder of this.Folders) {
      folder.Cascade = value;
    }
  }
  
  /** Collection of files within the folder */
  public Files: Array<File>;
  /** Collection of folders within this folder */
  public Folders: Array<Folder>;
  
  //-----------------------------------------//
  
  /** Watcher for the folder */
  private _watcher: fs.FSWatcher;
  
  /** Timer for staggered refreshes */
  private _onRefreshTimer: TimeoutController;
  
  /** Collection of changed files. */
  private _changedFiles: string[];
  /** Collection of changed folders. */
  private _changedFolders: string[];
  
  /** Inner flag indicating refreshes should be forced. */
  private _cascade: boolean;
  
  //-----------------------------------------//
  
  /** Create a new folder representation */
  public constructor(parent: Folder, path: string) {
    super();
    
    this.Parent = parent;
    this.Path = path;
    this.Name = pathHelpers.basename(path);
    
    // watch for changes to the folder
    this._watcher = fs.watch(this.Path, { recursive: false, persistent: false });
    this._watcher.on('change', this.OnEvent);
    this._watcher.on('rename', this.OnEvent)
    this._watcher.on('error', this.OnError);
    
    this._onRefreshTimer = new TimeoutController(Resources.Configuration.RefreshTimeout, this.OnRefreshContent);
    
    this.Files = [];
    this.Folders = [];
    
    // initial content build
    this.OnRefreshContent();
    
  }
  
  /** Dispose of the folder watcher */
  public Dispose(): void {
    
    this._watcher.close();
    
    this.emit('dispose', this);
    
    // dispose of the content
    for(let i = 0; i < this.Files.length; ++i) this.Files[i].Dispose();
    for(let i = 0; i < this.Folders.length; ++i) this.Folders[i].Dispose();
    
    this._onRefreshTimer.Stop();
    
    delete this._onRefreshTimer;
    delete this._watcher;
    delete this.Files;
    delete this.Folders;
    
  }
  
  /** Refresh filesystem watcher. */
  public RefreshListeners() {
    
    if(this._watcher) this._watcher.close();
    
    // watch for changes to the folder
    this._watcher = fs.watch(this.Path, { recursive: false, persistent: false });
    this._watcher.on('change', this.OnEvent);
    this._watcher.on('rename', this.OnEvent)
    this._watcher.on('error', this.OnError);
    
    this.OnRefreshContent();
    
  }
  
  /** Get a folder by path. */
  public GetFolder(path: string[], index: number = 0): Folder {
    while(path[index] === '') ++index;
    
    if(index === path.length-1) {
      
      for(let i = 0; i < this.Folders.length; ++i) {
        if(path[index] === '') continue;
        if(this.Folders[i].Name === path[index]) {
          return this.Folders[i];
        }
      }
      
    } else {
      
      for(let i = 0; i < this.Folders.length; ++i) {
        if(this.Folders[i].Name === path[index]) {
          return this.Folders[i].GetFolder(path, ++index);
        }
      }
      
    }
    
    return null;
  }
  
  /** Get a file by path returns 'Null' if not found */
  public GetFile(path: string[], index: number = 0): File {
    while(path[index] === '') ++index;
    
    if(index === path.length-1) {
      
      for(let i = 0; i < this.Files.length; ++i) {
        if(path[index] === '') continue;
        if(this.Files[i].Name === path[index]) return this.Files[i];
      }
      
    } else {
      
      for(let i = 0; i < this.Folders.length; ++i) {
        if(this.Folders[i].Name === path[index]) return this.Folders[i].GetFile(path, ++index);
      }
      
    }
    
    return null;
  }
  
  /** Rebuild the content of the folder */
  public Refresh = (changedFolders?: string[], changedFiles?: string[]): void => {
    
    if(changedFolders) {
      if(this._changedFolders) {
        changedFolders.forEach(f => this._changedFolders.indexOf(f) === -1 && this._changedFolders.push(f))
      } else {
        this._changedFolders = changedFolders;
      }
    }
    
    if(changedFiles) {
      if(this._changedFiles) {
        changedFiles.forEach(f => this._changedFiles.indexOf(f) === -1 && this._changedFiles.push(f))
      } else {
        this._changedFiles = changedFiles;
      }
    }
    
    // should refresh cascade?
    if(this.Parent && this.Parent._cascade) {
      this._onRefreshTimer.Stop();
      this.Parent.Refresh(
        this._changedFolders,
        this._changedFiles
      );
      this._changedFiles = null;
      this._changedFolders = null;
      return;
    }
    
    if(Resources.Configuration.RefreshTimeout) {
      this._onRefreshTimer.Set();
    } else {
      this.OnRefreshContent();
    }
    
  }
  
  //-----------------------------------------//
  
  /** On timeout of the content being refreshed */
  private OnRefreshContent = (): void => {
    
    Log.Silly(`Rebuilding folder '${this.Path}'`);
    
    try {
      
      let files: File[] = [];
      let folders: Folder[] = [];
      
      // read the content of the folder
      let children = fs.readdirSync(this.Path);
      
      // iterate the child elements
      for(let i = 0; i < children.length; ++i) {
        children[i] = pathHelpers.join(this.Path, children[i]);
        
        let statistics: fs.Stats = fs.statSync(children[i]);
        if(statistics.isFile()) {
          let index = this.Files.findIndex(f => f.Path === children[i]);
          if(index === -1) {
            files.push(new File(this, children[i]));
          } else {
            let file = this.Files[index];
            this.Files.RemoveAt(index);
            file.RefreshListeners();
            files.push(file);
          }
        } else {
          let index = this.Folders.findIndex(f => f.Path === children[i]);
          if(index === -1) {
            let newFolder = new Folder(this, children[i]);
            if(this._cascade) newFolder.Cascade = true;
            folders.push(newFolder);
          } else {
            let folder = this.Folders[index];
            this.Folders.RemoveAt(index);
            folder.RefreshListeners();
            folders.push(folder);
          }
          
        }
      }
      
      // persist prior files and folders
      let oldFiles: File[] = this.Files;
      let oldFolders: Folder[] = this.Folders;
      
      // reference new files and folders
      this.Files = files;
      this.Folders = folders;
      
      // dispose of the old content
      for(let i = 0; i < oldFiles.length; ++i) oldFiles[i].Dispose();
      for(let i = 0; i < oldFolders.length; ++i) oldFolders[i].Dispose();
      
      this.emit('refresh', this, this._changedFolders || [], this._changedFiles || []);
      this._changedFiles = null;
      this._changedFolders = null;
      
    } catch(error) {
      if(!this.Parent) {
        Log.Warning(`Error refreshing root folder '${this.Path}'.`);
        this._onRefreshTimer.Set();
        return;
      }
    }
    
  }
  
  /** Callback on the folder updating */
  private OnEvent = (event: string, filename: string): void => {
    
    if(this._cascade) {
      let index = this.Files.findIndex(f => f.Name === filename);
      if(index === -1) {
        index = this.Folders.findIndex(f => f.Name === filename);
        this.Refresh(index === -1 ? null : [ this.Folders[index].Path ]);
      } else {
        this.Refresh(null, [ this.Files[index].Path ]);
      }
      return;
    }
    
    switch(event) {
      case 'rename':
        
        // get which entry was renamed
        
        let index = this.Files.findIndex(f => f.Name === filename);
        if(index === -1) {
          index = this.Folders.findIndex(f => f.Name === filename);
          this.Refresh(index === -1 ? null : [this.Folders[index].Path]);
        } else {
          this.Refresh(null, [this.Files[index].Path]);
        }
        
        return;
      case 'change':
        
        // check the change was local to this folder
        
        let children = fs.readdirSync(this.Path);
        
        for(let file of this.Files) {
          if(children.indexOf(file.Name) === -1) {
            this.Refresh(null, [ file.Path ]);
            return;
          }
        }
        
        for(let folder of this.Folders) {
          if(children.indexOf(folder.Name) === -1) {
            this.Refresh([ folder.Path ]);
            return;
          }
        }
        
        for(let i = 0; i < children.length; ++i) {
          let path = pathHelpers.join(this.Path, children[i]);
          
          let statistics: fs.Stats;
          try {
            statistics = fs.statSync(path);
          } catch(error) {
            Log.Warning(`Error reading statistics of '${path}'. ${error}`);
            continue;
          }
          
          if(statistics.isFile()) {
            if(this.Files.findIndex(f => f.Path === path) === -1) {
              this.Refresh(null, [ path ]);
              return;
            }
          } else {
            if(this.Folders.findIndex(f => f.Path === path) === -1) {
              this.Refresh([ path ]);
              return;
            }
          }
          
        }
        
        break;
      default:
        
        this.Refresh();
        
        break;
    }
    
  }
  
  /** On an FSWatch error */
  private OnError = (error: Error) => {
    
    // refresh the parent folder
    if(this.Parent) {
      if(this._changedFolders) this._changedFolders.push(this.Path);
      else this._changedFolders = [ this.Path ];
      this.Parent.Refresh(this._changedFolders, this._changedFiles);
      this._changedFolders = null;
      this._changedFiles = null;
    } else {
      Log.Warning(`Error watching root folder '${this.Path}'. ${error && error.stack || error}`);
    }
    
  }
  
}
