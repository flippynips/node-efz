
export { IRoute } from '../IRoute';
export { IMenuItem } from '../IMenuItem';

import { IRoute } from '../IRoute';
import { ApplicationControls } from './ApplicationControls';
import { Sources } from './Sources';
import { Login } from './Login';
import { Users } from './Users';
import { Dashboard } from './Dashboard';
import { Content } from './Content';
import { Errors } from './Errors';


/** Concatinate all web routes */
export const All: IRoute[] = []
  .concat(ApplicationControls)
  .concat(Sources)
  .concat(Dashboard)
  .concat(Login)
  .concat(Users)
  .concat(Content)
  .concat(Errors);
