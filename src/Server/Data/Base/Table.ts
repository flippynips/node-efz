/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Base CQL table class. Provides helper query methods and
 *  adds itself to those managed by the DatabaseManager.
 * Revision History: None
 ******************************************************/

import * as Cassandra from 'cassandra-driver';

import { Database, Log } from '../../Managers/Index';
import { Column, UpdateSpec, QuerySpec, ColumnSpec } from './Column';

/** A database statement that can be executed in a batch. */
export interface Statement {
  query: string;
  params?: any[];
}

/** Base class for table access */
export abstract class Table {
  
  //----------------------------------------//
  
  /** Name of the table */
  public Name: string;
  /** Keyspace of the table. If null, will use the default database keyspace. */
  public Keyspace: string;
  /** The columns that form the table */
  public Columns: Column[];
  /** Additional table properties that used when creating the table */
  public Properties: string[];
  
  //----------------------------------------//
  
  //----------------------------------------//
  
  /** Create a new table instance */
  public constructor(name: string, keyspace: string, columns: Column[]) {
    
    // persist the name
    this.Name = name;
    // persist the keyspace
    this.Keyspace = keyspace;
    // set the columns
    this.Columns = columns;
    
    // register this table with the database
    Database.AddTable(this);
    
  }
  
  /** Initialize the table. At this point the application has started and managers constructed but
   * the database isn't connected yet. */
  public async Initialize(): Promise<void> {
    Log.Silly(`Table ${this.Name} initializing.`);
  }
  
  /** Start the table. At this point the table exists and database connection has been established. */
  public async Start(): Promise<void> {
    Log.Silly(`Table ${this.Name} starting.`);
  }
  
  /** Dispose of table resources and write any cached records as required. */
  public async Stop(): Promise<void> {
    Log.Silly(`Table ${this.Name} stopping.`);
  }
  
  /** Insert. Will true if 'ifNotExists' is true and result indicates success. */
  public async Insert(
    columns: ColumnSpec[],
    ifNotExists: boolean = false,
    ttl: number = null
  ): Promise<boolean> {
    
    if(!ifNotExists) return await Database.Execute(this.CreateInsert(columns, ifNotExists, ttl)) && true;
    let results = await Database.Execute(this.CreateInsert(columns, ifNotExists, ttl));
    return results.rows[0]['[applied]'];
    
  }
  
  /** Create an insert statement. */
  public CreateInsert(
    columns: ColumnSpec[],
    ifNotExists: boolean = false,
    ttl: number = null
  ): Statement {
    
    // string constituting columns
    let columnsStr: string = '';
    // collection of data items to substitute for '?'
    let params: any[] = [];
    // string constituting '?' denoting values
    let questionMarks: string = '';
    
    // initial iteration flag
    let first: boolean = true;
    
    // iterate the values and build the query string parameters
    for (let i = 0; i < columns.length; i++) {
      if(first) first = false;
      else {
        columnsStr += ',';
        questionMarks += ',';
      }
      columnsStr += columns[i].column;
      params.push(columns[i].param);
      questionMarks += "?";
    }
    
    // construct the query string
    let query: string = `INSERT INTO ${this.Keyspace}.${this.Name}(${columnsStr}) VALUES(${questionMarks})`;
    
    // append query options
    if(ifNotExists) query = query + " IF NOT EXISTS";
    if(ttl) query = query + " USING TTL " + ttl;
    
    return { query, params };
  }
  
  /** Update. Will true when 'iif' spec is provided and result indicates success. */
  public async Update(
    columns: UpdateSpec[],
    where?: QuerySpec[],
    iif?: boolean | QuerySpec[],
    ttl?: number
  ): Promise<boolean> {
    
    if(iif && typeof iif !== 'boolean') {
      let results = await Database.Execute(this.CreateUpdate(columns, where, iif, ttl));
      return results.rows[0]['[applied]'];
    }
    
    return await Database.Execute(this.CreateUpdate(columns, where, iif, ttl)) && true;
    
  }
  
  /** Create an update statement.
   * Note: Don't pass ifExists and iif parameters.
   */
  public CreateUpdate(
    columns: UpdateSpec[],
    where: QuerySpec[] = null,
    iif: boolean | QuerySpec[] = null,
    ttl: number = null
  ): Statement {
    
    // construct the query string
    let query: string = `UPDATE ${this.Keyspace}.${this.Name}`;
    
    // has time-to-live been specified? yes, append
    if(ttl) query = query + ' USING TTL ' + ttl;
    
    // string constituting columns
    let columnsStr: string = '';
    let params: any[] = [];
    
    // initial iteration flag
    let first: boolean = true;
    
    if(columns.length !== 0) {
      // iterate the values and build the query string parameters
      for (let i = 0; i < columns.length; i++) {
        if(first) first = false;
        else columnsStr += ',';
        if(columns[i].spec) {
          columnsStr += columns[i].spec;
        } else {
          columnsStr += `${columns[i].column}=?`;
        }
        params.push(columns[i].param);
      }
      
      // append the assignments
      query = query + ` SET ${columnsStr}`;
    }
    
    // append the where clause if specified
    if(where && where.length > 0) {
      
      let whereStr: string = ' WHERE ';
      first = true;
      
      // iterate and append the where clauses
      for(let i = 0; i < where.length; ++i) {
        if(first) first = false;
        else whereStr += ' AND ';
        whereStr += where[i].spec;
        if(where[i].param != null) params.push(where[i].param);
      }
      
      query += whereStr;
      
    }
    
    if(iif) {
      if(typeof iif === 'boolean') query += " IF EXISTS";
      else if(iif.length > 0) {
        
        let iifStr: string = ' IF ';
        first = true;
        
        // iterate and append the where clauses
        for(let i = 0; i < iif.length; ++i) {
          if(first) first = false;
          else iifStr += ' AND ';
          iifStr += iif[i].spec;
          if(iif[i].param != null) params.push(iif[i].param);
        }
        
        query += iifStr;
        
      }
    }
    
    // return the result set
    return { query, params };
    
  }
  
