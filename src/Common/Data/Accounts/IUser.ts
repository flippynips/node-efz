/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Descriptor of a user provided a login for the website.
 * Revision History: None
 ******************************************************/

import { Dictionary } from 'lodash';

/** States of a user login */
export enum UserState {
  
  //---------------------------------//
  
  None = 0,
  Active = 1,
  Pending = 2,
  Suspended = 3,
  Disabled = 4,
  
  //---------------------------------//
  
}

/** Structure of the user */
export interface IUser {
  
  //--------------------------------------//
  
  /** Unique id of the user */
  Id: string;
  
  /** Email address for the user */
  Email: string;
  
  /** Current state of the user */
  State: UserState;
  
  /** Timestamp of the start of the user */
  TimeCreated: number;
  
  /** Timestamp when the user was last seen */
  TimeLastSeen: number;
  
  /** Metadata JSON contained in the user */
  Metadata: Dictionary<any>;
  
  //--------------------------------------//
  
}
