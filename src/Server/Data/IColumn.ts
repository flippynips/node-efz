/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: CQL column descriptor.
 * Revision History: None
 ******************************************************/

import { ColumnType } from "./ColumnType";

/** Structure of bytes storage metadata */
export interface IColumn {
  
  //----------------------------------------//
  
  /** The type of data contained in this column */
  DataType: string;
  /** The name/key of the column */
  Name: string;
  /** The type of column */
  ColumnType: ColumnType;
  
  //----------------------------------------//
  
}
