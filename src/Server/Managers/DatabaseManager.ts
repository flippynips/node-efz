/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Database management. Maintains the client connection
 *  and dynamic query execution.
 * Revision History: None
 ******************************************************/

import * as locks from 'locks';
import * as Cassandra from 'cassandra-driver';
import { Dictionary } from "lodash";

import { Sleep, IsNullOrEmpty, IConfiguration } from '../Tools/Index';
import { Manager, Log, Input } from "./Index";
import { IColumn, Table, ColumnType } from "../Data/Index";


/** Database configuration */
class Configuration {
  /** SSL host for secure connections */
  SslHost: string = "localhost";
  /** SSL port for secure connections */
  SslPort: number = 9142;
  /** If set, username and password authentication is used */
  Username: string = '';
  /** If set, username and password authentication is used */
  Password: string = '';
  /** Endpoints used establish a connection to the cluster */
  ContactPoints: string[] = [ 'localhost:9042' ];
  /** Default replication used by any keyspaces created */
  DefaultReplication: string = "{ 'class' : 'SimpleStrategy', 'replication_factor' : 1 }";
}

/** Database management. */
class DatabaseManager extends Manager<Configuration> {
  
  //-----------------------------------//
  
  //-----------------------------------//
  
  /** Database client connection */
  private _client: Cassandra.Client;
  
  /** Collection of tables managed by the database manager */
  private _tables: Table[];
  
  /** Lock for the tables collection */
  private _tablesLock: locks.Mutex;
  
  /** Pending statement executions */
  private _pendingStatements: number;
  
  //-----------------------------------//
  
  /** Construct a new database manager. */
  constructor() {
    super(Configuration);
    this._tables = [];
    this._tablesLock = new locks.Mutex();
  }
  
  /** Start the database manager. Connects to the DB. */
  public async Start(configuration?: IConfiguration<Configuration>): Promise<void> {
    await super.Start(configuration);
    
    // attempt connection immediately
    Database._client.connect()
      .then(Database.OnConnection)
      .catch(Database.OnConnectionError);
    
  }
  
  /** Stop the database manager. Disconnects from the DB. */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    // wait for pending statements
    await Sleep(10);
    while(this._pendingStatements > 0) {
      Log.Debug(`Waiting for ${this._pendingStatements} pending statements.`);
      await Sleep(10);
    }
    
