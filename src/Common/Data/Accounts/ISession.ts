/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Descriptor of a browser web session. Identifier is
 *  cookie-based.
 * Revision History: None
 ******************************************************/

import { Dictionary } from 'lodash';

/** Structure of the session */
export interface ISession {
  
  //--------------------------------------//
  
  /** Unique id of the session */
  Id: string;
  
  /** Timestamp of the start of the session */
  TimeStarted: number;
  
  /** Timestamp when the session expires */
  TimeExpired: number;
  
  /** Timestamp when the session was last seen */
  TimeLastSeen: number;
  
  /** Unique user id of the session */
  UserId: string;
  
  /** Metadata JSON contained in the session */
  Metadata: Dictionary<any>;
  
  //--------------------------------------//
  
}
