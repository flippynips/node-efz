/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to user login management.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http, AccessType } from '../../Tools/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { Resources, Server } from '../../Managers/Index';
import { Route } from '../Route';
import { WebErrorHandling, HandleAsyncErrors, AuthorizePublic } from '../Middlewares/Index';
import { DataHelper } from '../Index';

DataHelper.Menu.Add({
  Name: 'Nexus',
  Path: '/nexus',
  Priority: 1
});

/** User list get */
const NexusGet: Route = {
  Path: '/nexus',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the dashboard page
      let page: string;
      
      try {
        page = await Resources.GetPage('Nexus/Nexus.pug', {
          "title": 'Nexus',
          "datetime": new Date().toDateString(),
          "description": 'Nexus vision.',
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await DataHelper.Menu.Get(req, res),
          "email": null
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the users page. ${error}`,
          `There was a problem retrieving the users page.`));
        return;
      }
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Collection of 'users' routes */
export const Nexus: Route[] = [
  NexusGet
];
