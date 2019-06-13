/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Duplex stream for storing to and retrieving from
 *  a blob store entry.
 * Revision History: None
 ******************************************************/

import * as uuid from 'uuid';
import * as stream from 'stream';

import { Log, Time } from '../../../Managers/Index';
import { Blob } from './Blob';
import { BlobSegment } from './BlobSegment';

import { BlobStore } from './BlobStore';

const DefaultSegmentLength: number = 1024 * 1024;

/** Stream used to read from and write to the blob store */
export class BlobStream extends stream.Duplex {
  
  //------------------------------------------//
  
  /** Blob store metadata */
  public Blob: Blob;
  /** Flag indicating non-ended state. */
  public IsAlive: boolean;
  
  /** Limit the number of bytes read per second. */
  public BytesPerSecond: number;
  
  /** If set, error that occurred during stream. */
  public Error?: Error;
  
  //------------------------------------------//
  
  /** Current blob segment */
  private _blobSegment: BlobSegment;
  
  /** Current segment index. */
  private _segmentIndex: number;
  /** Current buffer index within the current segment */
  private _segmentBufferIndex: number;
  
  /** Blob store containing table references used by this stream */
  private _blobStore: BlobStore;
  
  /** Flag indicating the current blob entry has changed */
  private _written: boolean;
  
  /** Flag indicating the current stream is retrieving a blob stream for reading */
  private _asyncOperation: boolean;
  
  /** Timer used to delay read bytes per second. */
  private _delayTimer: number;
  
  //------------------------------------------//
  
  /** Construct a new stream for an existing blob. */
  public static async Open(blobStore: BlobStore, name: string, version?: number): Promise<BlobStream> {
    
    // try get the existing blob instance from the table
    let blob: Blob = await blobStore.BlobByName.GetBlob(name, version);
    
    // was the blob found? no, return
    if(!blob) return null;
    
    // construct and return the stream
    return new BlobStream(blobStore, blob);
        
  }
  
  /** Create a new stream for a new blob. */
  public static async Create(
    blobStore: BlobStore,
    name: string,
    version?: number,
    segmentLength: number = DefaultSegmentLength
  ): Promise<BlobStream> {
    
    // try get the existing byte store instance from the table
    let blob: Blob = await blobStore.BlobByName.GetBlob(name, version);
    
    // was a blob retrieved?
    if(blob) {
      // yes, was the version specified?
      if(version == null) {
        // no, increment the version
        version = blob.Version+1;
      } else {
        // yes, this is a problem
        throw new Error(`A blob stream with name and version '${name} v${version}' already exists.`);
      }
    }
    
    // create a new blob
    blob = {
      Name: name,
      Version: version || 1,
      BlobId: uuid.v1().ReplaceAll('-'),
      Length: 0,
      SegmentCount: 0,
      SegmentBufferLength: segmentLength,
      TimeCreated: Time.NowSecs,
      Metadata: {}
    };
    
    // construct the stream
    let stream = new BlobStream(blobStore, blob);
    stream._written = true;
    
    // return the stream
    return stream;
        
  }
  
  /** Construct the byte stream */
  private constructor(blobStore: BlobStore, blob: Blob) {
    super({
      allowHalfOpen: true,
      readableObjectMode: false,
      writableObjectMode: false,
      highWaterMark: blob.SegmentBufferLength
    });
    
    this.Blob = blob;
    this.IsAlive = true;
    this._written = false;
    this._asyncOperation = false;
    this._blobStore = blobStore;
    
    this._segmentIndex = 0;
    this._segmentBufferIndex = 0;
    
  }
  
  /** Close the blob stream. */
  public Close(): Promise<void> {
    let self = this;
    return new Promise<void>((resolve) => { self.end(resolve); });
  }
  
  /** Seek to the specified index in the stream. Optionally
   * set the readable byte length.
   * Returns false if the index is beyond the stream length. */
  public Seek(index: number): boolean {
    
    if(index >= this.Blob.Length) return false;
    
    this._segmentBufferIndex = index % this.Blob.SegmentBufferLength;
    let segmentIndex = Math.floor(index/this.Blob.SegmentBufferLength);
    if(this._segmentIndex !== segmentIndex) {
      this._blobSegment = null;
      this._segmentIndex = segmentIndex;
    }
    
    return true;
    
  }
  
  //------------------------------------------//
  
  _final(callback: (error?: Error) => void): void {
    
    if(this.IsAlive) {
      
      // floop alive
      this.IsAlive = false;
      
      // has the stream been written to?
      if(this._written) {
        
        Log.Debug(`Finalizing blob stream; ${this.Blob.Length} : ${this.Blob.SegmentCount}`)
        
        // yes, save the blob entry
        let self = this;
        this._blobStore.BlobByName.SetBlob(this.Blob)
        .then(() => {
          callback();
        })
        .catch((err) => {
          self.Error = err;
          callback(err);
        });
        
        return;
        
      }
      
    }
    
    callback();
    
  }
  
