/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Master class of the tables; BlobByName and BlobSegmentById.
 *  Provides helper methods for interacting with these tables.
 * Revision History: None
 ******************************************************/

import { BlobSegmentById } from "./BlobSegmentById";
import { BlobByName } from "./BlobByName";
import { BlobStream } from "./BlobStream";
import { IBlob } from "./IBlob";

/** Access to blob storage functions */
export class BlobStore {
  
  //-------------------------------------------//
  
  /** Blob by name table */
  public BlobByName: BlobByName;
  /** Blob segments by id table */
  public BlobSegmentById: BlobSegmentById;
  
  //-------------------------------------------//
  
  //-------------------------------------------//
  
  /** Construct a new blob store referece for the specified keyspace */
  constructor(keyspace: string) {
    
    this.BlobSegmentById = new BlobSegmentById(keyspace);
    this.BlobByName = new BlobByName(keyspace);
    
  }
  
  /** Get a blob by name and version */
  public async GetBlob(name: string, version: number): Promise<IBlob> {
    
    return await this.BlobByName.GetBlob(name, version);
    
  }
  
  /** Get the collection of blobs represented by the specified name */
  public async GetBlobs(name: string): Promise<IBlob[]> {
    
    return await this.BlobByName.GetBlobs(name);
    
  }
  
  /** Get a blob stream by name and optionally by version */
  public async GetStream(name: string, version?: number): Promise<BlobStream> {
    
    return await BlobStream.Open(this, name, version);
    
  }
  
  /** Remove all blobs matching the name and optional version */
  public async RemoveBlob(name: string, version?: number): Promise<void> {
    
    if(version == null || isNaN(version)) {
      
      let blobEntries: IBlob[] = await this.BlobByName.GetBlobs(name);
      await this.BlobByName.RemoveBlob(name);
      
      for(let blobEntry of blobEntries) {
        for(let i = 0; i < blobEntry.SegmentCount; ++i) {
          await this.BlobSegmentById.Remove(blobEntry.BlobId, i);
        }
      }
      
    } else {
      
      let blobEntry: IBlob = await this.BlobByName.GetBlob(name, version);
      await this.BlobByName.RemoveBlob(name, version);
      
      for(let i = 0; i < blobEntry.SegmentCount; ++i) {
        await this.BlobSegmentById.Remove(blobEntry.BlobId, i);
      }
      
    }
    
  }
  
  //-------------------------------------------//
  
}

export const Blobs: BlobStore = new BlobStore('global');
