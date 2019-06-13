/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Possible http methods..
 * Revision History: None
 ******************************************************/

/** Possible http methods */
export enum Method {
  All     = 1,
  Get     = 2,
  Post    = 3,
  Put     = 4,
  Delete  = 5,
  Patch   = 6,
  Options = 7,
  Head    = 8
}

/** Get the string interpretation of the specified http method. */
export const GetMethodString = function(method: Method): string {
  switch(method) {
    case Method.Get:
      return 'GET';
    case Method.Post:
      return 'POST';
    case Method.Delete:
      return 'DELETE';
    case Method.Head:
      return 'HEAD';
    case Method.Options:
      return 'OPTIONS';
    case Method.Patch:
      return 'PATCH';
    case Method.Put:
      return 'PUT';
    default:
      throw new Error(`Unhandled http method ${method}.`);
  }
}

/** Possible http methods */
export enum Status {
  Ok            = 200,
  Partial       = 201,
  PartialContent= 206,
  Bad           = 400,
  Unauthorized  = 401,
  Forbidden     = 403,
  NotFound      = 404,
  Invalid       = 405,
  Timeout       = 408,
  Conflict      = 409,
  Upgrade       = 426,
  ServerError   = 500,
  Temporary     = 503
}
