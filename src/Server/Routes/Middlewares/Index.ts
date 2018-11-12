
import * as express from 'express';

/** parser of form content */
import * as bodyParser from 'body-parser';
/** parser of http cookies */
import * as cookieParser from 'cookie-parser';

export * from './Authorize';
export * from './ErrorHandling';

/** Concatinate all middleware */
export const All: (express.RequestHandler | express.ErrorRequestHandler)[] = [
  bodyParser.json(),
  bodyParser.urlencoded({ extended: true }),
  cookieParser()
];

