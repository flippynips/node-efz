/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table of blob segment by blob id.
 * Revision History: None
 ******************************************************/

import { Table } from '../Table';
import { Caches, Log } from '../../Managers/Index';
import { IBlobSegment } from './IBlobSegment';
import { ColumnType } from '../ColumnType';
import { Application } from '../../Application';

/** Table of byte store segments by id and indices */
export class BlobSegmentById extends Table {
  
  //------------------------------------------//
  
  /** Permissions cache collection key */
  public static readonly CacheKey: string = 'blob_segments';
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table */
  public constructor(keyspace: string) {
    super('BlobSegmentById', keyspace, [
      { Name: 'blobid', DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: 'segmentindex', DataType: 'int', ColumnType: ColumnType.PartitionKey },
      { Name: 'buffer', DataType: 'blob', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table */
  public async Initialize(): Promise<void> {
    super.Initialize();
    // create a cache collection for the permissions
    Caches.CreateCache<IBlobSegment>(BlobSegmentById.CacheKey, 100, 50, null, null, this.UpdateBlobSegment);
  }
  
  /** Save a byte store segment */
  public SetSegment(blobSegment: IBlobSegment): void {
    
    Caches.Set(BlobSegmentById.CacheKey, `${blobSegment.Id}|${blobSegment.Index}`, blobSegment);
    
  }
  
  /** Get a byte store segment by id and index. */
  public async GetSegment(id: string, index: number): Promise<IBlobSegment> {
    if(id == null) {
      Log.Error('Blob segment id was not specified.');
      return null;
    }
    
    // try get from the cache
    let blobSegment: IBlobSegment = Caches.TryGet(BlobSegmentById.CacheKey, `${id}|${index}`);
    
    if(blobSegment) return blobSegment;
    
    // get the byte store details
    let row: any;
    try {
      
      row = await this.SelectSingle('buffer',
      [
        { spec: 'blobid=?', param: id },
        { spec: 'segmentindex=?', param: index }
      ]);
      
    } catch(error) {
      Log.Error(`There was an error retrieving a byte segment ${id} : ${index}`);
      return null;
    }
    
    // was the row retrieved? no, return
    if(row == null) return null;
    
    // construct the byte segment
    blobSegment = {
      Id: id,
      Index: index,
      Buffer: row['buffer'],
      Written: false
    };
    
    // add to the cache
    blobSegment = Caches.AddOrGet(BlobSegmentById.CacheKey, `${id}|${index}`, blobSegment);
    
    // return the permissions
    return blobSegment;
    
  }
  
  /** Remove a blob segment by id and index */
  public async Remove(id: string, index: number): Promise<void> {
    
    await this.Delete([
      { spec: 'blobid=?', param: id },
      { spec: 'segmentindex=?', param: index }
    ]);
    
  }
  
  //------------------------------------------//
  
  /** On a blob segment being removed from the cache collection */
  private UpdateBlobSegment = async (key: string, value: IBlobSegment): Promise<void> => {
    
    // check if the segment has been written to
    if(!value.Written) return;
    
    try {
      
      // update the permissions spec
      await this.Update(
        [
          { column: 'buffer', param: value.Buffer }
        ],
        [
          { spec: 'blobid=?', param: value.Id },
          { spec: 'segmentindex=?', param: value.Index }
        ]
      );
      
      Log.Info(`End segment update.`);
      
    } catch(error) {
      
      // log
      Log.Error(`Error updating a blob store segment in the DB. ${error}`);
      
      if(Application.IsRunning && value) {
        // re-add to the cache to ensure nothing's lost
        Caches.AddOrGet(BlobSegmentById.CacheKey, `${value.Id}|${value.Index}`, value);
      }
      
    }
  }
  
}
