/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: A single blob segment containing part of a blob.
 * Revision History: None
 ******************************************************/

import { Dictionary } from 'lodash';

/** Structure of a single byte store segment */
export interface IBlobSegment {
  
  //--------------------------------------//
  
  /** PK: Unique identity of the byte store this segment belongs to */
  Id: string;
  
  /** PK: Segment index of this byte store item */
  Index: number;
  
  /** DC: Bytes of the segment */
  Buffer: Buffer;
  
  /** Flag indicating the segment has been written to and requires updating */
  Written: boolean;
  
  //--------------------------------------//
  
}
