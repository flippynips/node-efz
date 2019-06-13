
import { Route } from '../Index';

import { Content as ContentRoutes } from './Content';

/** Concatinate all API routes */
export const Routes: Route[] = []
  .concat(ContentRoutes);
