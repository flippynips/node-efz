/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Descriptor of required access to a specific resource.
 * Revision History: None
 ******************************************************/

import { AccessType } from "../../Tools/Index";

/** Definition of access to a specific resource */
export interface IAccess {
  
  //--------------------------------------//
  
  /** The resource the access pertains to */
  Resource: string;
  /** The access required or granted to the specified resource */
  Access: AccessType;
  
  //--------------------------------------//
  
}

/** Helper function to create an IAccess object */
export const Access = function(access: AccessType, resource: string): IAccess {
  return { Access: access, Resource: resource };
}
