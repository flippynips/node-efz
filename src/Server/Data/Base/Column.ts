/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: CQL column descriptor.
 * Revision History: None
 ******************************************************/

import { ColumnType } from "./ColumnType";

/** Structure of bytes storage metadata */
export interface Column {
  
  //----------------------------------------//
  
  /** The type of data contained in this column */
  DataType: string
    | 'ascii' | 'bigint' | 'blob' | 'boolean' | 'counter' | 'date' | 'decimal'
    | 'double' | 'float' | 'inet' | 'frozen' | 'int' | 'list' | 'map' | 'set'
    | 'smallint' | 'text' | 'time' | 'timestamp' | 'timeuuid' | 'tinyint' | 'tuple'
    | 'uuid' | 'varchar' | 'varint';
  /** The name/key of the column */
  Name: string;
  /** The type of column */
  ColumnType: ColumnType;
  
  //----------------------------------------//
  
}

export interface ColumnSpec {
  column: string,
  param: any
}

export interface UpdateSpec {
  column?: string,
  spec?: string,
  param: any
}

export interface QuerySpec {
  spec: string,
  param: any
}

