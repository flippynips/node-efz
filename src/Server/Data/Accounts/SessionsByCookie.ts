/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table sessions by cookie identity.
 * ToDo: Add TTL to created sessions.
 * Revision History: None
 ******************************************************/

import * as uuid from 'uuid';

import { ISession } from './Index';
import { Table } from '../Table';
import { Caches, Log, Time } from '../../Managers/Index';
import { ColumnType } from '../ColumnType';
import { Application } from '../../Application';

/** Table of session information by cookie guid */
class SessionsByCookieTable extends Table {
  
  //------------------------------------------//
  
  /** Permissions cache collection key */
  public static readonly CacheKey: string = 'sessions';
  
  /** Time in seconds each session is persisted for */
  public ExpiryTime: number = 
    // seconds
    60 *
    // minutes
    60 *
    // hours
    24 *
    // days
    20;
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table */
  public constructor() {
    super('SessionsByCookie', 'global', [
      { Name: 'sessionid', DataType: 'text', ColumnType: ColumnType.PartitionKey },
      { Name: 'timestarted', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'timeexpired', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'timelastseen', DataType: 'int', ColumnType: ColumnType.DataColumn },
      { Name: 'userid', DataType: 'ascii', ColumnType: ColumnType.DataColumn },
      { Name: 'metadata', DataType: 'text', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table */
  public async Initialize(): Promise<void> {
    super.Initialize();
    // create a cache collection for the permissions
    Caches.CreateCache<ISession>(SessionsByCookieTable.CacheKey, 600, 120, null, null, this.UpdateSession);
  }
  
  /** Get a session by cookie id. May throw if database access fails. */
  public async GetSession(id: string): Promise<ISession> {
    
    // validate the id
    if(!id) return null;
    
    // try get the session from the cache
    let session: ISession = Caches.TryGet(SessionsByCookieTable.CacheKey, id);
    
    // was the session retrieved from the cache? yes, return
    if(session != null) return session;
    
    let row: any;
    try {
      
      // get the row
      row = await this.SelectSingle('timestarted, timeexpired, timelastseen, userid, metadata', [
        { spec: 'sessionid=?', param: id }
      ]);
      
    } catch(error) {
      Log.Error(`There was an error retrieving a session of id '${id}'. ${error}`);
      return null;
    }
    
    // was the row retrieved? no, return
    if(row == null) return null;
    
    // construct the complete session
    session = {
      Id: id,
      TimeStarted: row['timestarted'],
      TimeExpired: row['timeexpired'],
      TimeLastSeen: row['timelastseen'],
      UserId: row['userid'],
      Metadata: JSON.parse(row['metadata'])
    };
    
    // try add the session to the cache
    session = Caches.AddOrGet(SessionsByCookieTable.CacheKey, id, session);
    
    // return the session
    return session;
    
  }
  
  /** Save the specified version of the session */
  public async SetSession(session: ISession): Promise<void> {
    
    Caches.Set(SessionsByCookieTable.CacheKey, session.Id, session);
    
  }
  
  /** Save a new session to the database. May throw if inserting the session fails. */
  public async CreateSession(metadata: Map<string, any> = null): Promise<ISession> {
    
    // get the current date in utc seconds
    let now: number = Time.Now;
    // create a session id
    let guid: string = uuid.v1();
    
    // construct the session
    let session: ISession = {
      Id: guid,
      TimeStarted: now,
      TimeExpired: now + this.ExpiryTime,
      TimeLastSeen: now,
      UserId: '',
      Metadata: metadata || {}
    };
    
    // append the session to the cache
    session = await Caches.AddOrGet(SessionsByCookieTable.CacheKey, guid, session);
    
    try {
      
      // insert the session
      await this.Update([
        { column: 'timestarted', param: session.TimeStarted },
        { column: 'timeexpired', param: session.TimeExpired },
        { column: 'timelastseen', param: session.TimeLastSeen },
        { column: 'userid', param: session.UserId },
        { column: 'metadata', param: JSON.stringify(session.Metadata) },
      ],
      [
        { spec: 'sessionid=?', param: session.Id }
      ]);
      
    } catch(error) {
      
      Log.Error(`Error updating a session in the DB. ${error}`);
      
    }
    
    return session;
    
  }
  
  //------------------------------------------//
  
  /** Save an existing session to the database. May throw if updating the session fails. */
  private UpdateSession = async (key: string, value: ISession): Promise<void> => {
    
    try {
      
      // update the session
      await this.Update(
        [
          { column: 'timestarted', param: value.TimeStarted },
          { column: 'timeexpired', param: value.TimeExpired },
          { column: 'timelastseen', param: value.TimeLastSeen },
          { column: 'userid', param: value.UserId },
          { column: 'metadata', param: JSON.stringify(value.Metadata) }
        ],
        [
          { spec: 'sessionid=?', param: value.Id }
        ]);
        
    } catch(error) {
      
      // log
      Log.Error(`Error updating a session in the DB. ${error}`);
      
      if(Application.IsRunning) {
        // add the session back into the cache as a buffer
        Caches.AddOrGet(SessionsByCookieTable.CacheKey, value.Id, value);
      }
      
    }
    
  }
  
}

/** Instance of the sessions by cookie table */
export const SessionsByCookie: SessionsByCookieTable = new SessionsByCookieTable();