  /** End the stream, calling final if required. */
  end(data?: any, enc?: any, cb?: any): void {
    
    if(typeof data === 'function') return this.end(null, null, data);
    if(typeof enc === 'function') return this.end(data, null, enc);
    
    if(data) {
      if(enc) this.write(data, enc);
      else this.write(data);
    }
    
    if(cb) cb();
    
    super.end();
    
  }
  
  
  /** Write the specified chunk to the stream */
  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    
    if(!this.IsAlive) {
      Log.Warning(`Attempt to write '${chunk && chunk.length || typeof chunk}' to blobstream after close.`);
      callback();
      return;
    }
    
    this._written = true;
    
    // get the buffer
    let buffer: Buffer;
    if(chunk == null) {
      buffer = Buffer.allocUnsafe(0);
    } if(chunk instanceof Buffer) {
      buffer = chunk;
    } else {
      let type = typeof chunk;
      switch(type) {
        case 'string':
          buffer = Buffer.from(chunk, encoding);
          break;
        case 'number':
          buffer = Buffer.allocUnsafe(8);
          buffer.writeDoubleLE(chunk, 0);
          break;
        case 'boolean':
          buffer = Buffer.allocUnsafe(1);
          if(chunk) buffer[0] = 1;
          else buffer[0] = 0;
          break;
        default:
          buffer = Buffer.from(JSON.stringify(chunk), encoding);
          break;
      }
    }
    
