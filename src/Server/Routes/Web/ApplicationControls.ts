/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Web-based application controls.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http, AccessType } from '../../Tools/Index';
import { Route } from '../Route';
import { AuthorizePrivate } from '../Middlewares/Index';
import { Application } from '../../Managers/Index';

/** Shutdown */
const Shutdown: Route = {
  Method: Http.Method.Get,
  Path: '/shutdown',
  Effects: [
    AuthorizePrivate(AccessType.Update, 'application'),
    (req: express.Request, res: express.Response) => {
      
      res.contentType('text/plain');
      res.send('Application shutting down.');
      
      // end the application
      Application.End();
      
    }
  ]
};

/** Collection of 'application control' routes */
export const ApplicationControls: Route[] = [
  Shutdown
];
