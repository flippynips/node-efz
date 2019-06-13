/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Fallback when a RequestError occurs during http request
 *  fulfilment. Offers both web and api error handling.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Log, Server } from '../../Managers/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { NetHelper } from '../Index';
import { Http } from '../../Tools/Index';

/** Error handling for the web. Redirects the user to the specified path and sets the error string for the next page. */
export function WebErrorHandling(redirectPath: string = null): express.ErrorRequestHandler {
  return async (
    error: RequestError,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<any> => {
    
    Log.Warning(`Request ${RequestErrorType[error.ErrorType]} error : ${error.InternalMessage}`);
    
    // associate the error with the requests remote end point
    
    let endPointStruct: any = Server.GetEndPointStruct(req);
    
    endPointStruct.errorStr = error.message;
    
    switch(error.ErrorType) {
      case RequestErrorType.Authentication:
        endPointStruct.errorStatus = 403;
        res.statusMessage = 'Forbidden';
        break;
      case RequestErrorType.Server:
        endPointStruct.errorStatus = 500;
        res.statusMessage = 'Internal Server Error';
        break;
      case RequestErrorType.Validation:
        endPointStruct.errorStatus = 400;
        res.statusMessage = 'Bad Request';
        break;
      default:
        endPointStruct.errorStatus = 500;
        res.statusMessage = 'Internal Server Error';
        break;
    }
    
    // redirect to the specified path in order of specificity
    res.redirect(error.RedirectPath || redirectPath || '/error');
    
  }
};

/** Error handling for api requests. Sends the appropriate error status */
export function ApiErrorHandling(): express.ErrorRequestHandler {
  return async (
    error: RequestError | any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<any> => {
    
    if(error.ErrorType) {
      
      Log.Warning(`Api request ${error.ErrorType} error : ${error.InternalMessage}`);
      
      switch(error.ErrorType) {
        case RequestErrorType.Authentication:
          res.statusCode = Http.Status.Forbidden;
          res.statusMessage = 'Forbidden';
          break;
        case RequestErrorType.Server:
          res.statusCode = Http.Status.ServerError;
          res.statusMessage = 'Internal Server Error';
          break;
        case RequestErrorType.Validation:
          res.statusCode = Http.Status.Bad;
          res.statusMessage = 'Bad Request';
          break;
        default:
          res.statusCode = Http.Status.ServerError;
          res.statusMessage = 'Internal Server Error';
          break;
      }
      
    } else {
      
      Log.Warning(`Unhandled API request error : ${error && error.stack || error}`);
      
      res.statusCode = Http.Status.ServerError;
      res.statusMessage = 'Internal Server Error';
      
    }
    
    // check if finished
    if(res.connection.destroyed) {
      Log.Debug(`Not sending error due to finished response.`);
      return;
    }
    
    // send the error message in json format
    res.send();
    
  }
};

/** Handle errors resulting from a request handled by multer. */
export function HandleMulterErrors(
  err: { code: string, field: string, message: string },
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  
  // was there an error?
  if(!err) {
    // no, next
    next();
    return;
  }
  
  switch(err.code) {
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FILE_SIZE':
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FIELD_VALUE':
      Log.Warning(`Multer request ${err.code} error: ${err.field}`);
      res.sendStatus(Http.Status.Invalid);
      return;
    default:
      next(err);
      return;
  }
  
}
  
/** Helper method that will wrap an asynchronous request handler in order to handle otherwise unhandled errors */
export function HandleAsyncErrors(
  effect: express.ErrorRequestHandler | express.RequestHandler,
  unhandledMessage?: string
): express.ErrorRequestHandler | express.RequestHandler {
  
  if(effect as express.RequestHandler) {
    let requestHandler: express.RequestHandler = <express.RequestHandler>effect;
    return async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      try {
        await requestHandler(req, res, next);
      } catch(error) {
        if(error instanceof RequestError) {
          next(error);
          return;
        }
        next(new RequestError(RequestErrorType.Server,
          `Unhandled error during ${req.method} request '${req.path}' from ${NetHelper.GetEndPointString(req)}. ${error && error.stack || error}`,
          unhandledMessage || Server.Configuration.DefaultUnhandledMessage));
      }
    };
  } else if(effect as express.ErrorRequestHandler) {
    let errorRequestHandler: express.ErrorRequestHandler = <express.ErrorRequestHandler>effect;
    return async (error: any, req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      try {
        await errorRequestHandler(error, req, res, next);
      } catch(error) {
        if(error instanceof RequestError) {
          next(error);
          return;
        }
        next(new RequestError(RequestErrorType.Server,
          `Unhandled error during ${req.method} request '${req.path}' from ${NetHelper.GetEndPointString(req)}. ${error && error.stack || error}`,
          unhandledMessage || Server.Configuration.DefaultUnhandledMessage));
      }
    };
  } else {
    return effect;
  }
};


