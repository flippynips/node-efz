/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to file-system resource access.
 * Revision History: None
 ******************************************************/

var mime = require('mime-types');
import * as express from 'express';
import * as pathHelpers from 'path';

import { Http, AccessType } from '../../Tools/Index';
import { Resources, Log } from '../../Managers/Index';
import { AuthorizePublic, HandleAsyncErrors } from '../Middlewares/Index';
import { Route } from '../Route';

/** Public sources available on the local file system */
const SourcesGet: Route = {
  Path: '/public/*',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/resource'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response): Promise<void> => {
      
      let fullPath: string = pathHelpers.normalize(req.url);
      let mimeType: string = mime.contentType(pathHelpers.extname(fullPath)) || 'application/octet-stream';
      
      let buffer = Resources.GetBuffer(fullPath);
      res.contentType(mimeType);
      res.setHeader("Content-Type", mimeType);
      
      Log.Debug(`Sending source ${fullPath} as mimetype ${mimeType}.`);
      
      res.send(buffer);
      
    })
  ]
};

/** Collection of public 'sources' routes */
export const Sources: Route[] = [
  SourcesGet
];
