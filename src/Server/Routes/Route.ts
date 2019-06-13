/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Properties of a web or api route.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http } from '../Tools/Index';

/** Route definition */
export interface Route {
  
  //------------------------------------//
  
  /** Path of the request */
  Path: string;
  
  /** Friendly name for the request */
  Name?: string;
  
  /** Method of the request */
  Method: Http.Method;
  
  /** Optional error message displayed to the user if an unhandled error occurs */
  UnhandledMessage?: string;
  
  /** Handlers of the request. */
  Effects: (express.ErrorRequestHandler | express.RequestHandler)[];
  
  //------------------------------------//
  
}

