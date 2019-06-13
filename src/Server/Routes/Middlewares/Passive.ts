import * as express from 'express';

/** parser of form content */
import * as bodyParser from 'body-parser';
/** parser of http cookies */
import * as cookieParser from 'cookie-parser';
/** default compression */
import * as compression from 'compression';

import { Json } from './../../Tools/Index';
import { Log } from '../../Managers/Index';

export const Passive: (express.RequestHandler | express.ErrorRequestHandler)[] = [
  bodyParser.json({
    limit: 1024 * 97,
    reviver: Json.Parse,
    type: [ 'application/json', 'text/plain' ],
    strict: true
  }),
  bodyParser.urlencoded({ extended: true }),
  cookieParser(),
  compression({
    chunkSize: 16384,
    level: -1,
    memLevel: 7,
    threshold: 1024 * 5,
    windowBits: 14,
    filter: function(req: express.Request, res: express.Response): boolean {
      // check if compression has been disabled
      if((<any>res).compress === false) return false;
      // fallback to standard filter function
      let shouldCompress = compression.filter(req, res);
      if(shouldCompress) {
        Log.Debug(`Compressing response to '${req.path}' from '${req.connection.remoteAddress}'.`);
      } else {
        Log.Debug(`Not compressing response to '${req.path}' from '${req.connection.remoteAddress}'.`);
      }
      return shouldCompress;
    }
  })
];
