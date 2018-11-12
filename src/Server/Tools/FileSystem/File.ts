/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Maintains the state of a file-system file in a folder.
 * Revision History: None
 ******************************************************/

import * as pathHelpers from 'path';
import * as fs from 'fs';
import * as pug from 'pug';

import { Folder } from './Index';
import { Log } from '../../Managers/Index';

/** Class representing a watchable file */
export class File {
  
  //-----------------------------------------//
  
  /** Parent folder of this file */
  public Parent: Folder;
  /** Path to the file */
  public Path: string;
  /** Name of the file */
  public Name: string;
  
  //-----------------------------------------//
  
  /** Watcher for the file */
  private _watcher: fs.FSWatcher;
  
  /** The file content as bytes */
  private _bytes: Buffer;
  
  /** Compiled pug template */
  private _template: pug.compileTemplate;
  
  /** Optional callback on the watched file changed */
  private _onChange: (file: File, event: string) => void;
  
  //-----------------------------------------//
  
  /** Create a new file representation */
  public constructor(parent: Folder, path: string, encoding: string = 'utf8', onChange?: (file: File, event: string) => void) {
    
    this.Parent = parent;
    this.Path = path;
    this.Name = pathHelpers.basename(path);
    
    this._watcher = fs.watch(path, { encoding: encoding, recursive: false, persistent: false });
    this._watcher.on('change', this.OnEvent);
    this._watcher.on('rename', this.OnEvent);
    this._watcher.on('error', this.OnError);
    
    this._onChange = onChange;
    
  }
  
  /** Dispose of the file watcher */
  public Dispose(): void {
    
    this._watcher.close();
    
    delete this._bytes;
    delete this.Parent;
    delete this.Path;
    delete this._watcher;
    delete this._template;
    
  }
  
  /** Get the compiled page from the local properties */
  public async GetPage(options: pug.LocalsObject = null): Promise<string> {
    if(this._bytes == null) await this.ReadFile();
    if(this._template == null) {
      this._template = pug.compile(this._bytes.toString('utf8'), {
        filename: this.Name,
        cache: true,
        pretty: true,
        basedir: pathHelpers.dirname(this.Path)
      });
    }
    // use the template to compile the page
    return this._template(options);
  }
  
  /** Get the file content as a utf8 encoded string */
  public GetStringSync(): string {
    if(this._bytes == null) this._bytes = fs.readFileSync(this.Path, null);
    return this._bytes.toString('utf8');
  }
  
  /** Get the file content as a utf8 encoded string */
  public async GetString(): Promise<string> {
    if(this._bytes == null) await this.ReadFile();
    return this._bytes.toString('utf8');
  }
  
  /** Get the file bytes */
  public GetBufferSync(): Buffer {
    if(this._bytes == null) this._bytes = fs.readFileSync(this.Path, null);
    return this._bytes;
  }
  
  /** Asynchronously get the file bytes */
  public async GetBuffer(): Promise<Buffer> {
    if(this._bytes == null) await this.ReadFile();
    return this._bytes;
  }
  
  //-----------------------------------------//
  
  /** Callback on the file updating */
  private OnEvent = (event: string, filename: string): void => {
    if(this.Parent) this.Parent.Refresh();
    if(this._onChange) this._onChange(this, event);
  }
  
  /** On an FSWatch error */
  private OnError = (error: Error) => {
    if(this.Parent) this.Parent.Refresh();
    if(this._onChange) this._onChange(this, 'error');
  }
  
  /** Read the file asynchronously */
  private async ReadFile(): Promise<void> {
    let self: File = this;
    await new Promise<Buffer>(
      function(resolve, reject) {
        fs.readFile(self.Path, null,
          (error: NodeJS.ErrnoException, data: Buffer) => {
            if(error) reject(error);
            else {
              self._bytes = data;
              resolve();
            }
          });
      })
      .catch((error) => {
        Log.Error(`There was an error reading file '${self.Path}'. ${error}`);
      });
  }
  
}
