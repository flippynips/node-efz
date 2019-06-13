/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table of blob segment by blob id.
 * Revision History: None
 ******************************************************/

import { Application } from '../../../Managers/Index';
import { Table } from '../Table';
import { Caches, Log } from '../../../Managers/Index';
import { BlobSegment } from './BlobSegment';
import { ColumnType } from '../ColumnType';

const KeyBlobId = 'i';
const KeySegmentIndex = 's';
const KeyBuffer = 'b';

/** Table of byte store segments by id and indices */
export class BlobSegmentById extends Table {
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  protected readonly _cacheKey: string;
  protected readonly _cacheTtl: number;
  
  //------------------------------------------//
  
  /** Construct a new table */
  public constructor(keyspace: string, prefix: string) {
    super(prefix+'BlobSegmentById', keyspace, [
      { Name: KeyBlobId, DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: KeySegmentIndex, DataType: 'int', ColumnType: ColumnType.PartitionKey },
      { Name: KeyBuffer, DataType: 'blob', ColumnType: ColumnType.DataColumn }
    ]);
    this._cacheKey = prefix+'_blob_segments';
    this._cacheTtl = 1000 * 20;
  }
  
  /** Initialize the table. */
  public async Initialize(): Promise<void> {
    await super.Initialize();
    // create a cache collection for the blob segments
    Caches.CreateCache<BlobSegment>(
      this._cacheKey,
      this._cacheTtl,
      undefined,
      undefined,
      this.UpdateBlobSegment
    );
  }
  
  public async Stop(): Promise<void> {
    await super.Stop();
    Caches.Clear(this._cacheKey);
  }
  
  /** Save a byte store segment */
  public SetSegment(blobSegment: BlobSegment): Promise<void> {
    
    Caches.Set(this._cacheKey, `${blobSegment.Id}|${blobSegment.Index}`, blobSegment, this._cacheTtl);
    
    return this.UpdateBlobSegment(null, blobSegment)
    
  }
  
  /** Get a byte store segment by id and index. */
  public async GetSegment(id: string, index: number): Promise<BlobSegment> {
    if(id == null) {
      Log.Error('Blob segment id was not specified.');
      return null;
    }
    
    // try get from the cache
    let blobSegment: BlobSegment = Caches.TryGet(this._cacheKey, `${id}|${index}`, this._cacheTtl);
    
    if(blobSegment) return blobSegment;
    
    // get the byte store details
    let row: any;
    try {
      
      row = await this.SelectSingle(
        KeyBuffer,
        [
          { spec: `${KeyBlobId}=?`, param: id },
          { spec: `${KeySegmentIndex}=?`, param: index }
        ]
      );
      
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
      Buffer: row[KeyBuffer],
      Written: false
    };
    
    // add to the cache
    blobSegment = Caches.SetOrGet(this._cacheKey, `${id}|${index}`, blobSegment, this._cacheTtl);
    
    // return the permissions
    return blobSegment;
    
  }
  
  /** Remove a blob segment by id and index */
  public async Remove(id: string, index: number): Promise<void> {
    
    await this.Delete([
      { spec: `${KeyBlobId}=?`, param: id },
      { spec: `${KeySegmentIndex}=?`, param: index }
    ]);
    
  }
  
  //------------------------------------------//
  
  /** On a blob segment being removed from the cache collection */
  private UpdateBlobSegment = async (_key: string, value: BlobSegment): Promise<void> => {
    
    // check if the segment has been written to
    if(!value.Written) return;
    
    try {
      
      // update the permissions spec
      await this.Update(
        [
          { column: KeyBuffer, param: value.Buffer }
        ],
        [
          { spec: `${KeyBlobId}=?`, param: value.Id },
          { spec: `${KeySegmentIndex}=?`, param: value.Index }
        ]
      );
      
    } catch(error) {
      
      // log
      Log.Error(`Error updating a blob store segment in the DB. ${error}`);
      
      if(Application.IsRunning && value) {
        // re-add to the cache to ensure nothing's lost
        Caches.SetOrGet(this._cacheKey, `${value.Id}|${value.Index}`, value, this._cacheTtl);
      }
      
    }
  }
  
}
