/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Base CQL table class. Provides helper query methods and
 *  adds itself to those managed by the DatabaseManager.
 * Revision History: None
 ******************************************************/

import * as Cassandra from 'cassandra-driver';

import { Database, Log } from '../Managers/Index';
import { IColumn } from './IColumn';

/** Base class for table access */
export abstract class Table {
  
  //----------------------------------------//
  
  /** Name of the table */
  public Name: string;
  
  /** Keyspace of the table */
  public Keyspace: string;
  
  /** The columns that form the table */
  public Columns: IColumn[];
  
  /** Additional table properties that used when creating the table */
  public Properties: string[];
  
  //----------------------------------------//
  
  //----------------------------------------//
  
  /** Create a new table instance */
  public constructor(name: string, keyspace: string, columns: IColumn[]) {
    
    // persist the name
    this.Name = name;
    // persist the keyspace
    this.Keyspace = keyspace;
    // set the columns
    this.Columns = columns;
    
    // register this table with the database
    Database.AddTable(this);
    
  }
  
  /** Initialize the table */
  public Initialize(): void {
    Log.Debug(`Table ${this.Name} initializing.`);
  }
  
  /** Insert */
  public async Insert(
    columns: {column: string, param: any}[],
    ifNotExists: boolean = false,
    ttl: number = null): Promise<Cassandra.types.ResultSet> {
    
    // string constituting columns
    let columnsStr: string = '';
    // collection of data items to substitute for '?'
    let data: any[] = [];
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
      data.push(columns[i].param);
      questionMarks += "?";
    }
    
    // construct the query string
    let statement: string = `INSERT INTO ${this.Keyspace}.${this.Name}(${columnsStr}) VALUES(${questionMarks})`;
    
    // append query options
    if(ifNotExists) statement = statement + " IF NOT EXISTS";
    if(ttl) statement = statement + " USING TTL " + ttl;
    
    // run the query asynchronously
    let resultSet: Cassandra.types.ResultSet = await Database.Execute(statement, data, { prepare: true });
    
    // return the result set
    return resultSet;
    
  }
  
  /** Update */
  public async Update(
    columns: {column: string, param: any}[],
    where: {spec: string, param: any}[] = null,
    iif: {spec: string, param: any}[] = null,
    ifExists: boolean = false,
    ttl: number = null): Promise<Cassandra.types.ResultSet> {
    
    // construct the query string
    let statement: string = `UPDATE ${this.Keyspace}.${this.Name}`;
    
    // has time-to-live been specified? yes, append
    if(ttl) statement = statement + ' USING TTL ' + ttl;
    
    // string constituting columns
    let columnsStr: string = '';
    let data: any[] = [];
    
    // initial iteration flag
    let first: boolean = true;
    
    // iterate the values and build the query string parameters
    for (let i = 0; i < columns.length; i++) {
      if(first) first = false;
      else columnsStr += ',';
      columnsStr += `${columns[i].column}=?`;
      data.push(columns[i].param);
    }
    
    // append the assignments
    statement = statement + ` SET ${columnsStr}`;
    
    // append the where clause if specified
    if(where && where.length > 0) {
      
      let whereStr: string = ' WHERE ';
      first = true;
      
      // iterate and append the where clauses
      for(let i = 0; i < where.length; ++i) {
        if(first) first = false;
        else whereStr += ' AND ';
        whereStr += where[i].spec;
        if(where[i].param != null) data.push(where[i].param);
      }
      
      statement += whereStr;
      
    }
    
    if(ifExists) statement += " IF EXISTS";
    
    if(iif && iif.length > 0) {
      if(ifExists) statement += ' AND';
      
      let iifStr: string = ' IF ';
      first = true;
      
      // iterate and append the where clauses
      for(let i = 0; i < where.length; ++i) {
        if(first) first = false;
        else iifStr += ' AND ';
        
        iifStr += where[i].spec;
        if(where[i].param != null) data.push(where[i].param);
      }
      
      statement += iifStr;
    }
    
    // run the query asynchronously
    let resultSet: Cassandra.types.ResultSet = await Database.Execute(statement, data, { prepare: true });
    
    // return the result set
    return resultSet;
    
  }
  
  /** Select a result set from the table */
  public async Select(
    select: string,
    where: { spec: string, param: any }[] = null,
    limit: number = null,
    orderBy: string = null,
    allowFiltering: boolean = false): Promise<Cassandra.types.Row[]> {
    
    // construct the query string
    let statement: string = `SELECT ${select} FROM ${this.Keyspace}.${this.Name}`;
    // collection of data items to substitute for '?'
    let data: any[] = [];
    
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
        if(where[i].param != null) data.push(where[i].param);
      }
      
      statement += whereStr;
      
    }
    
    if(orderBy) statement += ` ORDER BY ${orderBy}`;
    if(limit) statement += ` LIMIT ${limit}`;
    if(allowFiltering) statement += ' ALLOW FILTERING';
    
    // run the query asynchronously
    let resultSet: Cassandra.types.ResultSet = await Database.Execute(statement, data, { prepare: true });
    
    // return the result set
    return resultSet && resultSet.rows;
    
  }
  
  /** Select a result set from the table */
  public async SelectSingle(
    select: string,
    where: { spec: string, param: any }[] = null,
    allowFiltering: boolean = false): Promise<Cassandra.types.Row> {
    
    let rows: Cassandra.types.Row[] = await this.Select(select, where, 1, null, allowFiltering);
    return rows && rows[0];
    
  }
  
  /** Delete the specified columns where the specified conditions are met */
  public async DeleteColumns(
    columns: string,
    where: {spec: string, param: any}[],
    conditions?: {spec: string, param: any}[]): Promise<Cassandra.types.Row[]> {
    
    // collection of data items to substitute for '?'
    let data: any[] = [];
    
    // set up the statement
    let statement: string = `DELETE ${columns} FROM ${this.Keyspace}.${this.Name}`;
    
    // append the where clause
    if(where && where.length > 0) {
      statement += ' WHERE '
      let first: boolean = true;
      for(let expression of where) {
        if(first) first = false;
        else statement += ' AND '
        statement += expression.spec;
        if(expression.param != null) data.push(expression.param);
      }
    }
    
    // append the conditionals
    if(conditions && conditions.length > 0) {
      statement += ' IF ';
      let first: boolean = true;
      for(let expression of conditions) {
        if(first) first = false;
        else statement += ' AND '
        statement += expression.spec;
        if(expression.param != null) data.push(expression.param);
      }
    }
    
    // run the query asynchronously
    let resultSet: Cassandra.types.ResultSet = await Database.Execute(statement, data, { prepare: true });
    
    // return the result set
    return resultSet && resultSet.rows;
    
  }
  
  /** Delete rows from the table where the specified conditions are met */
  public async Delete(where: { spec: string, param: any }[], conditions?: {spec: string, param: any}[]): Promise<Cassandra.types.Row[]> {
    return await this.DeleteColumns('', where, conditions);
  }
  
  //----------------------------------------//
  
}
