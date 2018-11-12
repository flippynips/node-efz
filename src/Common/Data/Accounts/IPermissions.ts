/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Descriptor of a users possible access to a specific resource.
 * Revision History: None
 ******************************************************/

import { AccessType } from "../../Tools/Index";

/** Definition of permissions of a user to a specific resource */
export interface IPermissions {
  
  //--------------------------------------//
  
  /** If set, the user id the access pertains to */
  UserId: string;
  /** The resource the permissions pertain to */
  Resource: string;
  /** The access granted to the specified resource */
  Access: AccessType[];
  
  //--------------------------------------//
  
}