    let self = this;
    (async function(): Promise<void> {
      
      let bufferIndex: number = 0;
      
      // has a segment been referenced?
      if(!self._blobSegment) {
        
        // no, does the required segment exist?
        if(self._segmentIndex < self.Blob.SegmentCount) {
          
          // yes, get it
          self._blobSegment = await self._blobStore.BlobSegmentById.GetSegment(self.Blob.BlobId, self._segmentIndex);
          self._blobSegment.Written = true;
          
        } else {
          
          // no, create a new segment
          self._blobSegment = {
            Id: self.Blob.BlobId,
            Index: self._segmentIndex,
            Buffer: Buffer.allocUnsafe(self.Blob.SegmentBufferLength),
            Written: true
          };
          
          // increment the segment count
          ++self.Blob.SegmentCount;
          
        }
        
      } else {
        
        // update segment buffer to max length
        if(self._blobSegment.Buffer.length < self.Blob.SegmentBufferLength) {
          let oldBuffer = self._blobSegment.Buffer;
          self._blobSegment.Buffer = Buffer.allocUnsafe(self.Blob.SegmentBufferLength);
          oldBuffer.copy(self._blobSegment.Buffer, 0, 0, oldBuffer.length);
        }
        
      }
      
      // iterate while there are more bytes to write
      while(bufferIndex < buffer.length) {
        
        // is the current segment filled?
        if(self._segmentBufferIndex >= self.Blob.SegmentBufferLength) {
          
          // yes, save the current blob store segment
          await self._blobStore.BlobSegmentById.SetSegment(self._blobSegment);
          
          // increment the segment index
          ++self._segmentIndex;
          self._segmentBufferIndex = 0;
          
          // does a next segment exist?
          if(self._segmentIndex < self.Blob.SegmentCount) {
            
            // yes, get it
            self._blobSegment = await self._blobStore.BlobSegmentById.GetSegment(self.Blob.BlobId, self._segmentIndex);
            self._blobSegment.Written = true;
            
          } else {
            
            // no, create a new segment
            self._blobSegment = {
              Id: self.Blob.BlobId,
              Index: self._segmentIndex,
              Buffer: Buffer.allocUnsafe(self.Blob.SegmentBufferLength),
              Written: true
            };
            
            // increment the segment count
            ++self.Blob.SegmentCount;
            
          }
          
        }
        
        // get the number of bytes to copy
        let copyLength: number = buffer.length - bufferIndex;
        
        // are we reading past the current segment?
        if(self.Blob.SegmentBufferLength - self._segmentBufferIndex < copyLength) {
          // yes, prepare to fill remaining bytes in the current segment
          copyLength = self.Blob.SegmentBufferLength - self._segmentBufferIndex;
        }
        
        // copy bytes from the source buffer to the segment buffer
        buffer.copy(
          self._blobSegment.Buffer,
          self._segmentBufferIndex,
          bufferIndex,
          bufferIndex + copyLength
        );
        
        bufferIndex += copyLength;
        self._segmentBufferIndex += copyLength;
        self.Blob.Length += copyLength;
        
      }
      
      // are there remaining bytes in the current segment?
      if(self._segmentBufferIndex < self._blobSegment.Buffer.length) {
        // yes, slice to match actual length
        self._blobSegment.Buffer = self._blobSegment.Buffer.slice(0, self._segmentBufferIndex);
      }
      
      // save the last blob segment
      await self._blobStore.BlobSegmentById.SetSegment(self._blobSegment);
      
      // run the callback
      callback();
      
    })()
    .catch((error) => {
      
      // persist error
      self.Error = error;
      
      // callback with error
      callback(error);
      
    });
    
  }
  
  /** Read a specified number of bytes from the stream */
  _read(size: number): void {
    
    if(!this.IsAlive) {
      this.push(null);
      return;
    }
    
    // if this was called during an asynchronous operation, skip
    if(this._asyncOperation) return;
    
    // has a segment been referenced?
    if(!this._blobSegment) {
      
      // no, does the next segment exist?
      if(this._segmentIndex < this.Blob.SegmentCount) {
        
        // yes, fetch the next segment
        this._asyncOperation = true;
        let self = this;
        this._blobStore.BlobSegmentById.GetSegment(
          this.Blob.BlobId,
          this._segmentIndex
        )
        .then(segment => {
          self._blobSegment = segment;
          self.Read(size);
        })
        .catch((err) => {
          self._asyncOperation = false;
          self.IsAlive = false;
          self.Error = err;
          self.emit('error', err);
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
        if(this.BytesPerSecond) {
          
          if(this._segmentBufferIndex + this.BytesPerSecond < this._blobSegment.Buffer.length) {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex += this.BytesPerSecond;
            if(!this.push(this._blobSegment.Buffer.slice(index, index + this.BytesPerSecond))) break;
            
          } else {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer.slice(index, this._blobSegment.Buffer.length))) break;
            
          }
          
          this._asyncOperation = true;
          if(this._delayTimer) Time.RemoveTimer(this._delayTimer);
          this._delayTimer = Time.AddTimer(1000, this.Read, size);
          return;
          
        } else {
          if(this._segmentBufferIndex === 0) {
            
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer)) break;
            
          } else {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer.slice(index))) break;
            
          }
        }
        
      } else {
        
        // no, any more segments?
        ++this._segmentIndex;
        if(this._segmentIndex < this.Blob.SegmentCount) {
          
          // yes, get the next segment
          this._segmentBufferIndex = 0;
          this._asyncOperation = true;
          
          let self = this;
          this._blobStore.BlobSegmentById.GetSegment(
            this.Blob.BlobId,
            this._segmentIndex
          )
          .then(segment => {
            self._blobSegment = segment;
            self.Read(size);
          })
          .catch((err) => {
            self._asyncOperation = false;
            self.IsAlive = false;
            self.Error = err;
            self.emit('error', err);
          });
          
          return;
          
        } else {
          
          // no, no more bytes to read
          this._segmentIndex = this.Blob.SegmentCount;
          this.push(null);
          
          break;
          
        }
        
      }
      
    }
    
  }
  
  /** Internal read operation */
  private Read = (size: number): void => {
    
    if(!this.IsAlive) {
      this.push(null);
      return;
    }
    
    // was a segment fetched?
    if(this._blobSegment == null) {
      
      // no, this is bad, we were expecting more segments
      this._asyncOperation = false;
      this.IsAlive = false;
      this.Error = new Error(`Unexpected end of stream segments in '${this.Blob.Name} v${this.Blob.Version}'.`);
      this.emit('error', this.Error);
      return;
      
    }
    
    while(true) {
      
      // any more bytes in the segment?
      if(this._segmentBufferIndex < this._blobSegment.Buffer.length) {
        
        // yes, read from the segment
        if(this.BytesPerSecond) {
          
          if(this._segmentBufferIndex + this.BytesPerSecond < this._blobSegment.Buffer.length) {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex += this.BytesPerSecond;
            if(!this.push(this._blobSegment.Buffer.slice(index, index + this.BytesPerSecond))) break;
            
          } else {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer.slice(index, this._blobSegment.Buffer.length))) break;
            
          }
          
          if(this._delayTimer) Time.RemoveTimer(this._delayTimer);
          this._delayTimer = Time.AddTimer(1000, this.Read, size);
          return;
          
        } else {
          if(this._segmentBufferIndex === 0) {
            
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer)) break;
            
          } else {
            
            let index = this._segmentBufferIndex;
            this._segmentBufferIndex = this._blobSegment.Buffer.length;
            if(!this.push(this._blobSegment.Buffer.slice(index))) break;
            
          }
        }
        
      } else {
        
        // no, any more segments?
        ++this._segmentIndex;
        if(this._segmentIndex < this.Blob.SegmentCount) {
          
          // yes, get the next segment
          this._segmentBufferIndex = 0;
          let self = this;
          this._blobStore.BlobSegmentById.GetSegment(
            this.Blob.BlobId,
            this._segmentIndex
          )
          .then((segment) => {
            self._blobSegment = segment;
            self.Read(size);
          })
          .catch((err) => {
            self._asyncOperation = false;
            self.IsAlive = false;
            self.Error = err;
            self.emit('error', err);
          });
          
          return;
          
        } else {
          
          // no, no more bytes to read
          this._segmentIndex = this.Blob.SegmentCount;
          this.push(null);
          break;
          
        }
        
      }
      
    }
    
    this._asyncOperation = false;
    
  }
  
}

