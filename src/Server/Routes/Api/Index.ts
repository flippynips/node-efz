
export { IRoute } from '../IRoute';
export { IMenuItem } from '../IMenuItem';

import { IRoute } from '../IRoute';

import { Content } from './Content';

/** Concatinate all API routes */
export const All: IRoute[] = []
  .concat(Content);
