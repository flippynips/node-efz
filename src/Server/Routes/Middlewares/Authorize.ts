/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Authorization request handler. Can authorize specified access to a resource
 *  specified by path.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { SessionsByCookie, PermissionsByUser, UsersById } from '../../Data/Accounts/Index';
import { ISession, IUser, UserState } from '../../Data/Accounts/Index';
import { Log, Crypto, Server, Time } from '../../Managers/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { AccessType, IsNullOrEmpty } from '../../Tools/Index';
import { NetHelper } from '../Index';

/** Authorize request access to the specified resource and access type.
 *  Sets res.locals.Session, res.locals.User and res.locals.Permissions.
 *  Requires the session to be associated with a logged in user.
 */
export const AuthorizePrivate = (access: AccessType, resource: string): express.RequestHandler =>
  async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    
    // get whether the resource path should be evaluated
    Log.Info(`Evaluating resource ${resource}`);
    const evaluateResource: boolean = resource.indexOf('$') > -1;
    
    // get the cookie from the request
    let sessionId = req.cookies && req.cookies[Server.Configuration.SessionCookieName];
    let session: ISession;
    
    let address: string = NetHelper.GetEndPointString(req);
    
    // does a session exist for the request?
    if(sessionId == null || sessionId == '') {
      // no, check the number of cookie attempts
      SetCookieAndRedirect(req, res, next);
      return;
    }
    
    // try decrypt the cookie
    try {
      sessionId = Crypto.DecryptWithPassword(sessionId, Server.Configuration.CookieEncryptionPassword);
    } catch(error) {
      next(new RequestError(RequestErrorType.Authentication,
        `Session identity for ${address} could not be decrypted. ${error}`,
        'Invalid permissions.'));
      return;
    }
    
    // get the session
    session = await SessionsByCookie.GetSession(sessionId);
    
    // get the current seconds
    let now: number = Time.Now;
    
    // validate the session
    if(!session || session.TimeExpired < now) {
      let endpointStruct = Server.GetEndPointStruct(req);
      endpointStruct.errorStr = 'Your session expired.';
      SetCookieAndRedirect(req, res, next);
      return;
    }
    
    // set the session in the locals reference
    res.locals.Session = session;
    
    // has the session been logged in?
    if(IsNullOrEmpty(session.UserId)) {
      // no, error
      next(new RequestError(RequestErrorType.Authentication,
        `Insufficient permissions for ${address} to ${AccessType[access]} '${resource}'`,
        'Please log in.'));
      return;
    }
    
    // get the user
    let user: IUser;
    try {
      user = await UsersById.GetUser(session.UserId);
    } catch(error) {
      next(new RequestError(RequestErrorType.Authentication,
        `Getting user ${session.UserId} caused an error.`,
        `There was a problem retrieving your account. Please try again.`));
      return;
    }
    
    if(!user) {
      next(new RequestError(RequestErrorType.Authentication,
        `Insufficient permissions for ${address} to ${AccessType[access]} '${resource}'`,
        'Invalid permissions.'));
      return;
    }
    
    // evaluate the resource path to be accessed
    if(evaluateResource) {
      resource = EvaluateResource(resource, req, res, session, user);
      if(resource == null) {
        next(new RequestError(RequestErrorType.Authentication,
          `Unsafe characters found in request parameters or query from ${NetHelper.GetEndPointString(req)}.`,
          'Invalid permissions.'));
        return;
      }
    }
    
    // should access be granted?
    if(!(access === AccessType.Read && resource === 'public/page') &&
      !await PermissionsByUser.HasAccess(session.UserId, access, resource)) {
      // no, disallow access
      next(new RequestError(RequestErrorType.Authentication,
        `Insufficient permissions for ${address} to ${AccessType[access]} '${resource}'`,
        'Invalid permissions.'));
      return;
    }
    
    // persist the user
    res.locals.User = user;
    user.TimeLastSeen = now;
    
    switch(user.State) {
      case UserState.Disabled:
        next(new RequestError(RequestErrorType.Authentication,
          `Attempted disabled account access by ${address} to ${AccessType[access]} '${resource}'`,
          'Your account is disabled.'));
        return;
      case UserState.Pending:
        next(new RequestError(RequestErrorType.Authentication,
          `Attempted pending account access by ${address} to ${AccessType[access]} '${resource}'`,
          'Your account access is pending. Please try again later.'));
        return;
      case UserState.Suspended:
        next(new RequestError(RequestErrorType.Authentication,
          `Attempted suspended account access by ${address} to ${AccessType[access]} '${resource}'`,
          'Your account is suspended.'));
        return;
    }
    
    next();
    
  };

/** Authorize request access to the specified resource and access type.
 *  Sets res.locals.Session and res.locals.Permissions. Requires the
 *  resource be public, or the session be associated with a logged in user.
 */
