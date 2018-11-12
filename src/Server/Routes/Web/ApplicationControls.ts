/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Web-based application controls.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { HttpMethod, AccessType } from '../../Tools/Index';
import { IRoute } from '../IRoute';
import { AuthorizePrivate } from '../Middlewares/Index';
import { Application } from '../../Application';

/** Shutdown */
const Shutdown: IRoute = {
  Method: HttpMethod.Get,
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
export const ApplicationControls: IRoute[] = [
  Shutdown
];
