/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table containing user details by user id.
 * Revision History: None
 ******************************************************/

import * as uuid from 'uuid';

import { IUser, UserState } from './Index';
import { Table, ColumnType } from '../Base/Index';
import { Caches, Log, Application } from '../../Managers/Index';

/** Table of session information by cookie guid */
class UsersByIdTable extends Table {
  
  //------------------------------------------//
  
  /** Permissions cache collection key */
  public static readonly CacheKey: string = 'users_by_id';
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table reference */
  public constructor() {
    super('UsersById', 'global', [
      { Name: 'userid', DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: 'email', DataType: 'text', ColumnType: ColumnType.DataColumn },
      { Name: 'state', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'timecreated', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'timelastseen', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'metadata', DataType: 'text', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table. */
  public async Initialize(): Promise<void> {
    await super.Initialize();
    // create a cache collection for the users
    Caches.CreateCache<IUser>(UsersByIdTable.CacheKey, 60, 20, null, this.UpdateUserInner);
  }
  
  /** Get a session by cookie id. May throw if database access fails. */
  public async GetUser(id: string): Promise<IUser> {
    
    // validate the id
    if(!id) return null;
    
    // try get the user from the cache
    let user: IUser = Caches.TryGet(UsersByIdTable.CacheKey, id);
    
    // was the session retrieved from the cache? yes, return
    if(user) return user;
    
    let row: any;
    try {
      
      // get the row
      row = await this.SelectSingle('email, state, timecreated, timelastseen, metadata', [
        { spec: 'userid=?', param: id }
      ]);
      
    } catch(error) {
      Log.Error(`There was an error retrieving a user of id '${id}'. ${error}`);
      return null;
    }
    
    // was the row retrieved? no, return
    if(!row) return null;
    
    // construct the complete session
    user = {
      Id: id,
      Email: row['email'],
      State: row['state'],
      TimeCreated: row['timecreated'],
      TimeLastSeen: row['timelastseen'],
      Metadata: JSON.parse(row['metadata'])
    };
    
    // try add the session to the cache
    user = Caches.SetOrGet(UsersByIdTable.CacheKey, id, user);
    
    // return the session
    return user;
    
  }
  
  /** Save a new session to the database. May throw if inserting the session fails. */
  public async CreateUser(email: string, metadata: any = null): Promise<IUser> {
    
    // get the current date in utc seconds
    let now: number = Math.floor(Date.now()/1000);
    // create a session id
    let guid: string = uuid.v1();
    
    // construct the session
    let user: IUser = {
      Id: guid,
      Email: email,
      State: UserState.Pending,
      TimeCreated: now,
      TimeLastSeen: now,
      Metadata: metadata || {}
    };
    
    // append the session to the cache
    user = await Caches.SetOrGet(UsersByIdTable.CacheKey, guid, user);
    
    // return the new user
    return user;
    
  }
  
  /** Update the user details by adding the specified user to the cache */
  public async UpdateUser(user: IUser): Promise<void> {
    
    // set in the cache
    await Caches.Set(UsersByIdTable.CacheKey, user.Id, user);
    
    // save in the DB
    await this.UpdateUserInner(user.Id, user);
    
  }
  
  /** Remove the user from the user cache and database */
  public async RemoveUser(user: IUser): Promise<void> {
    
    // remove from the db
    await this.Delete([
      { spec: 'userid=?', param: user.Id }
    ]);
    
    // delete from the cache
    await Caches.Delete(UsersByIdTable.CacheKey, user.Id);
    
    
  }
  
  /** Get a collection of all users */
  public async GetAllUsers(): Promise<IUser[]> {
    
    // get all from the cache
    let users = Caches.GetAll<IUser>(UsersByIdTable.CacheKey).map(v => v.value);
    
    // iterate rows
    for(let row of await this.Select('userid, email, state, timecreated, timelastseen, metadata')) {
      
      let found: boolean = false;
      for(let user of users) {
        if(user.Id === row['userid']) {
          found = true;
          break;
        }
      }
      if(found) continue;
      
      // construct a user from the row
      let user: IUser = {
        Id: row['userid'],
        Email: row['email'],
        State: row['state'],
        TimeCreated: row['timecreated'],
        TimeLastSeen: row['timelastseen'],
        Metadata: JSON.parse(row['metadata'])
      };
      
      // add to or get from the cache
      user = Caches.SetOrGet(UsersByIdTable.CacheKey, user.Id, user);
      
      // append the user to the result collection
      users.push(user);
      
    }
    
    // return the collection of users
    return users;
    
  }
  
  //------------------------------------------//
  
  /** Save an existing session to the database. May throw if updating the session fails. */
  private UpdateUserInner = async (key: string, value: IUser): Promise<void> => {
    
    try {
      
      // update the session
      await this.Update(
        [
          { column: 'timecreated', param: value.TimeCreated },
          { column: 'timelastseen', param: value.TimeLastSeen },
          { column: 'email', param: value.Email },
          { column: 'state', param: value.State },
          { column: 'metadata', param: JSON.stringify(value.Metadata) }
        ],
        [
          { spec: 'userid=?', param: value.Id }
        ]);
        
    } catch(error) {
      
      // log
      Log.Error(`Error updating a user in the DB. ${error}`);
      
      if(Application.IsRunning && value) {
        // add the session back into the cache as a buffer
        Caches.SetOrGet(UsersByIdTable.CacheKey, value.Id, value);
      }
      
    }
    
  }
  
}

/** Instance of the sessions by cookie table */
export const UsersById: UsersByIdTable = new UsersByIdTable();
