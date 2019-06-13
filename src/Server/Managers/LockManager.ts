/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Database management. Maintains the client connection
 *  and dynamic query execution.
 * Revision History: None
 ******************************************************/

import { Manager, Log, IConfiguration, Application } from "./Index";
import { Lock, Sleep } from '../Tools/Index';

/** Lock configuration */
class Configuration {
}

/** Lock management. */
class LockManager extends Manager {
  
  //-----------------------------------//
  
  /** Locks configuration. */
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  //-----------------------------------//
  
  /** Current map of lock ids to lock instances. */
  private readonly _locks: { [Id: string]: Lock };
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-----------------------------------//
  
  /** Construct a new database manager. */
  constructor() {
    super();
    this._locks = {};
  }
  
  /** Start the database manager. Connects to the DB. */
  public async Start(): Promise<void> {
    await super.Start();
    
    this._configuration = Application.Configuration(
      './config/LockManager.config',
      new Configuration(),
      this.OnConfiguration
    );
    await this._configuration.Load();
    
  }
  
  /** Dispose of resources used by the manager. */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    // wait for all locks to be released
    let takenLocks: number;
    while(true) {
      takenLocks = 0;
      for(let id in this._locks) {
        if(this._locks[id].IsLocked) ++takenLocks;
      }
      if(takenLocks > 0) Log.Info(`Waiting for '${takenLocks}' taken locks...`);
      else break;
      await Sleep(10);
    }
    
  }
  
  /** Attempt to lock a resource of the specified id. Promise won't reject. */
  public TakeLock(id: string, timeoutMs: number = 1000 * 5): Promise<Lock> {
    let lock: Lock = this._locks[id];
    if(!lock) this._locks[id] = lock = new Lock(id);
    return lock.Take(timeoutMs);
  }
  
  /** Attempt to lock a resource of the specified id.
   * Will return null if the lock wasn't taken immediately. */
  public TryTakeLock(id: string, timeoutMs: number = 1000 * 5): Promise<Lock> {
    let lock: Lock = this._locks[id];
    if(!lock) this._locks[id] = lock = new Lock(id);
    return lock.TryTake(timeoutMs);
  }
  
  /** On a lock being removed from the cache. */
  public RemoveLock(lock: Lock): void {
    delete this._locks[lock.Id];
  }
  
  //-----------------------------------//
  
  /** On the lock manager configuration being updated. */
  protected OnConfiguration = (config: Configuration): void => {
    
  }
  
}

/** Global lock manager instance */
export const Locks: LockManager = new LockManager();

