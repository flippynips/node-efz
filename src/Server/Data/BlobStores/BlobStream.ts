/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Duplex stream for storing to and retrieving from
 *  a blob store entry.
 * Revision History: None
 ******************************************************/

import * as uuid from 'uuid';
import * as stream from 'stream';

import { IBlob } from './IBlob';
import { IBlobSegment } from './IBlobSegment';
import { BlobStore } from './BlobStore';
import { Log, Time } from '../../Managers/Index';

/** Stream used to read from and write to the blob store */
export class BlobStream extends stream.Duplex {
  
  //------------------------------------------//
  
  /** Default size of a single blob segment row */
  public static readonly DefaultSegmentLength: number = 1024 * 1024;
  
  /** Byte store metadata */
  public Blob: IBlob;
  
  //------------------------------------------//
  
  /** Current byte segment */
  private _blobSegment: IBlobSegment;
  
  /** Current buffer index within the current segment */
  private _segmentBufferIndex: number;
  /** Current */
  private _segmentIndex: number;
  
  /** Blob store containing table references used by this stream */
  private _blobStore: BlobStore;
  
  /** Flag indicating the current blob entry has changed */
  private _written: boolean;
  
  /** Flag indicating the current stream is retrieving a blob stream for reading */
  private _asyncOperation: boolean;
  
  //------------------------------------------//
  
  /** Construct a new stream */
  public static async Open(blobStore: BlobStore, name: string, version: number): Promise<BlobStream> {
    
    // try get the existing byte store instance from the table
    let blob: IBlob = await blobStore.BlobByName.GetBlob(name, version);
    
    let isNew: boolean = blob == null;
    
    // was the byte store retrieved?
    if(isNew) {
      // create a new bytestore
      blob = {
        Name: name,
        Version: version,
        BlobId: uuid.v1(),
        SegmentCount: 0,
        SegmentBufferLength: BlobStream.DefaultSegmentLength,
        TimeCreated: Time.Now,
        Metadata: {}
      };
    }
    
    // construct the stream
    var stream = new BlobStream(blobStore, blob);
    stream._written = isNew;
    
    // return the stream
    return stream;
        
  }
  
  /** Create a new stream for a new blob */
  public static async Create(blobStore: BlobStore, name: string, version: number, segmentLength: number = this.DefaultSegmentLength): Promise<BlobStream> {
    
    // try get the existing byte store instance from the table
    let blob: IBlob = await blobStore.BlobByName.GetBlob(name, version);
    
    let isNew: boolean = blob == null;
    
    // was the byte store retrieved?
    if(isNew) {
      // create a new bytestore
      blob = {
        Name: name,
        Version: version,
        BlobId: uuid.v1(),
        SegmentCount: 0,
        SegmentBufferLength: segmentLength,
        TimeCreated: Time.Now,
        Metadata: {}
      };
    } else {
      throw new Error(`A blob stream of that name already exists.`);
    }
    
    // construct the stream
    var stream = new BlobStream(blobStore, blob);
    stream._written = isNew;
    
    // return the stream
    return stream;
        
  }
  
  /** Construct the byte stream */
  private constructor(blobStore: BlobStore, blob: IBlob) {
    super({
      allowHalfOpen: true,
      readableObjectMode: true,
      writableObjectMode: true
    });
    
    this.Blob = blob;
    this._written = false;
    this._asyncOperation = false;
    this._blobStore = blobStore;
    this._segmentBufferIndex = 0;
    
  }
  
  //------------------------------------------//
  
  /** On the stream being ended */
  end(cb?: () => void): void {
    if(this._written) {
      // save the blob entry
      this._blobStore.BlobByName.SetBlob(this.Blob);
    }
    super.end(cb);
  }
  
