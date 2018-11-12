/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Thrown in the case of a web request error.
 * Revision History: None
 ******************************************************/

import { RequestErrorType } from "./ErrorType";

import * as express from 'express';

/** Error associated with a http request */
export class RequestError extends Error {
  
  //-----------------------------------------//
  
  /** Category of request error */
  public ErrorType: RequestErrorType;
  
  /** Error that can be used for internal error logging only */
  public InternalMessage: string;
  
  /** If set, the path where the response should redirect */
  public RedirectPath: string;
  
  //-----------------------------------------//
  
  //-----------------------------------------//
  
  /** Construct a new authentication error */
  public constructor(errorType: RequestErrorType, internalMessage: string, userMessage: string, redirectPath?: string) {
    super(userMessage);
    
    // persist the error type
    this.ErrorType = errorType;
    // persist the internal message
    this.InternalMessage = internalMessage;
    // persist the redirect path if set
    this.RedirectPath = redirectPath;
    
  }
  
  //-----------------------------------------//
  
}

