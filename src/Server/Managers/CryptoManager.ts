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

import { Manager, IConfiguration, Application } from './Index';
import { Json } from '../Tools/Index';

/** Cryptography configuration */
class Configuration {
  /** Used as Additional Authenticated Data. Encrypts the tag of crypto messages. */
  Aad: string = Json.Z85Encode(crypto.randomBytes(64));
  /** Used as the secret key. */
  Key: string = Json.Z85Encode(crypto.randomBytes(64));
  /** Initial vector used to encrypt and decrypt with passwords. */
  Iv: string = Json.Z85Encode(crypto.randomBytes(16));
}

/** Manager of cryprography requirements. */
class CryptoManager extends Manager {
  
  //-----------------------------------//
  
  //-----------------------------------//
  
  /** The md5 hashing structure */
  protected _md5: crypto.Hash; 
  /** Secret AAD buffer */
  protected _aad: Buffer;
  /** Secret key buffer */
  protected _key: Buffer;
  /** Iv buffer */
  protected _iv: Buffer;
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  
  //-----------------------------------//
  
  /** Construct a new cryprography manager. */
  constructor() {
    super();
  }
  
  /** Start the cryptography manager. */
  public async Start(): Promise<void> {
    await super.Start();
    
    this._configuration = Application.Configuration(
      './config/CryptoManager.config',
      new Configuration(),
      this.OnConfiguration
    );
    await this._configuration.Load();
    
  }
  
  /** Stop the cryptography manager. */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    await this._configuration.Save();
    
  }
  
  /** Hash the specified string with md5 and base64 encoded */
  public Hash(str: string): string {
    return this._md5.update(str).digest('base64');
  }
  
  /** Encrypt a string using an AES 256bit cipher */
  public EncryptWithPassword(text: string, password: string, encoding: crypto.HexBase64BinaryEncoding = 'base64'): string {
    const algorithm: string = 'aes-256-cbc';
    
    let passwordHash: string = crypto.createHash('md5').update(password, 'utf8').digest('hex').toUpperCase();
    
    let cipher: crypto.Cipher = crypto.createCipheriv(algorithm, passwordHash, this._iv);
    let crypted: string = cipher.update(text, 'utf8', encoding)
    crypted += cipher.final(encoding);
    return crypted;
  }
  
  /** Decrypt a string using an AES 256bit cipher */
  public DecryptWithPassword(text: string, password: string, encoding: crypto.HexBase64BinaryEncoding = 'base64'): string {
    const algorithm: string = 'aes-256-cbc';
    
    let passwordHash: string = crypto.createHash('md5').update(password, 'utf8').digest('hex').toUpperCase();
    
    let decipher: crypto.Decipher = crypto.createDecipheriv(algorithm, passwordHash, this._iv);
    let dec: string = decipher.update(text, encoding, 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
  
  /** Encrypt a string using an AES 256 cipher */
  /*
  public EncryptAES256(message: string, key: Buffer, aad: Buffer): Buffer {
    const algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
    
    const nonce = crypto.randomBytes(16);
    
    let cipher: crypto.CipherGCM = crypto.createCipheriv(
      algorithm,
      key,
      nonce,
      {
        authTagLength: 32
      }
    );
    
    cipher.setAAD(
      aad,
      {
        plaintextLength: Buffer.byteLength(message)
      }
    );
    
    let content: Buffer = cipher.update(message, 'utf8');
    cipher.final();
    
    // get the tag associated wtih the messsage
    let tag: Buffer = cipher.getAuthTag();
    
    return Buffer.concat([nonce, content, tag]);
    
  }
  */
  
  /** Decrypt a buffer using an AES 256 cipher */
  /*
  public DecryptAES256(message: Buffer): string {
    const algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
    
    let nonce = message.slice(0, 16);
    let tag = message.slice(message.length - 32, message.length);
    let decipher: crypto.DecipherGCM = crypto.createDecipheriv(
      algorithm,
      this._key,
      nonce,
      { authTagLength: 32 }
    );
    
    decipher.setAuthTag(tag, { plainTextLength: message.length - 48 });
    decipher.setAAD(this._aad);
    
    let decryptedString: string = decipher.update(message.slice(16, message.length - 32), null, 'utf8');
    decryptedString += decipher.final('utf8');
    
    return decryptedString;
    
  }
  */
  
  //-----------------------------------//
  
  /** On the crypto configuration updating */
  protected OnConfiguration = (config: Configuration): void => {
    
    let aadStr: string = config.Aad = config.Aad || Json.Z85Encode(crypto.randomBytes(64));
    this._aad = Json.Z85Decode(aadStr);
    
    let keyStr: string = config.Key = config.Key || Json.Z85Encode(crypto.randomBytes(64));
    this._key = Json.Z85Decode(keyStr);
    
    let ivStr: string = config.Iv = config.Iv || Json.Z85Encode(crypto.randomBytes(16));
    this._iv = Json.Z85Decode(ivStr);
    
    this._md5 = crypto.createHash('md5');
    
  }
  
}

/** Global cryprography manager instance */
export const Crypto: CryptoManager = new CryptoManager();
