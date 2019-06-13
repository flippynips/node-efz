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
import { Blob } from "./Blob";

/** Access to blob storage functions */
export class BlobStore {
  
  //-------------------------------------------//
  
  /** Blob by name table */
  public BlobByName: BlobByName;
  /** Blob segments by id table */
  public BlobSegmentById: BlobSegmentById;
  
  //-------------------------------------------//
  
  //-------------------------------------------//
  
  /** Construct a new blob store reference for the specified keyspace.
   * Optionally prefixing relevant tables with the specified strings. */
  constructor(keyspace?: string, prefix?: string) {
    
    this.BlobSegmentById = new BlobSegmentById(keyspace, prefix || '');
    this.BlobByName = new BlobByName(keyspace, prefix || '');
    
  }
  
  /** Get a blob by name and version */
  public async GetBlob(name: string, version: number): Promise<Blob> {
    
    return await this.BlobByName.GetBlob(name, version);
    
  }
  
  /** Get the collection of blobs represented by the specified name */
  public async GetBlobs(name: string): Promise<Blob[]> {
    
    return await this.BlobByName.GetBlobs(name);
    
  }
  
  /** Get an existing blob stream by name and optionally by version */
  public async GetStream(name: string, version?: number): Promise<BlobStream> {
    
    return await BlobStream.Open(this, name, version);
    
  }
  
  /** Remove all blobs matching the name and optional version */
  public async RemoveBlob(name: string, version?: number): Promise<void> {
    
    if(version == null || isNaN(version)) {
      
      let blobEntries: Blob[] = await this.BlobByName.GetBlobs(name);
      await this.BlobByName.RemoveBlob(name);
      
      for(let blobEntry of blobEntries) {
        for(let i = 0; i < blobEntry.SegmentCount; ++i) {
          await this.BlobSegmentById.Remove(blobEntry.BlobId, i);
        }
      }
      
    } else {
      
      let blobEntry: Blob = await this.BlobByName.GetBlob(name, version);
      await this.BlobByName.RemoveBlob(name, version);
      
      for(let i = 0; i < blobEntry.SegmentCount; ++i) {
        await this.BlobSegmentById.Remove(blobEntry.BlobId, i);
      }
      
    }
    
  }
  
  //-------------------------------------------//
  
}

/** Master blobs instance. */
export const Blobs: BlobStore = new BlobStore();
