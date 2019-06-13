/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to API content requests.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Log, Server } from '../../Managers/Index';
import { Http, IsNullOrEmpty, Errors } from '../../Tools/Index';
import { ApiErrorHandling } from '../Middlewares/Index';
import { Blob, BlobStream, Blobs } from '../../Data/Base/BlobStores/Index';
import { Route } from '../Route';
import { NetHelper } from '../Index';

/** Get the specified version of the specified content */
const ApiContentGet: Route = {
  Path: '/api/v1/content/:name',
  Method: Http.Method.Get,
  Effects: [
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      let name: string = req.params && req.params.name || null;
      let versionStr: string = req.query && req.query.version || null;
      
      // validate the name was specified
      if(IsNullOrEmpty(name)) {
        next(new Errors.RequestError(Errors.RequestErrorType.Validation,
          `Missing parameter 'name' in get content api request from ${NetHelper.GetEndPointString(req)}.`,
          `Missing parameter 'name' in request /api/v1/content/{name}.`));
        return;
      }
      // validate the version if specified
      let version: number = null;
      if(versionStr != null) {
        version = parseInt(versionStr);
        if(isNaN(version) || version < 0) {
          next(new Errors.RequestError(Errors.RequestErrorType.Validation,
            `Invalid parameter 'version' in get content api request from ${NetHelper.GetEndPointString(req)}.`,
            `Invalid parameter 'version' in request /api/v1/content/{name}?version={version}.`));
          return;
        }
      }
      
      let blob: Blob;
      
      try {
        
        //was the version specified?
        if(version == null) {
          
          // no, get the latest version
          version = -1;
          for(let blobEntry of await Blobs.GetBlobs(`content:${name}`)) {
            if(blobEntry.Version > version) {
              version = blobEntry.Version;
              blob = blobEntry;
            }
          }
          
        } else {
          
          // get the blob
          blob = await Blobs.GetBlob(`content:${name}`, version);
          
        }
        
      } catch(error) {
        next(new Errors.RequestError(Errors.RequestErrorType.Server,
          `An error occurred retrieving content blob ${name}. ${error}`,
          `Content ${name} couldn't be retrieved.`));
        return;
      }
      
      if(blob == null) {
        next(new Errors.RequestError(Errors.RequestErrorType.Validation,
          `Content '${name}' wasn't found.`,
          `Specified content ${name}${version > 0 ? ` v${version}` : ''} was not found.`));
        return;
      }
      
      // validate the authorization token
      if(!AuthorizeBasic(req, blob)) {
        next(new Errors.RequestError(Errors.RequestErrorType.Authentication,
          `Invalid authorization token from ${NetHelper.GetEndPointString(req)}`,
          `Invalid authorization.`));
        return;
      }
      
      try {
        
        // get the blob stream
        let blobStream: BlobStream = await Blobs.GetStream(blob.Name, blob.Version);
        
        // log
        Log.Verbose("Returning content '" + name + (version == null ? '' : ` v${version}`) + ".");
        
        // pipe the blob stream to the specified request
        res.setHeader('Content-Type', 'application/octet-stream');
        blobStream.pipe(res, { end: true });
        
        // close the blob stream
        blobStream.end();
        
      } catch(error) {
        next(new Errors.RequestError(Errors.RequestErrorType.Server,
          `An error occurred retrieving content blob ${name}. ${error}`,
          `Content ${name} couldn't be retrieved.`));
        return;
      }
      
      
    },
    ApiErrorHandling()
  ]
};

/** Get the latest version of the specified content */
const ApiContentVersionGet: Route = {
  Path: '/api/v1/content/:name/version',
  Method: Http.Method.Get,
  Effects: [
    async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the content name
      let name: string = req.params && req.params.name || null;
      
      // was the name specified?
      if(IsNullOrEmpty(name)) {
        // no, error
        next(new Errors.RequestError(Errors.RequestErrorType.Validation,
          `Missing parameter 'name' in get content version api request from ${NetHelper.GetEndPointString(req)}.`,
          `Missing parameter 'name' in request /api/v1/content/{name}/version.`));
        return;
      }
      
      // flag indicating the state of authorization
      let authorized: boolean = false;
      
      // get the latest version number
      let version: number = -1;
      let blob: Blob = null;
      try {
        for(let blobEntry of await Blobs.GetBlobs(`content:${name}`)) {
          if(blobEntry.Version > version) {
            version = blobEntry.Version;
            blob = blobEntry;
          }
          if(AuthorizeBasic(req, blob)) authorized = true;
        }
      } catch(error) {
        next(new Errors.RequestError(Errors.RequestErrorType.Server,
          `Error retrieving blob versions of ${name} for ${NetHelper.GetEndPointString(req)}. ${error}`,
          `There was a problem retrieving content versions.`));
        return;
      }
      
      // was the blob found?
      if(!blob) {
        // no, error
        next(new Errors.RequestError(Errors.RequestErrorType.Validation,
          `No versions found for content ${name}.`,
          `No content found of that name.`));
        return;
      }
      
      // authorize access to the specified content
      if(!authorized) {
        next(new Errors.RequestError(Errors.RequestErrorType.Authentication,
          `Invalid authorization token from ${NetHelper.GetEndPointString(req)}`,
          `Invalid authorization.`));
        return;
      }
      
      // send the version raw
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        Version: version,
        Name: name
      }));
      
    },
    ApiErrorHandling()
  ]
};

/** Authorize the specified request with the specified blob */
const AuthorizeBasic = (req: express.Request, blob: Blob): boolean => {
  
  // authorize access to the specified blob
  let token: string = blob.Metadata && blob.Metadata.Token || null;
  
  // validate the authorization token
  if(req.headers && req.headers.authorization != `BASIC ${token}`) return false;
  
  // validated
  return true;
  
};

/** Collection of 'content' api routes */
export const Content: Route[] = [
  ApiContentGet,
  ApiContentVersionGet,
];
