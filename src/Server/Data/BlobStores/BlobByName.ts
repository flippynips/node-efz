/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table of blob metadata by name.
 * Revision History: None
 ******************************************************/

import { Table } from '../Table';
import { IBlob } from './IBlob';
import { Caches, Log } from '../../Managers/Index';
import { ColumnType } from '../ColumnType';
import { Application } from '../../Application';

/** Table of blob metadata by name */
export class BlobByName extends Table {
  
  //------------------------------------------//
  
  /** Permissions cache collection key */
  public static readonly CacheKey: string = 'blob_by_name';
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table */
  public constructor(keyspace: string) {
    super('BlobByName', keyspace, [
      { Name: 'name', DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: 'version', DataType: 'int', ColumnType: ColumnType.ClusterKey },
      { Name: 'blobid', DataType: 'ascii', ColumnType: ColumnType.DataColumn },
      { Name: 'segmentcount', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'segmentlength', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'timecreated', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'metadata', DataType: 'text', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table */
  public async Initialize(): Promise<void> {
    super.Initialize();
    // create a cache collection for the permissions
    Caches.CreateCache<IBlob>(BlobByName.CacheKey, 200, 100, null, null, this.UpdateBlob);
  }
  
  /** Update a blob */
  public async SetBlob(blob: IBlob): Promise<void> {
    
    // set in cache
    Caches.Set(BlobByName.CacheKey, `${blob.Name}|${blob.Version}`, blob);
    
    // update
    this.UpdateBlob(`${blob.Name}|${blob.Version}`, blob);
    
  }
  
  /** Get a blob by name. */
  public async GetBlob(name: string, version?: number): Promise<IBlob> {
    if(name == null) {
      Log.Error('Blob name was not specified.');
      return null;
    }
    
    if(version == null || isNaN(version)) version = 0;
    
    let blob: IBlob;
    
    // try get from the cache
    blob = Caches.TryGet(BlobByName.CacheKey, `${name}|${version}`);
    
    // was the blob retrieved from the cache? yes, return
    if(blob != null) return blob;
    
    // get the blob details
    let row: any;
    try {
      row = await this.SelectSingle('blobid, segmentcount, segmentlength, timecreated, metadata', [
        { spec: 'name=?', param: name },
        { spec: 'version=?', param: version }
      ]);
    } catch(error) {
      Log.Error(`There was an error retrieving the blob of name ${name}, version ${version}. ${error}`);
      return null;
    }
    
    // was the row retrieved? no, return
    if(!row) return null;
    
    // construct the permissions structure
    blob = {
      Name: name,
      Version: version,
      BlobId: row['blobid'],
      SegmentCount: row['segmentcount'],
      SegmentBufferLength: row['segmentlength'],
      TimeCreated: row['timecreated'],
      Metadata: JSON.parse(row['metadata'])
    };
    
    // add the permissions to the cache
    blob = Caches.AddOrGet(BlobByName.CacheKey, `${name}|${version}`, blob);
    
    // return the permissions
    return blob;
    
  }
  
  /** Get blob entries that match the specified name */
  public async GetBlobs(name: string): Promise<IBlob[]> {
    if(name == null) {
      Log.Error('Blob name was not specified.');
      return null;
    }
    
    let blobs: IBlob[] = [];
    
    // get the blob details
    let row: any;
    try {
      
      // iterate the blob entries matching the name
      for(let row of await this.Select('version, blobid, segmentcount, segmentlength, timecreated, metadata',
        [
          { spec: 'name=?', param: name }
        ])) {
        
        if(row == null) continue;
        
        // construct the permissions structure
        let blob: IBlob = {
          Name: name,
          Version: row['version'],
          BlobId: row['blobid'],
          SegmentCount: row['segmentcount'],
          SegmentBufferLength: row['segmentlength'],
          TimeCreated: row['timecreated'],
          Metadata: JSON.parse(row['metadata'])
        };
        
        // add to the cache
        blob = Caches.AddOrGet(BlobByName.CacheKey, `${name}|${row['version']}`, blob);
        
        // add to the current collection
        blobs.push(blob);
        
      }
      
    } catch(error) {
      Log.Error(`There was an error retrieving the blob of name ${name}. ${error}`);
      return null;
    }
    
    // return the permissions
    return blobs;
    
  }
  
  /** Remove a blob or entries if version is not specified */
  public async RemoveBlob(name: string, version?: number): Promise<void> {
    
    if(version == null || isNaN(version)) {
      
      // get the blob details
      let row: any;
      try {
          
        // remove the default version '0' from the cache
        Caches.Delete(BlobByName.CacheKey, `${name}|0`);
        
        for(let row of await this.Select('version, blobid, segmentcount, segmentlength, timecreated, metadata',
          [
            { spec: 'name=?', param: name }
          ])) {
          
          if(row == null) continue;
          
          // construct the permissions structure
          let blob: IBlob = {
            Name: name,
            Version: row['version'],
            BlobId: row['blobid'],
            SegmentCount: row['segmentcount'],
            SegmentBufferLength: row['segmentlength'],
            TimeCreated: row['timecreated'],
            Metadata: JSON.parse(row['metadata'])
          };
          
          // delete from the database
          await this.Delete([
            { spec: 'name=?', param: name },
            { spec: 'version=?', param: blob.Version }
          ]);
          
          // remove from the cache
          Caches.Delete(BlobByName.CacheKey, `${name}|${blob.Version}`);
          
        }
        
      } catch(error) {
        Log.Error(`There was an error retrieving the blob of name ${name}. ${error}`);
        return null;
      }
      
    } else {
      
      // delete the blob row
      await this.Delete([
        { spec: 'name=?', param: name },
        { spec: 'version=?', param: version }
      ]);
      
      // remove from the cache
      Caches.Delete(BlobByName.CacheKey, `${name}|${version}`);
      
    }
    
    
    
  }
  
  //------------------------------------------//
  
  /** On a permissions structure being removed from the 'permissions' cache collection */
  private UpdateBlob = async (key: string, value: IBlob): Promise<void> => {
    try {
      
      // update the permissions spec
      await this.Update(
        [
          { column: 'blobid', param: value.BlobId },
          { column: 'segmentcount', param: value.SegmentCount },
          { column: 'segmentlength', param: value.SegmentBufferLength },
          { column: 'timecreated', param: value.TimeCreated },
          { column: 'metadata', param: JSON.stringify(value.Metadata) }
        ],
        [
          { spec: 'name=?', param: value.Name },
          { spec: 'version=?', param: value.Version }
        ]
      );
      
    } catch(error) {
      
      // log
      Log.Error(`Error updating blob in the DB. ${error}`);
      
      if(Application.IsRunning && value) {
        // re-add to the cache to ensure nothing's lost
        Caches.AddOrGet(BlobByName.CacheKey, `${value.Name}|${value.Version}`, value);
      }
      
    }
  }
  
}

