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

/** Error handling for the web. Redirects the user to the specified path and sets the error string for the next page. */
export const WebErrorHandling = (redirectPath: string = null): express.ErrorRequestHandler =>
  async (error: RequestError, req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    
    Log.Warning(`Request ${error.ErrorType} error : ${error.InternalMessage}`);
    
    // associate the error with the requests remote end point
    
    let endPointStruct: any = Server.GetEndpointStruct(req);
    
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
    
  };

/** Error handling for api requests. Sends the appropriate error status */
export const ApiErrorHandling = (): express.ErrorRequestHandler =>
  async (error: RequestError, req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    
    Log.Warning(`Api request ${error.ErrorType} error : ${error.InternalMessage}`);
    
    switch(error.ErrorType) {
      case RequestErrorType.Authentication:
        res.statusCode = 403;
        res.statusMessage = 'Forbidden';
        break;
      case RequestErrorType.Server:
        res.statusCode = 500;
        res.statusMessage = 'Internal Server Error';
        break;
      case RequestErrorType.Validation:
        res.statusCode = 400;
        res.statusMessage = 'Bad Request';
        break;
      default:
        res.statusCode = 500;
        res.statusMessage = 'Internal Server Error';
        break;
    }
    
    // send the error message in json format
    res.contentType('application/json');
    res.send(JSON.stringify({ error: error.message }));
    
  };
  
  /** Helper method that will wrap an asynchronous request handler in order to handle otherwise unhandled errors */
  export const HandleAsyncErrors =
    (effect: express.ErrorRequestHandler | express.RequestHandler, unhandledMessage?: string):
      express.ErrorRequestHandler | express.RequestHandler => {
    
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
            `Unhandled error during ${req.method} request '${req.path}' from ${Server.GetIpEndPoint(req)}. ${error}`,
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
            `Unhandled error during ${req.method} request '${req.path}' from ${Server.GetIpEndPoint(req)}. ${error}`,
            unhandledMessage || Server.Configuration.DefaultUnhandledMessage));
        }
      };
    } else {
      return effect;
    }
  };
