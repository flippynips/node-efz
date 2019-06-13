
import { Route } from '../Route';
import { ApplicationControls } from './ApplicationControls';
import { Sources } from './Sources';
import { Login } from './Login';
import { Users } from './Users';
import { Dashboard } from './Dashboard';
import { Content } from './Content';
import { Errors } from './Errors';
import { Nexus } from './Nexus';


/** Concatinate all web routes */
export const Routes: Route[] = []
  .concat(ApplicationControls)
  .concat(Sources)
  .concat(Dashboard)
  .concat(Login)
  .concat(Users)
  .concat(Content)
  .concat(Errors)
  .concat(Nexus);
