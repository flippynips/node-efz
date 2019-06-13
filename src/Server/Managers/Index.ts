
import {
  IConfiguration,
  Application,
  Manager,
  Log,
  Time,
  Caches
} from '../../Shared/Managers/Index';

import { Crypto } from './CryptoManager';
import { Database } from './DatabaseManager';
import { Resources } from './ResoucesManager';
import { Locks } from './LockManager';
import { Input } from './InputManager';
import { Server } from './ServerManager';
import { Email } from './EmailManager';

export {
  IConfiguration,
  Application,
  Manager,
  Log,
  Time,
  Caches,
  Crypto,
  Database,
  Resources,
  Locks,
  Input,
  Server,
  Email
};

/** Collection of all server managers to initialize in order */
export const All: Manager[] = [
  Log,
  Time,
  Caches,
  Crypto,
  Database,
  Resources,
  Locks,
  Input,
  Server,
  Email
];