  /** Write the specified chunk to the stream */
  async _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): Promise<void> {
    
    this._written = true;
    let buffer: Buffer;
    
    // get the buffer
    if(chunk == null) {
      buffer = new Buffer(0);
    } if(chunk instanceof Buffer) {
      buffer = chunk;
    } else {
      let type = typeof chunk;
      switch(type) {
        case 'string':
          buffer = new Buffer(chunk, encoding);
          break;
        case 'number':
          buffer = new Buffer(8);
          buffer.writeDoubleLE(chunk, 0);
          break;
        case 'boolean':
          buffer = new Buffer(1);
          if(chunk) buffer[0] = 1;
          else buffer[0] = 0;
          break;
        default:
          buffer = new Buffer(JSON.stringify(chunk), encoding);
          break;
      }
    }
    
    try {
      
      let bufferIndex: number = 0;
      
      // has a segment been referenced?
      if(!this._blobSegment) {
        
        // no, increment the segment index
        this._segmentIndex = 0;
        this._segmentBufferIndex = 0;
        
        // does a next segment exist?
        if(this._segmentIndex < this.Blob.SegmentCount) {
          
          // yes, get it
          this._blobSegment = await this._blobStore.BlobSegmentById.GetSegment(this.Blob.BlobId, this._segmentIndex);
          this._blobSegment.Written = true;
          
        } else {
          
          // no, create a new segment
          this._blobSegment = {
            Id: this.Blob.BlobId,
            Index: this._segmentIndex,
            Buffer: new Buffer(this.Blob.SegmentBufferLength),
            Written: true
          };
          
          // increment the segment count
          ++this.Blob.SegmentCount;
          
        }
        
      } else {
        // update segment buffer to max length
        if(this._blobSegment.Buffer.length < this.Blob.SegmentBufferLength) {
          let newBuffer: Buffer = Buffer.alloc(this.Blob.SegmentBufferLength);
          this._blobSegment.Buffer.copy(newBuffer, 0, 0, this._blobSegment.Buffer.length);
        }
      }
      
      // iterate while there are more bytes to write
      while(bufferIndex < buffer.length) {
        
        // is the current segment filled?
        if(this._segmentBufferIndex >= this.Blob.SegmentBufferLength) {
          
          // yes, save the current blob store segment
          this._blobStore.BlobSegmentById.SetSegment(this._blobSegment);
          
          // increment the segment index
          ++this._segmentIndex;
          this._segmentBufferIndex = 0;
          
          // does a next segment exist?
          if(this._segmentIndex < this.Blob.SegmentCount) {
            
            // yes, get it
            this._blobSegment = await this._blobStore.BlobSegmentById.GetSegment(this.Blob.BlobId, this._segmentIndex);
            this._blobSegment.Written = true;
            
          } else {
            
            // no, create a new segment
            this._blobSegment = {
              Id: this.Blob.BlobId,
              Index: this._segmentIndex,
              Buffer: new Buffer(this.Blob.SegmentBufferLength),
              Written: true
            };
            
            // increment the segment count
            ++this.Blob.SegmentCount;
            
          }
        }
        
        // get the number of bytes to copy
        let copyCount: number = buffer.length - bufferIndex;
        
        if(this.Blob.SegmentBufferLength - this._segmentBufferIndex < copyCount) {
          copyCount = this.Blob.SegmentBufferLength - this._segmentBufferIndex;
        }
        
        // copy bytes from the source buffer to the segment buffer
        buffer.copy(this._blobSegment.Buffer, this._segmentBufferIndex, bufferIndex, bufferIndex + copyCount + 1);
        bufferIndex += copyCount;
        this._segmentBufferIndex += copyCount;
        
      }
      
      if(this._segmentBufferIndex < this._blobSegment.Buffer.length) {
        // slice to match actual length
        this._blobSegment.Buffer = this._blobSegment.Buffer.slice(0, this._segmentBufferIndex+1);
      }
      
      // save the last blob segment
      this._blobStore.BlobSegmentById.SetSegment(this._blobSegment);
      
    } catch(error) {
      
      callback(error);
      return;
      
    }
    
    // run the callback
    callback();
    
  }
  
  /** Read a specified number of bytes from the stream */
  _read(size: number): void {
    
    // if this was called as a result of asynchronous operation, skip
    if(this._asyncOperation) return;
    
    let readBuffer: Buffer;
    let readBufferIndex: number = 0;
    
    // has a segment been referenced?
    if(this._blobSegment == null) {
      
      // no, increment the segment index
      this._segmentIndex = 0;
      this._segmentBufferIndex = 0;
      
      // does a segment exist?
      if(this._segmentIndex < this.Blob.SegmentCount) {
        
        // yes, get it
        this._asyncOperation = true;
        this._blobStore.BlobSegmentById.GetSegment(this.Blob.BlobId, this._segmentIndex)
          .then(segment => {
            this._blobSegment = segment;
            this.Read(size);
          })
          .catch(reason => {
            this._asyncOperation = false;
            Log.Error(`Blob stream ${this.Blob.Name} v${this.Blob.Version} error; ${reason}`);
          });
        return;
        
      } else {
        
        // no, end the stream immediately
        this.push(null);
        return;
        
      }
      
    }
    
    while(true) {
      
      // any more bytes in the segment?
      if(this._segmentBufferIndex < this._blobSegment.Buffer.length) {
        
        // yes, read from the segment
        if(this._segmentBufferIndex == 0) {
          
          this._segmentBufferIndex = this._blobSegment.Buffer.length;
          if(!this.push(this._blobSegment.Buffer)) break;
          readBufferIndex = 0;
          
        } else {
          
          if(!readBuffer) readBuffer = Buffer.alloc(size);
          
          if(this._blobSegment.Buffer.length - this._segmentBufferIndex > size - readBufferIndex) {
            
            this._blobSegment.Buffer.copy(readBuffer, readBufferIndex, this._segmentBufferIndex, this._segmentBufferIndex + (size - readBufferIndex));
            this._segmentBufferIndex += size - readBufferIndex;
            if(!this.push(readBuffer)) break;
            readBufferIndex = 0;
            
          } else {
            
            this._blobSegment.Buffer.copy(readBuffer, readBufferIndex, this._segmentBufferIndex, this._blobSegment.Buffer.length);
            readBufferIndex += this._blobSegment.Buffer.length - this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(readBufferIndex == size) {
              if(!this.push(readBuffer)) break;
              readBufferIndex = 0;
            }
            
          }
        }
        
      } else {
        
        // no, any more segments?
        ++this._segmentIndex;
        if(this._segmentIndex < this.Blob.SegmentCount) {
          
          // yes, get the next segment
          this._segmentBufferIndex = 0;
          this._asyncOperation = true;
          this._blobStore.BlobSegmentById.GetSegment(this.Blob.BlobId, this._segmentIndex)
            .then(segment => {
              this._blobSegment = segment;
              this.Read(size);
            })
            .catch(reason => {
              this._asyncOperation = false;
              Log.Error(`Blob stream ${this.Blob.Name} v${this.Blob.Version} error; ${reason}`);
            });
          return;
          
        } else {
          
          // no, no more bytes to read
          this._segmentIndex = this.Blob.SegmentCount;
          if(readBufferIndex > 0) {
            readBuffer = readBuffer.slice(0, readBufferIndex+1);
            this.push(readBuffer);
          }
          this.push(null);
          break;
          
        }
        
      }
      
    }
    
  }
  
  /** Internal read operation */
  Read(size: number): void {
    
    let readBuffer: Buffer;
    let readBufferIndex: number = 0;
    
    // has a segment been referenced?
    if(this._blobSegment == null) {
      
      // no, increment the segment index
      Log.Warning(`Unexpected end of stream segments in ${this.Blob.Name} v${this.Blob.Version}.`);
      this.push(null);
      this._asyncOperation = false;
      return;
      
    }
    
    while(true) {
      
      // any more bytes in the segment?
      if(this._segmentBufferIndex < this._blobSegment.Buffer.length) {
        
        // yes, read from the segment
        if(this._segmentBufferIndex == 0) {
          
          this._segmentBufferIndex = this._blobSegment.Buffer.length;
          if(!this.push(this._blobSegment.Buffer)) break;
          readBufferIndex = 0;
          
        } else {
          
          if(!readBuffer) readBuffer = Buffer.alloc(size);
          
          if(this._blobSegment.Buffer.length - this._segmentBufferIndex > size - readBufferIndex) {
            
            this._blobSegment.Buffer.copy(readBuffer, readBufferIndex, this._segmentBufferIndex, this._segmentBufferIndex + (size - readBufferIndex));
            this._segmentBufferIndex += size - readBufferIndex;
            if(!this.push(readBuffer)) break;
            readBufferIndex = 0;
            
          } else {
            
            this._blobSegment.Buffer.copy(readBuffer, readBufferIndex, this._segmentBufferIndex, this._blobSegment.Buffer.length);
            readBufferIndex += this._blobSegment.Buffer.length - this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(readBufferIndex == size) {
              if(!this.push(readBuffer)) break;
              readBufferIndex = 0;
            }
            
          }
        }
        
      } else {
        
        // no, any more segments?
        ++this._segmentIndex;
        if(this._segmentIndex < this.Blob.SegmentCount) {
          
          // yes, get the next segment
          this._segmentBufferIndex = 0;
          this._asyncOperation = true;
          this._blobStore.BlobSegmentById.GetSegment(this.Blob.BlobId, this._segmentIndex)
            .then(segment => {
              this._blobSegment = segment;
              this.Read(size);
            })
            .catch(reason => {
              this._asyncOperation = false;
              Log.Error(`Blob stream ${this.Blob.Name} v${this.Blob.Version} error; ${reason}`);
            });
          return;
          
        } else {
          
          // no, no more bytes to read
          this._segmentIndex = this.Blob.SegmentCount;
          if(readBufferIndex > 0) {
            readBuffer = readBuffer.slice(0, readBufferIndex+1);
            this.push(readBuffer);
          }
          this.push(null);
          break;
          
        }
        
      }
      
    }
    
    this._asyncOperation = false;
    
  }
  
}