export const AuthorizePublic = (type: AccessType, resource: string): express.RequestHandler =>
  async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    
    // get whether the resource path should be evaluated
    const evaluateResource: boolean = resource.indexOf('$') > -1;
    
    // get the cookie from the request
    let sessionId = req.cookies && req.cookies[Server.Configuration.SessionCookieName];
    let session: ISession;
    
    // get the remote address
    var address: string = NetHelper.GetEndPointString(req);
    
    // does a session exist for the request?
    if(sessionId == null || sessionId == '') {
      // no, set the cookie
      await SetCookieAndRedirect(req, res, next);
      return;
    }
    
    // try decrypt the cookie
    try {
      sessionId = Crypto.DecryptWithPassword(sessionId, Server.Configuration.CookieEncryptionPassword);
    } catch(error) {
      // set the error string
      let endpointStruct = Server.GetEndPointStruct(req);
      endpointStruct.errorStr = 'Your session was invalidated.';
      // set cookie and redirect
      await SetCookieAndRedirect(req, res, next);
      return;
    }
    
    // get the session
    session = await SessionsByCookie.GetSession(sessionId);
    
    // get the current seconds
    let now: number = Time.Now;
    
    // validate the session
    if(!session || session.TimeExpired < now) {
      // set the error string
      let endpointStruct = Server.GetEndPointStruct(req);
      endpointStruct.errorStr = 'Your session expired.';
      // set cookie and redirect
      SetCookieAndRedirect(req, res, next);
      return;
    }
    
    // set the session in the locals reference
    res.locals.Session = session;
    session.TimeLastSeen = now;
    
    // is the request for a public resource? yes, grant access
    if(type === AccessType.Read) {
      switch(resource) {
        case 'public/resource':
          next();
          return;
        case 'public/page':
          // is the user logged in?
          if(session.UserId) {
            // yes, validate the user
            let user: IUser = await UsersById.GetUser(session.UserId);
            if(user && user.State === UserState.Active) {
              // yes, auto-redirect to the landing page
              res.redirect(Server.Configuration.DefaultLandingPage);
              return;
            }
          }
          next();
          return;
      }
    }
    
    // evaluate the resource path to be accessed
    if(evaluateResource) {
      resource = EvaluateResource(resource, req, res, session, null);
      if(resource == null) {
        next(new RequestError(RequestErrorType.Authentication,
          `Unsafe characters found in request parameters or query from ${NetHelper.GetEndPointString(req)}.`,
          'Invalid permissions.'));
        return;
      }
    }
    
    // get the permissions and validate the permissions
    let permissions = await PermissionsByUser.GetPermissions(session.UserId, resource);
    if(!permissions || !permissions.Access) {
      next(new RequestError(RequestErrorType.Authentication,
        `Permissions for session ${address} could not be retrieved.`,
        'Invalid permissions.'));
      return;
    }
    
    // persist the permissions
    res.locals.Permissions = permissions;
    
    // check the required access is in the granted collection
    let accessGranted: boolean = false;
    for(let i = 0; i < permissions.Access.length; ++i) {
      if(permissions.Access[i] == type) {
        accessGranted = true;
        break;
      }
    }
    
    if(!accessGranted) {
      
      // disallow access
      next(new RequestError(RequestErrorType.Authentication,
        `Insufficient permissions for ${address} to ${type} '${resource}'`,
        'Access denied.'));
      return;
      
    }
    
    // get the user
    
    next();
    
  };

/** Function that will create a session, set the associated cookie and redirect to the original request url */
const SetCookieAndRedirect = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  
  // check the number of cookie attempts
  let endPointStruct: any = Server.GetEndPointStruct(req);
  if(endPointStruct.CookieAttempts == null) endPointStruct.CookieAttempts = 0;
  ++endPointStruct.CookieAttempts;
  const maxCookieAttempts: number = 3;
  if(endPointStruct.CookieAttempts > maxCookieAttempts) {
    next(new RequestError(RequestErrorType.Authentication,
      'Browser does not allow setting cookies.',
      'Please enable cookies for authentication purposes.'));
    return;
  }
  
  let session: ISession;
  
  try {
    
    // try create a session
    session = await SessionsByCookie.CreateSession();
    
    Log.Verbose(`Created new session for '${NetHelper.GetEndPointString(req)}'.`);
    
  } catch(error) {
    
    next(new RequestError(RequestErrorType.Server,
      `Could not create a new session. ${error}`,
      'Server could not create a new session for you.'));
    
    return;
    
  }
  
  // encrypt the guid
  let encryptedId: string = Crypto.EncryptWithPassword(session.Id, Server.Configuration.CookieEncryptionPassword);
  res.cookie(Server.Configuration.SessionCookieName, encryptedId);
  
  // redirect to the same url to test the cookie is set correctly
  res.redirect(req.url);
  
};


/** Evaluate the resource string */
const EvaluateResource = function(resource: string, req: express.Request, res: express.Response, session: ISession, user: IUser): any {
  // test the request parameters for unsafe javascript characters
  const regex: RegExp = new RegExp('[=;`"\'{}]+');
  if(req.params) {
    for(let key in req.params) {
      if(regex.test(req.params[key])) return null;
    }
  }
  if(req.query) {
    for(let key in req.query) {
      if(regex.test(req.query[key])) return null;
    }
  }
  return Function('"use strict";return (function(req, res, session, user){return `' + resource + '`});')()(
    req, res, session, user
  );
}
