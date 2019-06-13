/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Database management. Maintains the client connection
 *  and dynamic query execution.
 * Revision History: None
 ******************************************************/

import * as locks from 'locks';
import * as cassandra from 'cassandra-driver';

import { Manager, IConfiguration, Log, Input } from "./Index";
import { Sleep, IsNullOrEmpty, Json, Dictionary, CascadeRejection } from '../Tools/Index';
import { Column, Table, ColumnType, Statement } from "../Data/Base/Index";
import { RetryPolicy, ReconnectionPolicy } from '../Tools/Database/Index';
import { Time, Application } from '../../Shared/Managers/Index';

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
  DefaultReplication: string = "{ 'class' : 'SimpleStrategy', 'replication_factor' : 2 }";
  
  /** Default keyspace used by tables. */
  DefaultKeyspace: string = 'default';
  
  /** Maximum number of concurrent queries. */
  MaxConcurrentRequests: number = 20;
  /** If the number of concurrent requests are exceeded, this defines
   * the default timeout of requests. */
  ConcurrentRequestsTimeout: number = 1000 * 10;
  
}

/** Database management. */
class DatabaseManager extends Manager {
  
  //-----------------------------------//
  
  /** Get whether the database has been connected to and tables started. */
  public get IsConnected(): boolean {
    return this._areTablesStarted
      && (<any>this.Client).connected;
  }
  
  /** Database client connection */
  public Client: cassandra.Client;
  
  /** Database configuration. */
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  //-----------------------------------//
  
  /** Collection of tables managed by the database manager */
  protected _tables: Table[];
  /** Lock for the tables collection */
  protected _tablesLock: locks.Mutex;
  /** Flag indicating tables have been set up. */
  protected _areTablesStarted: boolean;
  
  /** Pending statement executions */
  protected _pendingStatements: number;
  /** Number of 20ms increments spent waiting for pending statements. */
  protected _pendingIterationCount: number;
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-----------------------------------//
  
  /** Construct a new database manager. */
  constructor() {
    super();
    
    this._tables = [];
    this._tablesLock = new locks.Mutex();
    this._areTablesStarted = false;
    
  }
  
  /** Start the database manager. Connects to the DB. */
  public async Start(): Promise<void> {
    await super.Start();
    
    this._configuration = Application.Configuration(
      './config/DatabaseManager.config',
      new Configuration(),
      this.OnConfiguration
    );
    await this._configuration.Load();
    
    // initialize the known tables
    for(let table of this._tables) await table.Initialize();
    
    // attempt connection immediately
    this.Client.on('connected', this.OnConnection);
    this.Client.on('error', this.OnConnectionError);
    this.Client.connect();
    
  }
  
  /** Stop the database manager. Disconnects from the DB. */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    // end each table
    for(let table of this._tables) await table.Stop();
    
    // wait for pending statements
    await Sleep(20);
    while(this._pendingStatements > 0) {
      if(++this._pendingIterationCount > 50 * this._pendingStatements) {
        this._pendingIterationCount = 0;
        Log.Debug(`Waiting for ${this._pendingStatements} pending statements.`);
      }
      await Sleep(20);
    }
    
    await this.Client.shutdown();
    
