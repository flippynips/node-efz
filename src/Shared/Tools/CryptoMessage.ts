/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Structure containing required elements of a secured message.
 * Revision History: None
 ******************************************************/

/** Structure of a message sent securely */
export interface CryptoMessage {
  
  //----------------------------------//
  
  Content: Buffer;
  Nonce: Buffer;
  Tag: Buffer;
  
  //----------------------------------//
  
}
