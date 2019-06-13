import * as events from 'events';

declare module 'cassandra-driver' {
  
  export interface Client extends events.EventEmitter {
    
    connected: boolean;
    connecting: boolean;
    
  }
  
}
