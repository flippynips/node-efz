/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Types of CQL column.
 * Revision History: None
 ******************************************************/

/** Types of column */
export enum ColumnType {
  
  //-------------------------------//
  
  /** The column forms part of the primary key */
  PartitionKey = 0,
  /** The column is a cluster key */
  ClusterKey = 1,
  /** The column contains data */
  DataColumn = 2
  
  //-------------------------------//
  
}