    await this._configuration.Save();
    
  }
  
  /** Execute the specified query using the current active database client. May return NULL. */
  public async Execute(statement: Statement, options: cassandra.QueryOptions = undefined): Promise<cassandra.types.ResultSet> {
    
    if(!this.IsConnected) throw new Error('No Database Connection.');
    
    if(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
      await Sleep(20);
      let timeoutStamp: number = Time.Now + this.Configuration.ConcurrentRequestsTimeout;
      while(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
        if(++this._pendingIterationCount > 50 * this._pendingStatements) {
          this._pendingIterationCount = 0;
          Log.Silly(`Waiting for pending DB statements...`);
        }
        if(Time.Now > timeoutStamp) {
          throw new Error(`Timed out waiting for pending DB statements.`);
        }
        await Sleep(20);
      }
    }
    
    // increment the pending statements
    ++this._pendingStatements;
    
    try {
      // execute the statement and return the result set
      return await this.Client.execute(statement.query, statement.params, options || { prepare: true });
    } finally {
      // decrement the pending statements
      --this._pendingStatements;
    }
    
  }
  
  /** Select rows from a table in a paged fashion.
   * Row callback executes for each row.
   * callback executes on complete by default and if autoPage option is true.
   * Otherwise, callback executes each page with 'autoPage' function set for
   * executing the next paged query.
   * NOTE : You must call the returned function on complete to decrement pending
   * statement count.
   */
  public async ExecutePaged(
    statement: Statement,
    rowCallback: (index: number, row: cassandra.types.Row) => void,
    callback: (error?: any, result?: cassandra.types.ResultSet) => void = null,
    options: cassandra.QueryOptions = null
  ): Promise<() => void> {
    
    if(!this.IsConnected) {
      Log.Error("Database client isn't connected. Query failed.");
      callback("Database client isn't connected. Query failed.");
      return;
    }
    
    if(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
      await Sleep(20);
      let timeoutStamp: number = Time.Now + this.Configuration.ConcurrentRequestsTimeout;
      while(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
        if(++this._pendingIterationCount > 50 * this._pendingStatements) {
          this._pendingIterationCount = 0;
          Log.Silly(`Waiting for pending DB statements...`);
        }
        if(Time.Now > timeoutStamp) {
          throw new Error(`Timed out waiting for pending DB statements.`);
        }
        await Sleep(20);
      }
    }
    
    // increment the pending statements
    ++this._pendingStatements;
    
    this.Client.eachRow(
      statement.query,
      statement.params,
      options || { prepare: false, autoPage: true, fetchSize: 100 },
      rowCallback,
      callback
    );
    
    let self = this;
    return () => {
      --self._pendingStatements;
    };
    
  }
  
  /** Helper method to execute a paged statement in promise-like fashion
   * where a max number of consequtive row callbacks can be active at once.
   */
  public ExecuteStaggered(
    statement: Statement,
    rowCallback: (index: number, row: cassandra.types.Row) => Promise<boolean>,
    options: cassandra.QueryOptions = null,
    consequtiveCallbacks: number = 5
  ): Promise<void> {
    
    if(options) {
      if(!options.fetchSize) options.fetchSize = 10;
      options.autoPage = false;
    } else {
      options = {
        prepare: false,
        autoPage: false,
        fetchSize: 10
      };
    }
    
    return new Promise((resolve, reject) => {
      
      // persist number of callbacks
      let activeCallbacks: number = 0;
      // last query result
      let resultSet: cassandra.types.ResultSet;
      // flag indicating a new page is being fetched
      let fetchingPage: boolean = true;
      
      let pendingRows: {index: number, row: cassandra.types.Row}[] = [];
      
      let onDone: () => void;
      Database.ExecutePaged(
        statement,
        (index, row) => {
          
          pendingRows.push({index, row});
          
          if(activeCallbacks === consequtiveCallbacks) return;
          ++activeCallbacks;
          
          (async function(): Promise<void> {
            
            // while there are more pending rows
            let nextRow = pendingRows.shift();
            while(nextRow) {
              
              // run the callback
              try {
                if(!await rowCallback(nextRow.index, nextRow.row)) {
                  // end iteration
                  resultSet.nextPage = null;
                  pendingRows = [];
                }
              } catch(error) {
                Log.Warning(`Row callback error for query '${statement.query}'. ${error && error.stack || error}`);
              }
              
              // should the next page be fetched?
              if(!fetchingPage
              && activeCallbacks < consequtiveCallbacks / 2 + 1) {
                // yes, start fetching the next page
                if(resultSet.nextPage) {
                  fetchingPage = true;
                  resultSet.nextPage();
                }
              }
              
              nextRow = pendingRows.shift();
              
            }
            
            // have all callbacks been completed and
            // have all pages been fetched?
            if(--activeCallbacks === 0 && !fetchingPage) {
              
              // yes, resolve
              onDone();
              resolve();
              
            }
            
          })();
          
        },
        (error, result) => {
          
          if(error) {
            onDone();
            reject(error);
            return;
          }
          
          // update the last result
          resultSet = result;
          fetchingPage = false;
          
          // we done here?
          if(!result.nextPage && activeCallbacks === 0) {
            
            // yes, resolve
            onDone();
            resolve();
            
          }
          
        },
        options
      )
      .then((callback) => {
        onDone = callback;
      });
    
    });
    
  }
  
  /** Execute the specified query using the current active database client. May return NULL. */
  public async ExecuteBatch(statements: Statement[], options: cassandra.QueryOptions = null): Promise<boolean> {
    
    if(!this.IsConnected) throw new Error('No Database Connection.');
    if(statements.length === 0) return true;
    
    // check pending statement count
    if(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
      await Sleep(20);
      let timeoutStamp: number = Time.Now + this.Configuration.ConcurrentRequestsTimeout;
      while(this._pendingStatements === this.Configuration.MaxConcurrentRequests) {
        if(++this._pendingIterationCount > 50 * this._pendingStatements) {
          this._pendingIterationCount = 0;
          Log.Silly(`Waiting for pending DB statements...`);
        }
        if(Time.Now > timeoutStamp) {
          throw new Error(`Timed out waiting for pending DB statements.`);
        }
        await Sleep(20);
      }
    }
    
    // increment the pending statements
    ++this._pendingStatements;
    
    try {
      
      // execute the statement and return the result set
      let results = await this.Client.batch(statements, options || { prepare: true });
      
      // return whether the batch was successful
      return results && (!results.rows || results.rows[0]['[applied]'] === true);
      
    } finally {
      
      // decrement the pending statements
      --this._pendingStatements;
      
    }
    
  }
  
  /** Log a cassandra result set including column names and formatting */
  public async LogResultSet(resultSet: cassandra.types.ResultSet, paginate: boolean = false): Promise<void> {
    
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
      const row = resultSet.rows[y];
      for(const column of columns) {
        const value = row[column.name];
        
        let cellStr: string = this.GetCellString(value);
        
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
    
    let self = this;
    this._tablesLock.lock(async (): Promise<void> => {
      try {
        if(self._areTablesStarted) {
          if(await self.SetUpTable(table, {})) {
            self._tables.push(table);
            await table.Start();
          }
        } else {
          self._tables.push(table);
        }
      } finally {
        self._tablesLock.unlock();
      }
    });
    
  }
  
  //-----------------------------------//
  
  /** On the server configuration being updated */
  protected OnConfiguration = (config: Configuration): void => {
    
    // construct the client options
    
    let clientOptions: cassandra.ClientOptions = {
      contactPoints: config.ContactPoints,
      maxPrepared: 200,
      policies: {
        loadBalancing: new cassandra.policies.loadBalancing.RoundRobinPolicy(),
        retry: new RetryPolicy(),
        reconnection: new ReconnectionPolicy(40, 5000),
        //addressResolution: undefined,
        //speculativeExecution: undefined,
        //timestampGeneration: undefined
      },
      queryOptions: {
        logged: false,
        autoPage: true
      },
      pooling: {
        heartBeatInterval: 7777,
        maxRequestsPerConnection: config.MaxConcurrentRequests + 5,
        warmup: false
      }
    };
    
    // create the authentication provider
    if(!IsNullOrEmpty(config.Username) && !IsNullOrEmpty(config.Password)) {
      clientOptions.authProvider = new cassandra.auth.PlainTextAuthProvider(config.Username, config.Password);
    }
    
    // create or recreate the cassandra client
    if(this.Client) this.Client.shutdown();
    this.Client = new cassandra.Client(clientOptions);
    
    // set the pending statement count
    this._pendingStatements = 0;
    
  }
  
  /** On the client connection being established. */
  private OnConnection = async (error: any): Promise<void> => {
    
    // was there an error?
    if(error) {
      // yes, reconnect
      Log.Warning(`Error connecting to hosts. ${error}`);
      await Sleep(5000);
      this.Client.connect();
      return;
    }
    
    // has the database already started?
    if(this.IsConnected) {
      // yes, connection was re-established
      return;
    }
    
    Log.Info(`Database successfully connected to '${this.Client.hosts.length}' hosts.`);
    
    Input.SubscribeToPrefix('execute ', this.OnDynamicExecution, "'execute {query}' to dynamically execute a CQL query.");
    Input.SubscribeToPrefix('executepaged ', this.OnDynamicPagedExecution, "'executepaged {query}' to dynamically execute a CQL query in an async paged fashion.");
    Input.SubscribeToPrefix('executejson ', this.OnDynamicJsonExecution, "'executejson {query}' to dynamically execute a CQL query with the results formatted with json compatability.");
    
    // create a map for the existing tables
    let existingTables: Dictionary<string[]> = {};
    
    let self = this;
    this._tablesLock.lock(async (): Promise<void> => {
      try {
        for(let i = self._tables.length-1; i >= 0; --i) {
          if(!await self.SetUpTable(self._tables[i], existingTables)) {
            self._tables.RemoveAt(i);
          }
        }
        Log.Silly(`Initial tables started.`);
        self._areTablesStarted = true;
        for(let table of self._tables) {
          await table.Start();
        }
      } finally {
        self._tablesLock.unlock();
      }
    });
    
  }
  
  /** On the client connection being rejected. This is bad. */
  private OnConnectionError = (reason: any): void => {
    
    // log the critical error
    Log.Error(`There was an error with the DB client. ${reason}`);
    
    try {
      this.Client.connect();
    } catch(error) {
      Log.Warning(`Error with client connection attempt. ${error}`);
      Time.AddTimer(5000, () => this.OnConnectionError('Attempting another connection...'));
    }
    
  }
  
  /** Set up the specified table. */
  private async SetUpTable(table: Table, existingTables: Dictionary<string[]>): Promise<boolean> {
    
    // if not set, set the default keyspace
    if(!table.Keyspace) table.Keyspace = this.Configuration.DefaultKeyspace;
    
    if(existingTables[table.Keyspace] == null) {
      existingTables[table.Keyspace] = new Array<string>();
      let results: cassandra.types.ResultSet = null;
      try {
        results = await this.Client.execute(`SELECT table_name FROM system_schema.tables WHERE keyspace_name='${table.Keyspace}'`, undefined, { prepare: false });
      } catch(error) {
        Log.Warning(`An error occurred retrieving column families in keyspace '${table.Keyspace}'. ${error}`);
      }
      if(results == null || results.rows.length == 0) {
        Log.Debug(`Confirming keyspace '${table.Keyspace}' exists.`);
        try {
          let results = await this.Client.execute(`CREATE KEYSPACE IF NOT EXISTS ${table.Keyspace} WITH REPLICATION = ${this.Configuration.DefaultReplication};`, undefined, { prepare: false });
          if(results.rows && results.rows[0]['[applied]']) Log.Debug(`Created keyspace '${table.Keyspace}'.`);
        } catch(error) {
          Log.Error(`There was an error creating the keyspace '${table.Keyspace}'. ${error}`);
          return false;
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
      try {
        await this.CreateTable(table);
      } catch(error) {
        // inform
        Log.Error(`There was an error creating a new table '${table.Keyspace}.${table.Name}'. ${error}`);
        return false;
      }
    }
    
    return true;
    
  }
  
  /** On a query entered via command line */
  private OnDynamicExecution = (query: string): void => {
    
    // try get a timeout spec
    let firstSpace: number = query.indexOf(' ');
    let firstWord: string = query.substr(0, firstSpace);
    let timeout: number = parseInt(firstWord);
    
    if(timeout) query = query.substr(firstSpace+1);
    else timeout = 60;
    
    Log.Debug(`Running query with a timeout of ${timeout}s.`);
    
    // execute the query
    this.Execute({query}, { prepare: false, readTimeout: (timeout * 1000) })
      .then((result: cassandra.types.ResultSet) => {
        Log.Info("Query Successful;");
        this.LogResultSet(result);
      })
      .catch((reason: any) => {
        Log.Error(`Encountered exception running dynamic query. ${reason}`);
      });
    
  }
  
  /** On a query entered via command line */
  private OnDynamicJsonExecution = (query: string): void => {
    
    // try get a timeout spec
    let firstSpace: number = query.indexOf(' ');
    let firstWord: string = query.substr(0, firstSpace);
    let timeout: number = parseInt(firstWord);
    
    if(timeout) query = query.substr(firstSpace+1);
    else timeout = 60;
    
    Log.Debug(`Running query with a timeout of ${timeout}s.`);
    
    // execute the query
    this.Execute({query}, { prepare: false, readTimeout: (timeout * 1000) })
      .then((result: cassandra.types.ResultSet) => {
        Log.Info("Query Successful;");
        
        console.log('_____________________________________________________\n');
        for(let y = 0; y < result.rows.length; ++y) {
          const row = result.rows[y];
          for(const column of result.columns) {
            const value = row[column.name];
            
            let cellStr: string = this.GetCellString(value, true);
            
            console.log(`| ${column.name} | ${cellStr}`);
            
          }
          console.log('_____________________________________________________\n');
        }
        
      })
      .catch((reason: any) => {
        Log.Error(`Encountered exception running dynamic query. ${reason}`);
      });
    
  }
  
  /** On a paged query via command line */
  private OnDynamicPagedExecution = (query: string): void => {
    
    let first = true;
    let separator: string;
    let onComplete: () => void;
    let columns: string[];
    
    
    // execute the query
    this.ExecutePaged(
      { query: query },
      (index: number, row: cassandra.types.Row) => {
        
        let tableStr: string = '';
        let columnWidth: number = Math.floor((Input.ConsoleWidth-1)/row.__columns.length);
        
        if(first) {
          
          first = false;
          
          columns = row.__columns.map((c: {name:string}) => c.name);
          
          separator = new Array(columnWidth*columns.length + 2).join('-') + '\n';
          
          // append the header
          tableStr = separator;
          
          for(let column of columns) {
            
            tableStr += '|';
            
            if(column.length >= columnWidth) {
              tableStr += column.substr(0, columnWidth-4) + '...';
            } else if(columnWidth === column.length) {
              tableStr += column;
            } else {
              tableStr += column + new Array(columnWidth - column.length).join(' ');
            }
            
          }
          
          tableStr += '|\n';
          tableStr += separator;
          
        }
        
        for(const column of columns) {
          const value = row[column];
          
          let cellStr: string = this.GetCellString(value);
          
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
      (error, result) => {
        
        // was there an error?
        if(error == null) {
          // no, log end to table and return
          console.log(separator);
          if(result.rowLength === 0) onComplete();
          return;
        }
        
        onComplete();
        Log.Error(`Encountered exception running dynamic query. ${error}`);
        
      }
    )
    .then((callback) => {
      
      onComplete = callback;
      
    });
      
  }
  
  /** Get a cell string appropriate for the specified value. */
  private GetCellString(value: any, stringifyJson: boolean = false): string {
    
    if(value == null) {
      return 'NULL';
    } else if(typeof value === 'string') {
      if(stringifyJson && value.startsWith('{')) {
        try {
          let obj = JSON.parse(value, Json.Parse);
          return '\n' + JSON.stringify(obj, Json.Stringify, 2);
        } catch {
          return value;
        }
      }
      return value;
    } else if(typeof value === 'number') {
      return value.toString();
    } else if(typeof value === 'boolean') {
      if(value) return 'true';
      else return 'false';
    } else if(Buffer.isBuffer(value)) {
      return `Blob[${value.length}]`;
    } else if(Array.isArray(value)) {
      return value.map(v => this.GetCellString(v, stringifyJson)).join(',');
    } else {
      if(stringifyJson) return JSON.stringify(value, Json.Stringify, 2);
      try { return JSON.stringify(value, Json.Stringify); }
      catch { return value.toString(); }
    }
    
  }
  
  /** Create a table */
  private async CreateTable(table: Table): Promise<void> {
    
    if(!this.Client.connected) throw new Error('No Database Connection.');
    
    // construct the query
    let query: string = `CREATE TABLE IF NOT EXISTS ${table.Keyspace}.${table.Name} (`;
    
    let partitionColumns: Column[] = [];
    let clusterColumns: Column[] = [];
    
    for(let column of table.Columns) {
      switch(column.ColumnType) {
        case ColumnType.PartitionKey:
          partitionColumns.push(column);
          break;
        case ColumnType.ClusterKey:
          clusterColumns.push(column);
          break;
      }
      query += `${column.Name} ${column.DataType}, `;
    }
    
    query += `PRIMARY KEY (`;
    if(partitionColumns.length > 1) query += `(`;
    let first: boolean = true;
    for(let column of partitionColumns) {
      if(first) first = false;
      else query += ', ';
      query += `${column.Name}`;
    }
    if(partitionColumns.length > 1) query += `)`;
    if(clusterColumns.length > 0) {
      for(let column of clusterColumns) {
        query += `, ${column.Name}`;
      }
    }
    query += `) )`;
    
    if(table.Properties != null && table.Properties.length > 0) {
      query += ' WITH '
      for(let property of table.Properties) {
        query += ` ${property}`;
      }
    }
    
    query += ';';
    
    // inform
    Log.Debug(`Creating table; '${query}'.`);
    
    // run the create table statement
    await this.Client.execute(query, undefined, { prepare: false });
    
  }
  
}

/** Global database manager instance */
export const Database: DatabaseManager = new DatabaseManager();

