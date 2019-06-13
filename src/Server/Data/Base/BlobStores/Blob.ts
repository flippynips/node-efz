/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Descriptor of a blob. Contains metadata for a blob
 *  stored in segments.
 * Revision History: None
 ******************************************************/

import { Dictionary } from 'lodash';

/** Structure of blob storage metadata */
export interface Blob {
  
  //--------------------------------------//
  
  /** Unique name of the blob storage */
  Name: string;
  /** Version of the item */
  Version: number;
  /** Unique id of the blob entries */
  BlobId: string;
  /** Total byte length of the blob. */
  Length: number;
  /** Number of segments in this blob */
  SegmentCount: number;
  /** Number of bytes in each segment */
  SegmentBufferLength: number;
  /** Timestamp when the blob store was created */
  TimeCreated: number;
  /** Metadata JSON related to the blobs stored */
  Metadata: Dictionary<any>;
  
  //--------------------------------------//
  
}
