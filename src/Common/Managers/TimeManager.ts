/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Time management. Helper methods and functionality related to time.
 * Revision History: None
 ******************************************************/

import { Manager } from "./Manager";

/** Manager of time related information. */
class TimeManager extends Manager<any> {
  
  //-------------------------------------//
  
  /** Get the current utc timestamp as number of seconds */
  public get Now(): number {
    return Math.floor(Date.now()/1000);
  }
  
  /** Get the current utc timestamp in milliseconds */
  public get NowMs(): number {
    return Date.now();
  }
  
  /** Get the current date time in a user-friendly readable format. */
  public get NowString(): string {
    return new Date(Date.now()).Format('');
  }
  
  //-------------------------------------//
  
  //-------------------------------------//
  
  /** Construct a new time manager */
  constructor() {
    super();
  }
  
  //-------------------------------------//
  
}

/** Global email manager instance */
export var Time: TimeManager = new TimeManager();
