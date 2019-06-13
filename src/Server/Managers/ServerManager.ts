/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Server management. Constructs and maintains the server
 *  and provides helper methods for serving endpoints.
 * Revision History: None
 ******************************************************/

import * as express from 'express';
import * as http from 'http';
import * as greenlock from 'greenlock-express';

import { Application, Manager, Caches, Log, IConfiguration } from "./Index";
import { NetHelper, Route } from '../Routes/Index';
import { AccessType, Http, Sleep } from '../Tools/Index';
import { Routes as ApiRoutes } from '../Routes/Api/Index';
import { Middlewares as Middlewares } from '../Routes/Middlewares/Index';

/** Server configuration */
class Configuration {
  
  /** Secure host or ip the server will listen to. */
  SecureHost: string = '0.0.0.0';
  /** Unsecure host or ip the server will listen to. */
  UnsecureHost: string = '127.0.0.1';
  /** The port the server will listen securely to. */
  SecurePort: number = 443;
  /** The port the server will listen unsecurely to. */
  UnsecurePort: number = 80;
  
  /** Minimum time between api requests. */
  DefaultRequestInterval: number = 10000;
  /** Maximum number of consequtive requests before api requests are rejected. */
  DefaultRequestIntervalCount: number = 5;
  
  /** Password used to encrypt session ids for use in cookies and user ids when sending confirmation emails */
  CookieEncryptionPassword: string = 'default_cookie_encryption_password';
  /** Password used to encrypt login passwords for database storage */
  PasswordEncryptionPassword: string = 'default_password_encryption_password';
  
  /** Name of the session cookie stored for authentication */
  SessionCookieName: string = 'default_cookie_name';
  /** Secret admin code that can be used to create administrator accounts */
  AdminCode: string = 'default_admin_code';
  /** Default unhandled error message if a request results in an unhandled error. */
  DefaultUnhandledMessage: string = 'A problem has occured. Please try again.';
  /** Default page logged in sessions will redirect to automatically */
  DefaultLandingPage: string = '/dashboard';
  /** Number of failed login attempts before a session is locked out */
  LoginAttemptLimit: number = 3;
  /** Regex used by server and client to validate content names */
  ContentNameRegexStr: string =  ".[-._a-zA-Z0-9]{1,}";
  
  /** Permissions provided to users upon creation */
  UserStandardAccess: { Resource: string, Access: AccessType[] }[] = [
    { Resource: 'dashboard', Access: [ AccessType.Read ] },
    { Resource: 'user/${user.Email}', Access: [ AccessType.Read ] },
    { Resource: 'content', Access: [ AccessType.Read ] }
  ];
  /** Permissions provided to administrators in addition to standard permissions */
  UserAdminAccess: { Resource: string, Access: AccessType[] }[] = [
    { Resource: 'application', Access: [ AccessType.Read, AccessType.Update, AccessType.Create, AccessType.Delete ] },
    { Resource: 'user', Access: [ AccessType.Read, AccessType.Update, AccessType.Create, AccessType.Delete ] },
    { Resource: 'user/${user.Email}', Access: [ AccessType.Read, AccessType.Update, AccessType.Create, AccessType.Delete ] },
    { Resource: 'content', Access: [ AccessType.Read, AccessType.Update, AccessType.Create, AccessType.Delete ] }
  ];
  
  /** Time in seconds an end point struct will be cached for. */
  EndPointStructLifetime: number = 1000 * 10;
  
  /** Enable local greenlock and secure ssl certs. */
  Secure: boolean = false;
  /** Domains to be validated. Should be without 'www' prefix. */
  Domains: string[] = [ 'somedomain.com', 'someotherdomain.org' ];
  
}

/** Manager of servers. */
class ServerManager extends Manager {
  
  //-------------------------------------//
  
  /** Http server instance */
  public ServerInstance: express.Express;
  public Server: http.Server;
  
  /** Cache key for ip addresses used for authentication */
  public EndPointCacheKey: string = 'server.eps';
  
  /** Regex used to validate content names */
  public ContentNameRegex: RegExp;
  
  public get Routes(): Route[] {
    return this._routes;
  }
  
  /** Server configuration. */
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  //-------------------------------------//
  
  /** Current server routes. */
  protected _routes: Route[];
  
  /** Current collection of middleware. */
  protected _middleware: (express.RequestHandler | express.ErrorRequestHandler)[];
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-------------------------------------//
  
  /** Construct a new server manager */
  constructor() {
    super();
    this._routes = [];
    this._middleware = [];
  }
  
  /** Start the server manager. */
  public async Start(): Promise<void> {
    await super.Start();
    
    this._configuration = Application.Configuration(
      './config/ServerManager.config',
      new Configuration(),
      this.OnConfiguration
    );
    await this._configuration.Load();
    
  }
  
  /** Stop the server manager */
  public async Stop(): Promise<void> {
    await super.Stop();
    
    this.Server.maxConnections = 0;
    if(this.Server) {
      
      // stop accepting new connections
      await new Promise<void>((resolve) => this.Server.close(resolve));
      // wait for any active connections
      const timeout: number = 1000 * 60 * 30;
      let time: number = 0;
      while(true) {
        let count = await new Promise<number>((resolve) => this.Server.getConnections((err, count) => {
          if(err) {
            Log.Warning(`Error checking for connections; ${err}`);
            resolve(0);
          } else resolve(count);
        }));
        if(count === 0) break;
        if(time % 4000 === 0) Log.Info(`Waiting for '${this.Server.connections}' server connections.`);
        if(time > timeout) break;
        await Sleep(200);
        time += 200;
      }
    }
    
    await this._configuration.Save();
    
  }
  
