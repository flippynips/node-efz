import * as Cassandra from 'cassandra-driver';
import * as util from 'util';
import { Log } from '../../Managers/Index';

/** Cassandra DB reconnection policy. */
class Reconnection implements Cassandra.policies.reconnection.ReconnectionPolicy {
  
  //--------------------------------------------------------//
  
  /** Starting reconnection delay. */
  public BaseDelay: number;
  /** Upper delay limit. */
  public MaxDelay: number;
  
  //--------------------------------------------------------//
  
  //--------------------------------------------------------//
  
  /** Basically an exponential reconnection policy. */
  constructor(baseDelay: number, maxDelay: number) {
    this.BaseDelay = baseDelay;
    this.MaxDelay = maxDelay;
  }
  
  /** Get a next schedule function. */
  public newSchedule(): { next: Function } {
    const self = this;
    let index = 0;
    return {
      next: function(): { value: number, done: boolean } {
        ++index;
        let delay = 0;
        if (index > 64) {
          delay = self.MaxDelay;
        } else if (index !== 0) {
          delay = Math.min(Math.pow(2, index) * self.BaseDelay, self.MaxDelay);
        }
        Log.Debug(`Attempting reconnection to DB in '${delay}ms'.`);
        return { value: delay, done: false };
      }
    };
  }
  
  //--------------------------------------------------------//
  
}

// need to add ReconnectionPolicy to the classes prototype chain
util.inherits(Reconnection, (<any>Cassandra.policies.reconnection).ReconnectionPolicy);

export const ReconnectionPolicy = Reconnection;
