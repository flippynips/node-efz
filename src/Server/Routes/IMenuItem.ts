/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Options of a route menu item.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { IAccess } from '../Data/Accounts/Index';

/** Route menu item options definition */
export interface IMenuItem {
  
  //------------------------------------//
  
  /** Friendly name displayed for the menu item */
  Name: string;
  
  /** Optional user access required for the menu item to be shown */
  Access?: IAccess[];
  
  /** Predicate evaluated at runtime to determine whether menu item is shown */
  Predicate?: (req: express.Request, res: express.Response) => boolean;
  
  /** Optional number hinting at the priority of the menu item */
  Priority?: number;
  
  //------------------------------------//
  
}


