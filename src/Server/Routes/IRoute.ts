/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Properties of a web or api route.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { HttpMethod } from '../Tools/Index';
import { IMenuItem } from './IMenuItem';

/** Route definition */
export interface IRoute {
  
  //------------------------------------//
  
  /** Path of the request */
  Path: string;
  
  /** Friendly name for the request */
  Name?: string;
  
  /** Method of the request */
  Method: HttpMethod;
  
  /** Optional error message displayed to the user if an unhandled error occurs */
  UnhandledMessage?: string;
  
  /** Handler of the request */
  Effects: (express.ErrorRequestHandler | express.RequestHandler)[];
  
  /** Options for a menu item addition for the route */
  MenuItem?: IMenuItem;
  
  //------------------------------------//
  
}