  /** Get the full server host including port if not 80 */
  public GetWebHost(): string {
    return `${this.Configuration.SecureHost}${this.Configuration.SecurePort == 80 ? '' : `:${this.Configuration.SecurePort}`}`;
  }
  
  /** Get the temporary struct related to the specified request remote endpoint */
  public GetEndPointStruct(req: express.Request): any {
    return Caches.SetOrGet(
      Server.EndPointCacheKey,
      NetHelper.GetEndPointString(req),
      {},
      this.Configuration.EndPointStructLifetime
    );
  }
  
  /** Add the specified route. */
  public AddRoutes(...routes: Route[]): void {
    
    for(let route of routes) {
      
      if(this.ServerInstance) {
        Log.Silly(`Listening for '${Http.Method[route.Method]}:${this.GetWebHost()}${route.Path}'`)
        switch(route.Method) {
          case Http.Method.All:
            this.ServerInstance.all(route.Path, route.Effects);
            break;
          case Http.Method.Get:
            this.ServerInstance.get(route.Path, route.Effects);
            break;
          case Http.Method.Post:
            this.ServerInstance.post(route.Path, route.Effects);  
            break;
          case Http.Method.Put:
            this.ServerInstance.put(route.Path, route.Effects);
            break;
          case Http.Method.Delete:
            this.ServerInstance.delete(route.Path, route.Effects);
            break;
          case Http.Method.Head:
            this.ServerInstance.head(route.Path, route.Effects);
            break;
          case Http.Method.Options:
            this.ServerInstance.options(route.Path, route.Effects);
            break;
          case Http.Method.Patch:
            this.ServerInstance.patch(route.Path, route.Effects);
            break;
        }
      }
        
      if(this._routes.indexOf(route) === -1) {
        this._routes.push(route);
      }
      
    }
    
  }
  
  /** Remove the specified route. */
  public RemoveRoutes(...routes: Route[]): void {
    for(let route of routes) {
      this._routes.Remove(route);
      if(this.ServerInstance) {
        this.ServerInstance.purge(route.Path, route.Effects);
      }
    }
  }
  
  public AddMiddlewares(...handlers: (express.RequestHandler | express.ErrorRequestHandler)[]): void {
    
    for(let handler of handlers) {
      
      if(this.ServerInstance) {
        this.ServerInstance.use(handler);
      }
      
      if(this._middleware.indexOf(handler) === -1) {
        this._middleware.push(handler);
      }
      
    }
    
  }
  
  //-------------------------------------//
  
  /** On the server manager */
  protected OnConfiguration = (config: Configuration): void => {
    
    this.ContentNameRegex = new RegExp(this.Configuration.ContentNameRegexStr).compile();
    
    // create the server
    if(!this.ServerInstance) {
      
      // add default middleware and routes
      this.AddMiddlewares(...Middlewares);
      this.AddRoutes(...ApiRoutes);
      
      // add the cache of ip addresses for authentication
      if(config.EndPointStructLifetime > 0) {
        Caches.CreateCache(
          this.EndPointCacheKey,
          config.EndPointStructLifetime
        );
      }
      
      // get the express server instance
      this.ServerInstance = express();
      this.ServerInstance.disable('x-powered-by');
      
      // add middleware
      this.AddMiddlewares(...this._middleware);
      
      // add added routes
      this.AddRoutes(...this._routes);
      
    }
    
    // stop listening
    if(this.Server) this.Server.close();
    
    // should the server be secure?
    if(config.Secure) {
      
      // yes, set up greenlock
      try {
        let self = this;
        let glx = greenlock.create({
          
          configDir: './config/acme/',   // Writable directory where certs will be saved
          communityMember: false,        // Join the community to get notified of important updates
          telemetry: false,              // Contribute telemetry data to the project
          debug: false,
          securityUpdates: false,
          
          store: require('greenlock-store-fs'),
          
          //server: 'https://acme-staging-v02.api.letsencrypt.org/directory',
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          
          app: function(req: any, res: any) {
            self.ServerInstance(req, res);
          },
          
          approveDomains: function(
            opts: { domain: string, domains: string[], email: string, agreeTos: boolean },
            certs: any[],
            cb: (err: Error, result?: { options: any, certs?: any[] }) => void
          ) {
            
            if(config.Domains.findIndex(d => d === opts.domain || 'www.'+d === opts.domain) === -1) {
              cb(new Error(`No config found for '${opts.domain}'.`));
              return;
            }
            
            opts.email = 'joshua@reclaimgames.com';
            opts.agreeTos = true;
            opts.domains = config.Domains;
            
            cb(null, { options: opts });
            
          }
          
        });
        
        this.Server = glx.listen(`${config.UnsecureHost}:${config.UnsecurePort}`, `${config.SecureHost}:${config.SecurePort}`);
        
      } catch(error) {
        Log.Error(`Secure server encountered an error trying to listen to '${config.SecureHost}:${config.SecurePort}|${config.UnsecurePort}'. ${error}`);
      }
      
    } else {
      
      // start listening
      try {
        this.Server = this.ServerInstance.listen(config.SecurePort, config.SecureHost);
        Log.Info(`Server started listening at ${config.SecureHost}:${config.UnsecurePort}`);
      } catch(error) {
        Log.Error(`Server encountered an error trying to listen to '${config.SecureHost}:${config.UnsecurePort}'. ${error}`);
      }
      
    }
    
  }
  
}

/** Global server manager instance */
export const Server: ServerManager = new ServerManager();
