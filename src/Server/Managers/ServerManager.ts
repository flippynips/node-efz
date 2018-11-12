/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Server management. Constructs and maintains the server
 *  and provides helper methods for serving endpoints.
 * Revision History: None
 ******************************************************/

import * as express from 'express';
import * as http from 'http';
import { AddressInfo } from 'net';

import { Manager, Caches, Log } from "./Index";
import { PermissionsByUser } from '../Data/Accounts/Index';
import * as Routes from '../Routes/Index';
import * as Middlewares from '../Routes/Middlewares/Index';
import { AccessType, HttpMethod } from '../Tools/Index';

/** Server configuration */
class Configuration {
  /** The host or ip the server will listen to */
  Host: string = "127.0.0.1";
  /** The port the server will listen to */
  Port: number = 80;
  /** Password used to encrypt session ids for use in cookies and user ids when sending confirmation emails */
  CookieEncryptionPassword: string = 'default_cookie_encryption_password';
  /** Password used to encrypt login passwords for database storage */
  PasswordEncryptionPassword: string = 'default_password_encryption_password'
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
  /** Regex used by server and client to validate passwords */
  PasswordRegexStr: string = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{6,20}$";
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
}

/** Manager of servers. */
class ServerManager extends Manager<Configuration> {
  
  //-------------------------------------//
  
  /** Http server instance */
  public ServerInstance: express.Express;
  public Server: http.Server;
  
  /** Cache key for ip addresses used for authentication */
  public EndPointCacheKey: string = 'ip_addresses';
  
  /** Regex used to validate user passwords */
  public PasswordRegex: RegExp;
  
  /** Regex used to validate content names */
  public ContentNameRegex: RegExp;
  
  //-------------------------------------//
  
  //-------------------------------------//
  
  /** Construct a new server manager */
  constructor() {
    super(Configuration);
  }
  
  /** Stop the server manager */
  public async Stop(): Promise<void> {
    await super.Stop();
  }
  
  /** Get the full server host including port if not 80 */
  public GetWebHost(): string {
    return `${this.Configuration.Host}${this.Configuration.Port == 80 ? '' : ':'+this.Configuration.Port}`;
  }
  
  /** Get the temporary struct related to the specified request remote endpoint */
  public GetEndpointStruct(req: express.Request): any {
    var endPointStruct: any = Caches.TryGet(Server.EndPointCacheKey, this.GetIpEndPoint(req));
    if(endPointStruct == null) endPointStruct = {};
    endPointStruct = Caches.AddOrGet(Server.EndPointCacheKey, this.GetIpEndPoint(req), endPointStruct);
    return endPointStruct;
  }
  
  /** Get the remote ip address and port of a request */
  public GetIpEndPoint(req: express.Request): string {
    let address: string | AddressInfo = req.connection.address();
    if(typeof address !== 'string') address = address.address;
    
    // get the remote port
    let port: number = req.connection.remotePort;
    if(port != null) address = `${address}:${port}`;
    
    return address;
  };
  
  /** Get an appropriate menu for the specified request and user */
  public async GetMenu(req: express.Request, res: express.Response): Promise<Routes.IRoute[]> {
    
    let menu: Routes.IRoute[] = [];
    
    for(let route of Routes.All) {
      if(!route.MenuItem || req.path === route.Path) continue;
      if(route.MenuItem.Access) {
        if(!res.locals.User) continue;
        let permit: boolean = true;
        for(let access of route.MenuItem.Access) {
          if(!await PermissionsByUser.HasAccess(res.locals.User.Id, access.Access, access.Resource)) {
            permit = false;
            break;
          }
        }
        if(!permit) continue;
      }
      if(route.MenuItem.Predicate && !route.MenuItem.Predicate(req, res)) {
        continue;
      }
      menu.push(route);
    }
    
    // reorder the menu items
    menu.sort((a, b) => {
      if(a.MenuItem.Priority == b.MenuItem.Priority) return 0;
      if(b.MenuItem.Priority == null) return 1;
      if(a.MenuItem.Priority == null) return -1;
      return a.MenuItem.Priority > b.MenuItem.Priority ? -1 : 1;
    });
    
    return menu;
    
  }
  
  //-------------------------------------//
  
  /** On the server manager */
  protected OnConfiguration = (config: any): void => {
    
    this.PasswordRegex = new RegExp(this.Configuration.PasswordRegexStr).compile();
    this.ContentNameRegex = new RegExp(this.Configuration.ContentNameRegexStr).compile();
    
    // create the server
    if(!this.ServerInstance) {
      
      // add the cache of ip addresses for authentication
      Caches.CreateCache(this.EndPointCacheKey, 600, 300);
      
      // get the express server instance
      this.ServerInstance = express();
      
      // add middleware
      this.ServerInstance.use(Middlewares.All);
      
      // add the api routes
      for(let i = 0; i < Routes.All.length; ++i) {
        let route = Routes.All[i];
        // add the route depending on the method
        switch(route.Method) {
          case HttpMethod.All:
            this.ServerInstance.all(route.Path, route.Effects);
            break;
          case HttpMethod.Get:
            this.ServerInstance.get(route.Path, route.Effects);
            break;
          case HttpMethod.Post:
            this.ServerInstance.post(route.Path, route.Effects);  
            break;
          case HttpMethod.Put:
            this.ServerInstance.put(route.Path, route.Effects);
            break;
          case HttpMethod.Delete:
            this.ServerInstance.delete(route.Path, route.Effects);
            break;
          case HttpMethod.Head:
            this.ServerInstance.head(route.Path, route.Effects);
            break;
          case HttpMethod.Options:
            this.ServerInstance.options(route.Path, route.Effects);
            break;
          case HttpMethod.Patch:
            this.ServerInstance.patch(route.Path, route.Effects);
            break;
        }
      }
      
    }
    
    // start listening
    if(this.Server) this.Server.close();
    try {
      this.Server = this.ServerInstance.listen(config.Port, config.Host);
      Log.Debug(`Server started listening at ${config.Host}:${config.Port}`);
    } catch(error) {
      Log.Error(`Server encountered an error trying to listen at ${config.Host}:${config.Port}. ${error}`);
    }
    
  }
  
}

/** Global server manager instance */
export var Server: ServerManager = new ServerManager();