    await Database._client.shutdown();
  }
  
  /** Execute the specified query using the current active database client. May return NULL. */
  public async Execute(query: string, params: any = null, options: Cassandra.QueryOptions = null): Promise<Cassandra.types.ResultSet> {
    
    if(Database._client == null) throw new Error('No Database Connection.');
    
    // increment the pending statements
    ++this._pendingStatements;
    try {
      // execute the statement and return the result set
      return await Database._client.execute(query, params, options || { prepare: true });
    } finally {
      // decrement the pending statements
      --this._pendingStatements;
    }
    
  }
  
  /** Select a row set from a table, one row at a time */
  public ExecutePaged(query: string, rowCallback: (index: number, row: Cassandra.types.Row) => void, errorCallback: (error: any) => void = null): void {
    
    if(Database._client == null) {
      Log.Error("Database client isn't connected. Query failed.");
      errorCallback("Database client isn't connected. Query failed.");
      return;
    }
    
    Database._client.eachRow(query, null, { prepare: true, autoPage: true, fetchSize: 100 }, rowCallback, errorCallback);
    
  }
  
  /** Log a cassandra result set including column names and formatting */
  public async LogResultSet(resultSet: Cassandra.types.ResultSet, paginate: boolean = false): Promise<void> {
    
    if(!resultSet.columns) {
      console.log('Query returned 0 results.');
      return;
    }
    
    let columns: any = resultSet.columns;
    let columnWidth: number = Math.floor((Input.ConsoleWidth-1)/columns.length);
    let separator: string = new Array(columnWidth*columns.length + 2).join('-') + '\n';
    let rowCount: number = 3;
    
    let tableStr: string = '';
    
    // append the header
    tableStr = separator;
    
    // iterate the columns of the results
    for (let i = 0; i < columns.length; ++i) {
      
      let columnName: string = columns[i].name;
      
      tableStr += '|';
      
      if(columnName.length >= columnWidth) {
        tableStr += columnName.substr(0, columnWidth-4) + '...';
      } else if(columnWidth === columnName.length) {
        tableStr += columnName;
      } else {
        tableStr += columnName + new Array(columnWidth - columnName.length).join(' ');
      }
      
    }
    
    tableStr += '|\n';
    tableStr += separator;
    
    // append the rows
    for(let y = 0; y < resultSet.rows.length; ++y) {
      
      for(const [key, value] of Object.entries(resultSet.rows[y])) {
        
        let cellStr: string;
        
        if(value == null) {
          cellStr = 'NULL';
        } else if(typeof value === 'string') {
          cellStr = value;
        } else if(typeof value === 'number') {
          cellStr = value.toString();
        } else if(typeof value === 'boolean') {
          if(value) cellStr = 'true';
          else cellStr = 'false';
        } else if(value instanceof Buffer) {
          cellStr = `Buffer[${value.length}]`;
        } else {
          cellStr = JSON.stringify(value);
        }
        
        if(cellStr.length >= columnWidth) {
          tableStr += `|${cellStr.substr(0, columnWidth-4)}...`;
        } else if(columnWidth === cellStr.length) {
          tableStr += `|${cellStr}`;
        } else {
          tableStr += `|${cellStr}${new Array(columnWidth - cellStr.length).join(' ')}`;
        }
        
      }
      
      if(paginate && ++rowCount > Input.ConsoleHeight - 2) {
        
        tableStr += '|';
        process.stdout.write(tableStr);
        tableStr = '';
        rowCount = 0;
        await Input.PressEnterToContinue();
        
      } else {
        
        tableStr += '|\n';
        
      }
      
    }
    
    tableStr += separator;
    
    console.log(tableStr);
    
  }
  
  /** Add a table to be managed by the database manager */
  public AddTable(table: Table): void {
    
    this._tablesLock.lock(async (): Promise<void> => {
      if(this._tables) {
        this._tables.push(table);
      } else {
        await this.SetUpTable(table, {});
        // initialize the table
        await table.Initialize();
      }
      this._tablesLock.unlock();
    });
    
  }
  
  //-----------------------------------//
  
  /** On the server configuration being updated */
  protected OnConfiguration = (config: Configuration): void => {
    
    // construct the client options
    let clientOptions: Cassandra.ClientOptions = {
      contactPoints: config.ContactPoints
    };
    
    // create the authentication provider
    if(!IsNullOrEmpty(config.Username) && !IsNullOrEmpty(config.Password)) {
      clientOptions.authProvider = new Cassandra.auth.PlainTextAuthProvider(config.Username, config.Password);
    }
    
    // create or recreate the cassandra client
    if(this._client) this._client.shutdown();
    this._client = new Cassandra.Client(clientOptions);
    
    // set the pending statement count
    this._pendingStatements = 0;
    
  }
  
  /** On the client connection being established. */
  private OnConnection = async (value: any): Promise<void> => {
    
    Log.Debug(`Database successfully connected to ${this._client.hosts.length} hosts.`);
    
    Input.SubscribeToPrefix('execute ', Database.OnDynamicExecution, "'execute {query}' to dynamically execute a CQL query using the current connection.");
    Input.SubscribeToPrefix('executepaged ', Database.OnDynamicPagedExecution, "'executepaged {query}' to dynamically execute a CQL query using the current connection in a paged fashion.");
    
    // create a map for the existing tables
    let existingTables: Dictionary<string[]> = {};
    
    this._tablesLock.lock(async (): Promise<void> => {
      for(let table of this._tables) {
        await this.SetUpTable(table, existingTables);
        await table.Initialize();
      }
      this._tables = null;
      this._tablesLock.unlock();
    });
    
  }
  
  /** On the client connection being rejected. This is bad. */
  private OnConnectionError = (reason: any): void => {
    
    // log the critical error
    Log.Error(`There was an error connecting to the prospective DB seeds. ${reason}`);
    
    // nullify the client
    this._client = null;
    
  }
  
  private async SetUpTable(table: Table, existingTables: Dictionary<string[]>): Promise<void> {
    
    if(existingTables[table.Keyspace] == null) {
      existingTables[table.Keyspace] = new Array<string>();
      let results: Cassandra.types.ResultSet = null;
      try {
        results = await this.Execute(`SELECT table_name FROM system_schema.tables WHERE keyspace_name='${table.Keyspace}'`);
      } catch(error) {
        Log.Warning(`An error occurred retrieving column families in keyspace '${table.Keyspace}'. ${error}`);
      }
      if(results == null || results.rows.length == 0) {
        Log.Debug(`Confirming keyspace exists; ${table.Keyspace}.`);
        try {
          await this.Execute(`CREATE KEYSPACE IF NOT EXISTS ${table.Keyspace} WITH REPLICATION = ${this.Configuration.DefaultReplication};`);
        } catch(error) {
          Log.Error(`There was an error creating the keyspace '${table.Keyspace}'. ${error}`);
        }
      } else {
        for(let row of results) existingTables[table.Keyspace].push(row['table_name']);
      }
    }
    
    // get whether the table exists
    let exists: boolean = false;
    for(let tableName of existingTables[table.Keyspace]) {
      if(table.Name.toLowerCase() == tableName) {
        exists = true;
        break;
      }
    }
    
    // does the table exist?
    if(!exists) {
      // no, create the table
      await this.CreateTable(table);
    }
    
  }
  
  /** On a query entered via command line */
  private OnDynamicExecution = (query: string): void => {
    
    // execute the query
    Database.Execute(query)
      .then((result: Cassandra.types.ResultSet) => {
        Log.Info("Query Successful;");
        Database.LogResultSet(result);
      })
      .catch((reason: any) => {
        Log.Error(`Encountered exception running dynamic query. ${reason}`);
      });
    
  }
  
  /** On a paged query via command line */
  private OnDynamicPagedExecution = (query: string): void => {
    
    let first = true;
    let separator: string;
    
    // execute the query
    Database.ExecutePaged(query,
      (index: number, row: Cassandra.types.Row) => {
        
        let tableStr: string = '';
        let columnWidth: number = Math.floor((Input.ConsoleWidth-1)/row.__columns.length);
        
        if(first) {
          
          first = false;
          
          let columns: any = row.__columns;
          let rowCount: number = 3;
          
          separator = new Array(columnWidth*columns.length + 2).join('-') + '\n';
          
          // append the header
          tableStr = separator;
          
          for (let i = 0; i < columns.length; ++i) {
            
            let columnName: string = columns[i].name;
            
            tableStr += '|';
            
            if(columnName.length >= columnWidth) {
              tableStr += columnName.substr(0, columnWidth-4) + '...';
            } else if(columnWidth === columnName.length) {
              tableStr += columnName;
            } else {
              tableStr += columnName + new Array(columnWidth - columnName.length).join(' ');
            }
            
          }
          
          tableStr += '|\n';
          tableStr += separator;
          
        }
        
        for(const [key, value] of Object.entries(row)) {
        
          let cellStr: string;
          
          if(value == null) {
            cellStr = 'NULL';
          } else if(typeof value === 'string') {
            cellStr = value;
          } else if(typeof value === 'number') {
            cellStr = value.toString();
          } else if(typeof value === 'boolean') {
            if(value) cellStr = 'true';
            else cellStr = 'false';
          } else if(value instanceof Buffer) {
            cellStr = `Buffer[${value.length}]`;
          } else {
            cellStr = value;
          }
          
          if(cellStr.length >= columnWidth) {
            tableStr += `|${cellStr.substr(0, columnWidth-4)}...`;
          } else if(columnWidth === cellStr.length) {
            tableStr += `|${cellStr}`;
          } else {
            tableStr += `|${cellStr}${new Array(columnWidth - cellStr.length).join(' ')}`;
          }
          
        }
        
        tableStr += '|';
        
        console.log(tableStr);
        
      },
      (reason: any) => {
        
        // was there an error?
        if(reason == null) {
          // no, log end to table and return
          console.log(separator);
          return;
        }
        Log.Error(`Encountered exception running dynamic query. ${reason}`);
        
      });
      
  }
  
  /** Create a table */
  private async CreateTable(table: Table): Promise<void> {
    
    // construct the query
    let statement: string = `CREATE TABLE IF NOT EXISTS ${table.Keyspace}.${table.Name} (`;
    
    let partitionColumns: IColumn[] = [];
    let clusterColumns: IColumn[] = [];
    
    for(let column of table.Columns) {
      switch(column.ColumnType) {
        case ColumnType.PartitionKey:
          partitionColumns.push(column);
          break;
        case ColumnType.ClusterKey:
          clusterColumns.push(column);
          break;
      }
      statement += `${column.Name} ${column.DataType}, `;
    }
    
    statement += `PRIMARY KEY (`;
    if(partitionColumns.length > 1) statement += `(`;
    let first: boolean = true;
    for(let column of partitionColumns) {
      if(first) first = false;
      else statement += ', ';
      statement += `${column.Name}`;
    }
    if(partitionColumns.length > 1) statement += `)`;
    if(clusterColumns.length > 0) {
      for(let column of clusterColumns) {
        statement += `, ${column.Name}`;
      }
    }
    statement += `) )`;
    
    if(table.Properties != null && table.Properties.length > 0) {
      statement += ' WITH '
      for(let property of table.Properties) {
        statement += ` ${property}`;
      }
    }
    
    statement += ';';
    
    // inform
    Log.Debug(`Creating table; '${statement}'.`);
    
    try {
      // run the create table statement
      await this.Execute(statement);
    } catch(error) {
      // inform
      Log.Error(`There was an error creating a new table '${table.Keyspace}.${table.Name}'. ${error}`);
    }
    
  }
  
}

/** Global database manager instance */
export var Database: DatabaseManager = new DatabaseManager();

