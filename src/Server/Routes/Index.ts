export { IRoute } from './IRoute';

import { IRoute } from "./IRoute";

import * as WebRoutes from './Web/Index';
import * as ApiRoutes from './Api/Index';

/** Combine Web and API routes - this is directly used by the server manager */
export const All: IRoute[] = []
  .concat(WebRoutes.All)
  .concat(ApiRoutes.All);
