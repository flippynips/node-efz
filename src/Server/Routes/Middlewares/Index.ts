import * as express from 'express';

export * from './ErrorHandling';
export * from './Authorize';

import { Passive } from './Passive';

/** Concatinate passive middleware for all requests. */
export const Middlewares: (express.RequestHandler | express.ErrorRequestHandler)[] = []
  .concat(Passive);
