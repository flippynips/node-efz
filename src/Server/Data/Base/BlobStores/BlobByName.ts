/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table of blob metadata by name.
 * Revision History: None
 ******************************************************/

import * as cassandra from 'cassandra-driver';

import { Table } from '../Table';
import { Blob } from './Blob';
import { Caches, Log } from '../../../Managers/Index';
import { ColumnType } from '../ColumnType';
import { Dictionary } from '../../../Tools/Index';

const KeyName = 'n';
const KeyVersion = 'v';
const KeyBlobId = 'i';
const KeyLength = 'l';
const KeySegmentCount = 'c';
const KeySegmentLength = 's';
const KeyTimeCreated = 't';
const KeyMetadata = 'm';

const CacheKey: string = 'blob_by_name';
const CacheTtl: number = 1000 * 60;
const SelectSingle = `${KeyBlobId},${KeyLength},${KeySegmentCount},${KeySegmentLength},${KeyTimeCreated},${KeyMetadata}`;
const SelectAll = `${KeyVersion},${KeyBlobId},${KeyLength},${KeySegmentCount},${KeySegmentLength},${KeyTimeCreated},${KeyMetadata}`;

/** Table of blob metadata by name */
export class BlobByName extends Table {
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table. */
  public constructor(keyspace: string, prefix: string) {
    super(prefix+'BlobByName', keyspace, [
      { Name: KeyName, DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: KeyVersion, DataType: 'int', ColumnType: ColumnType.ClusterKey },
      { Name: KeyBlobId, DataType: 'ascii', ColumnType: ColumnType.DataColumn },
      { Name: KeyLength, DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: KeySegmentCount, DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: KeySegmentLength, DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: KeyTimeCreated, DataType: 'bigint', ColumnType: ColumnType.DataColumn },
      { Name: KeyMetadata, DataType: 'text', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table. */
  public async Initialize(): Promise<void> {
    await super.Initialize();
    // create a cache collection for the blobs
    Caches.CreateCache<Blob[]>(
      CacheKey,
      200000
    );
  }
  
  /** Create/update a blob */
  public async SetBlob(blob: Blob): Promise<void> {
    
    // set in cache
    let cached = Caches.TryGet<Blob[]>(CacheKey, blob.Name);
    if(cached) {
      let cachedIndex = cached.findIndex(b => b.BlobId === blob.BlobId && b.Version === blob.Version);
      if(cachedIndex === -1) cached.push(blob);
      else cached[cachedIndex] = blob;
    }
    
    // update
    await this.Update(
      [
        { column: KeyBlobId, param: blob.BlobId },
        { column: KeyLength, param: blob.Length },
        { column: KeySegmentCount, param: blob.SegmentCount },
        { column: KeySegmentLength, param: blob.SegmentBufferLength },
        { column: KeyTimeCreated, param: blob.TimeCreated },
        { column: KeyMetadata, param: JSON.stringify(blob.Metadata) }
      ],
      [
        { spec: `${KeyName}=?`, param: blob.Name },
        { spec: `${KeyVersion}=?`, param: blob.Version }
      ]
    );
    
  }
  
  /** Get a blob by name, optionally by version. If version is not specified,
   * the most recent version is retrieved. */
  public async GetBlob(name: string, version?: number): Promise<Blob> {
    
    if(name == null) {
      Log.Error('Blob name was not specified.');
      return null;
    }
    
    let blob: Blob = null;
    
    // try get from the cache
    let cached = Caches.TryGet<Blob[]>(CacheKey, name, CacheTtl);
    if(cached) {
      if(version == null) {
        for(let cachedBlob of cached) {
          if(!blob || cachedBlob.Version > blob.Version) {
            blob = cachedBlob;
          }
        }
        return blob;
      } else {
        for(let cachedBlob of cached) {
          if(cachedBlob.Version === version) {
            return cachedBlob;
          }
        }
      }
    }
    
    let row: cassandra.types.Row;
    if(version == null) {
      
      for(let r of await this.Select(
        SelectAll,
        [{ spec: `${KeyName}=?`, param: name }]
      )) {
        
        if(!row || r[KeyVersion] > row[KeyVersion]) row = r;
        
      }
      
      if(!row) return null;
      
      blob = this.ParseBlob(row);
      blob.Name = name;
      blob.Version = row[KeyVersion];
      
      // merge into the cache
      Caches.SetOrGet(CacheKey, name, [ blob ]);
      
    } else {
      
      // get the blob by version
      row = await this.SelectSingle(
        SelectSingle,
        [
          { spec: `${KeyName}=?`, param: name },
          { spec: `${KeyVersion}=?`, param: version }
        ]
      );
      
      if(!row) return null;
      
      blob = this.ParseBlob(row);
      blob.Name = name;
      blob.Version = version;
      
      // merge into the cache
      if(cached) {
        let cachedIndex = cached.findIndex(b => b.Version === version);
        if(cachedIndex === -1) cached.push(blob);
        else cached[cachedIndex] = blob;
      }
      
    }
    
    // return the permissions
    return blob;
    
  }
  
  /** Get all blob entries that match the specified name */
  public async GetBlobs(name: string): Promise<Blob[]> {
    
    if(name == null) {
      Log.Error('Blob name was not specified.');
      return null;
    }
    
    let blobs: Blob[] = [];
    
    // iterate the blob entries matching the name
    for(let row of await this.Select(
      SelectAll,
      [ { spec: `${KeyName}=?`, param: name } ])
    ) {
      
      if(row == null) continue;
      
      let blob = this.ParseBlob(row);
      blob.Name = name;
      blob.Version = row[KeyVersion];
      
      // add to the current collection
      blobs.push(blob);
      
    }
    
    if(blobs.length > 0) blobs = Caches.SetOrGet(CacheKey, name, blobs);
    
    // return the blobs
    return blobs;
    
  }
  
  /** Remove a blob or entries if version is not specified */
  public async RemoveBlob(name: string, version?: number): Promise<void> {
    
    Caches.Delete(CacheKey, name);
    
    if(version == null || isNaN(version)) {
      
      // iterate the blob versions
      for(let row of await this.Select(
        KeyVersion,
        [ { spec: `${KeyName}=?`, param: name } ]
      )) {
        
        if(row == null) continue;
        
        // delete from the database
        await this.Delete([
          { spec: `${KeyName}=?`, param: name },
          { spec: `${KeyVersion}=?`, param: row[KeyVersion] }
        ]);
        
      }
      
    } else {
      
      // delete the blob row
      await this.Delete([
        { spec: `${KeyName}=?`, param: name },
        { spec: `${KeyVersion}=?`, param: version }
      ]);
      
    }
    
    Caches.Delete(CacheKey, name);
    
  }
  
  //------------------------------------------//
  
  /** Parse a row into a blob instance. Name and version are excluded. */
  protected ParseBlob(row: cassandra.types.Row): Blob {
    
    let metadata: Dictionary<any>;
    try {
      metadata = row[KeyMetadata]
        ? JSON.parse(row[KeyMetadata])
        : {};
    } catch(error) {
      Log.Warning(`Error parsing blob metadata. ${error}`);
      metadata = {};
    }
    
    // construct the permissions structure
    return {
      Name: null,
      Version: null,
      BlobId: row[KeyBlobId],
      Length: row[KeyLength],
      SegmentCount: row[KeySegmentCount],
      SegmentBufferLength: row[KeySegmentLength],
      TimeCreated: row[KeyTimeCreated].toNumber(),
      Metadata: metadata
    };
    
  }
  
}

