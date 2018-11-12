/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to the dashboard web-interface.
 *   Landing page after logging in.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { IUser } from '../../Data/Accounts/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { HttpMethod, AccessType } from '../../Tools/Index';
import { IRoute } from './Index';
import { Resources, Server } from '../../Managers/Index';
import { WebErrorHandling, AuthorizePrivate, HandleAsyncErrors } from '../Middlewares/Index';
import { PermissionsByUser } from '../../Data/Accounts/Index';

/** Dashboard Page */
const DashboardGet: IRoute = {
  Path: '/dashboard',
  Method: HttpMethod.Get,
  MenuItem: {
    Access: [{Access: AccessType.Read, Resource: 'dashboard'}],
    Name: 'Dashboard',
    Priority: 10
  },
  Effects: [
    AuthorizePrivate(AccessType.Read, 'dashboard'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the user
      let user: IUser = res.locals.User;
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndpointStruct(req);
      
      // get the dashboard page
      let page: string;
      
      try {
        page = await Resources.GetPage('Dashboard/Dashboard.pug', {
          "title": 'Dashboard',
          "datetime": new Date().toDateString(),
          "description": 'Home base of operations.',
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await Server.GetMenu(req, res),
          "email": user.Email,
          "canUpdateContent": await PermissionsByUser.HasAccess(user.Id, AccessType.Update, 'content'),
          "canUpdateApplication": await PermissionsByUser.HasAccess(user.Id, AccessType.Update, 'application')
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the dashboard. ${error}`,
          `There was a problem building your dashboard.`));
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

/** Collection of 'dashboard' routes */
export const Dashboard: IRoute[] = [ DashboardGet ];
