/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table containing login password and user id by email
 *  address.
 * Revision History: None
 ******************************************************/

import * as cassandra from 'cassandra-driver';

import { Table, ColumnType } from '../Base/Index';
import { Log, Crypto, Server } from '../../Managers/Index';

/** Table of session information by cookie guid */
class UsersByEmailTable extends Table {
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table reference */
  public constructor() {
    super('UsersByEmail', 'global', [
      { Name: 'email', DataType: 'text', ColumnType: ColumnType.PartitionKey },
      { Name: 'password', DataType: 'text', ColumnType: ColumnType.ClusterKey },
      { Name: 'userid', DataType: 'ascii', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Get the user id of the specified email. Returns null if the email isn't registered. */
  public async GetUserId(email: string) : Promise<string> {
    let row: cassandra.types.Row = await this.SelectSingle('userid', [
      { spec: 'email=?', param: email }
    ]);
    if(!row) return null;
    return row['userid'];
  }
  
  /** Get the user id matching the specified email and password. */
  public async Validate(email: string, password: string): Promise<string> {
    
    // validate the id and password
    if(!email || !password) return null;
    
    // hash the password
    password = Crypto.EncryptWithPassword(password, Server.Configuration.PasswordEncryptionPassword);
    
    let row: cassandra.types.Row;
    try {
      // get the row
      row = await this.SelectSingle('userid', [
        { spec: 'email=?', param: email },
        { spec: 'password=?', param: password }
      ]);
    } catch(error) {
      Log.Error(`There was an error retrieving a userid of email '${email}'. ${error}`);
      return null;
    }
    
    // was the row retrieved? no, return
    if(row == null) return null;
    
    // return the session
    return row['userid'];
    
  }
  
  /** Save a new users email-password combination. */
  public async AddUser(email: string, password: string, userid: string): Promise<void> {
    // encrypt the password
    password = Crypto.EncryptWithPassword(password, Server.Configuration.PasswordEncryptionPassword);
    try {
      // insert the session
      await this.Update([
        { column: 'userid', param: userid }
      ],
      [
        { spec: 'email=?', param: email },
        { spec: 'password=?', param: password }
      ]);
    } catch(error) {
      Log.Error(`Error in the DB. ${error}`);
    }
  }
  
  /** Update a users password. */
  public async UpdateUserPassword(email: string, password: string): Promise<void> {
    // encrypt the password
    password = Crypto.EncryptWithPassword(password, Server.Configuration.PasswordEncryptionPassword);
    // get the existing row (should only ever be 1)
    let row = await this.SelectSingle('userid, password', [
      { spec: `email=?`, param: email }
    ]);
    if(row == null) throw new Error(`User '${email}' doesn't exist. Failed to update password.`);
    // remove the existing entry
    await this.Delete([
      { spec: 'email=?', param: email },
      { spec: 'password=?', param: row['password'] }
    ]);
    // insert a new entry
    await this.Insert([
      { column: 'email', param: email },
      { column: 'password', param: password },
      { column: 'userid', param: row['userid'] }
    ]);
  }
  
  /** Remove a user */
  public async RemoveUser(email: string) : Promise<void> {
    
    // delete all matching users of the email address
    await this.Delete([
      { spec: 'email=?', param: email }
    ]);
    
  }
  
  
  //------------------------------------------//
  
}

/** Instance of the sessions by cookie table */
export const UsersByEmail: UsersByEmailTable = new UsersByEmailTable();
