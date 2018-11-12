/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Interface defining the loading and saving of a configuration object.
 * Revision History: None
 ******************************************************/

/** Interface of configuration retrieval and update methods */
export interface IConfiguration<T extends Object> {
  
  //---------------------------------//
  
  /** Configuration object. */
  Item: T;
  
  /** Callback on the configuration being loaded or updated */
  OnConfiguration: (config: T) => void;
  
  /** Load or reload the configuration synchronously */
  LoadSync(): void;
  /** Load or reload the configuration */
  Load(): Promise<void>;
  
  /** Save the current configuration synchronously */
  SaveSync(): void;
  /** Save the current configuration */
  Save(): Promise<void>;
  
  //---------------------------------//
  
}