  /** Select a result set from the table */
  public async Select(
    select: string,
    where: QuerySpec[] = null,
    limit: number = null,
    orderBy: string = null,
    allowFiltering: boolean = false
  ): Promise<Cassandra.types.Row[]> {
    
    // run the query asynchronously
    let resultSet = await Database.Execute(this.CreateSelect(select, where, limit, orderBy, allowFiltering));
    
    // return the result set
    return resultSet && resultSet.rows;
    
  }
  
  /** Create a select statement. */
  public CreateSelect(
    select: string,
    where: QuerySpec[] = null,
    limit: number = null,
    orderBy: string = null,
    allowFiltering: boolean = false
  ): Statement {
    
    // construct the query string
    let query: string = `SELECT ${select} FROM ${this.Keyspace}.${this.Name}`;
    // collection of data items to substitute for '?'
    let params: any[] = [];
    
    // append options
    if(where && where.length > 0) {
      
      let whereStr: string = ' WHERE ';
      // initial iteration flag
      let first: boolean = true;
      
      // iterate and append the where clauses
      for(let i = 0; i < where.length; ++i) {
        if(first) first = false;
        else whereStr += ' AND ';
        whereStr += where[i].spec;
        if(where[i].param != null) params.push(where[i].param);
      }
      
      query += whereStr;
      
    }
    
    if(orderBy) query += ` ORDER BY ${orderBy}`;
    if(limit) query += ` LIMIT ${limit}`;
    if(allowFiltering) {
      Log.Debug(`Using ALLOW FILTERING on query; ${query}`);
      query += ' ALLOW FILTERING';
    }
    
    // return the result set
    return { query, params };
    
  }
  
  /** Select a result set from the table */
  public async SelectSingle(
    select: string,
    where: QuerySpec[] = null,
    allowFiltering: boolean = false
  ): Promise<Cassandra.types.Row> {
    
    let rows: Cassandra.types.Row[] = await this.Select(select, where, 1, null, allowFiltering);
    return rows && rows[0];
    
  }
  
  /** Delete the specified columns where the specified conditions are met */
  public async DeleteColumns(
    columns: string,
    where: QuerySpec[],
    conditions?: QuerySpec[]
  ): Promise<Cassandra.types.Row[]> {
    
    // run the query asynchronously
    let resultSet = await Database.Execute(
      this.CreateDeleteColumns(
        columns,
        where,
        conditions
      )
    );
    
    // return the result set
    return resultSet && resultSet.rows;
    
  }
  
  /** Delete the specified columns where the specified conditions are met */
  public CreateDeleteColumns(
    columns: string,
    where: QuerySpec[],
    conditions?: QuerySpec[]
  ): Statement {
    
    // collection of data items to substitute for '?'
    let params: any[] = [];
    
    // set up the statement
    let query: string = `DELETE ${columns} FROM ${this.Keyspace}.${this.Name}`;
    
    // append the where clause
    if(where && where.length > 0) {
      query += ' WHERE '
      let first: boolean = true;
      for(let expression of where) {
        if(first) first = false;
        else query += ' AND '
        query += expression.spec;
        if(expression.param != null) params.push(expression.param);
      }
    }
    
    // append the conditionals
    if(conditions && conditions.length > 0) {
      query += ' IF ';
      let first: boolean = true;
      for(let expression of conditions) {
        if(first) first = false;
        else query += ' AND '
        query += expression.spec;
        if(expression.param != null) params.push(expression.param);
      }
    }
    
    // return the result set
    return { query, params };
    
  }
  
  /** Delete rows from the table where the specified conditions are met */
  public async Delete(
    where: QuerySpec[],
    conditions?: QuerySpec[]
  ): Promise<boolean> {
    
    let results = await this.DeleteColumns('', where, conditions);
    if(!conditions) return true;
    if(results) return results[0]['[applied]'];
    throw new Error(`Delete operation didn't return any results.`);
    
  }
  
  /** Delete rows from the table where the specified conditions are met */
  public CreateDelete(
    where: QuerySpec[],
    conditions?: QuerySpec[]
  ): Statement {
    
    return this.CreateDeleteColumns('', where, conditions);
    
  }
  
  //----------------------------------------//
  
}
