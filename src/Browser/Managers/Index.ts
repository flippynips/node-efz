
export { Manager, IConfiguration, Application, Caches, Log, Time } from '../../Shared/Managers/Index';

import { Manager, Caches, Log, Time } from '../../Shared/Managers/Index';

/** Collection of managers to initialize in order */
export const All: Manager[] = [
  Caches,
  Time,
  Log
];
