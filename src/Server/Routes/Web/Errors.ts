/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to error handling during web navigation.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http, IsNullOrEmpty } from '../../Tools/Index';
import { Resources, Server } from '../../Managers/Index';
import { Route } from '../Route';
import { HandleAsyncErrors } from '../Middlewares/Index';
import { DataHelper } from '../Index';

/** Error Page */
const ErrorGet: Route = {
  Path: '/error',
  Method: Http.Method.Get,
  Effects: [
    HandleAsyncErrors(async (req: express.Request, res: express.Response): Promise<void> => {
      
      // get the error to display
      var endPointStruct: any = Server.GetEndPointStruct(req);
      
      // this is undesirable but can happen
      if(!endPointStruct || IsNullOrEmpty(endPointStruct.ErrorStr)) {
        endPointStruct = {};
        endPointStruct.errorStr = 'This is the page for errors. But you do not seem to belong here.';
        endPointStruct.ErrorStatus = 200;
      }
      
      // get the error page
      let page = await Resources.GetPage('Error/Error.pug',
        {
          "title": 'Uh Oh',
          "datetime": new Date().toDateString(),
          "description": '“The trouble with programmers is that you can never tell what a programmer is doing until it’s too late.” Seymour Cray',
          "menu": DataHelper.Menu.Get(req, res),
          "error": endPointStruct.ErrorStr
        });
      
      res.statusCode = endPointStruct.ErrorStatus;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    })
  ]
};

/** Collection of 'error' routes */
export const Errors: Route[] = [ ErrorGet ];
