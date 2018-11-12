/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Cryptography helper. Provides simple methods related
 *  to cryptography.
 * Revision History: 
 * 6/10/18 - Joshua Graham
 *  Refactor, added comments, renamed Configuration.Secret -> Aad
 ******************************************************/

import * as crypto from 'crypto';

import { Manager } from './Index';
import { CryptoMessage } from '../Tools/Index'; 

/** Cryptography configuration */
class Configuration {
  /** Used as Additional Authenticated Data. Encrypts the tag of crypto messages. */
  Aad: string = crypto.randomBytes(64).toString('base64');
  /** Used as the secret key. */
  Key: string = crypto.randomBytes(64).toString('base64');
  /** Initial vector used to encrypt and decrypt with passwords. */
  Iv: string = crypto.randomBytes(16).toString('base64');
}

/** Manager of cryprography requirements. */
class CryptoManager extends Manager<Configuration> {
  
  //-----------------------------------//
  
  //-----------------------------------//
  
  /** The md5 hashing structure */
  private md5: crypto.Hash; 
  
  /** Secret AAD buffer */
  private aad: Buffer;
  
  /** Secret key buffer */
  private key: Buffer;
  
  /** Iv buffer */
  private iv: Buffer;
  
  //-----------------------------------//
  
  /** Construct a new cryprography manager. */
  constructor() {
    super(Configuration);
  }
  
  /** Hash the specified string with md5 and base64 encoded */
  public Hash(str: string): string {
    return this.md5.update(str).digest('base64');
  }
  
  /** Encrypt a string using an AES 256bit cipher */
  public EncryptWithPassword(text: string, password: string, encoding: crypto.HexBase64BinaryEncoding = 'base64') {
    const algorithm: string = 'aes-256-cbc';
    
    let passwordHash: string = crypto.createHash('md5').update(password, 'utf8').digest('hex').toUpperCase();
    
    let cipher: crypto.Cipher = crypto.createCipheriv(algorithm, passwordHash, this.iv);
    let crypted: string = cipher.update(text, 'utf8', encoding)
    crypted += cipher.final(encoding);
    return crypted;
  }
  
  /** Decrypt a string using an AES 256bit cipher */
  public DecryptWithPassword(text: string, password: string, encoding: crypto.HexBase64BinaryEncoding = 'base64') {
    const algorithm: string = 'aes-256-cbc';
    
    let passwordHash: string = crypto.createHash('md5').update(password, 'utf8').digest('hex').toUpperCase();
    
    let decipher: crypto.Decipher = crypto.createDecipheriv(algorithm, passwordHash, this.iv);
    let dec: string = decipher.update(text, encoding, 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
  
  /** Encrypt a string using an AES 256 cipher */
  public EncryptAES256(plainText: string): CryptoMessage {
    const algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
    
    const nonce = crypto.randomBytes(16);
    
    let cipher: crypto.CipherGCM = crypto.createCipheriv(algorithm, this.key, nonce, {
      authTagLength: 32
    });
    
    cipher.setAAD(this.aad, {
      plainTextLength: Buffer.byteLength(plainText)
    });
    
    let content: Buffer = cipher.update(plainText, 'utf8');
    cipher.final();
    
    // get the tag associated wtih the messsage
    let tag: Buffer = cipher.getAuthTag();
    
    return {
      Content: content,
      Nonce: nonce,
      Tag: tag
    };
    
  }
  
  /** Decrypt a message using an AES 256 cipher */
  public DecryptAES256(message: CryptoMessage): string {
    const algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
    
    let decipher: crypto.DecipherGCM = crypto.createDecipheriv(algorithm, this.key, message.Nonce, {
      authTagLength: 16
    });
    
    decipher.setAuthTag(message.Tag, { plainTextLength: message.Content.length });
    
    decipher.setAAD(this.aad);
    
    let decryptedString: string = decipher.update(message.Content, null, 'utf8');
    decryptedString += decipher.final('utf8');
    
    return decryptedString;
    
  }
  
  //-----------------------------------//
  
  /** On the crypto configuration updating */
  protected OnConfiguration = (config: Configuration): void => {
    
    let aadStr: string = config.Aad = config.Aad || 'example_default_secret';
    this.aad = Buffer.from(aadStr, 'base64');
    
    let keyStr: string = config.Key = config.Key || 'example_default_key';
    this.key = Buffer.from(keyStr, 'base64');
    
    let ivStr: string = config.Iv = config.Iv || crypto.randomBytes(16).toString('base64');
    this.iv = Buffer.from(ivStr, 'base64');
    
    this.md5 = crypto.createHash('md5');
    
  }
  
}

/** Global cryprography manager instance */
export var Crypto: CryptoManager = new CryptoManager();
