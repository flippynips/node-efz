/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Table containing permissions of a user id to a resource.
 *  Permissions are path-based and are retrieved by order of specificity.
 *  E.g. permissions for '/resource' will be provided for access to
 *  '/resource/some_file' unless permissions for '/resource/some_file'
 *  exist.
 * Revision History: None
 ******************************************************/

import { IPermissions, IUser } from './Index';
import { AccessType } from '../../Tools/Index';
import { Table, ColumnType } from '../Base/Index';
import { Application, Caches, Log, Server } from '../../Managers/Index';

/** Table of access specifications by user id and resource */
class PermissionsByUserTable extends Table {
  
  //------------------------------------------//
  
  /** Permissions cache collection key */
  public static readonly CacheKey: string = 'permissions';
  
  //------------------------------------------//
  
  //------------------------------------------//
  
  /** Construct a new table */
  public constructor() {
    super('PermissionsByUser', 'global', [
      { Name: 'userid', DataType: 'ascii', ColumnType: ColumnType.PartitionKey },
      { Name: 'resource', DataType: 'ascii', ColumnType: ColumnType.ClusterKey },
      { Name: 'access', DataType: 'set<ascii>', ColumnType: ColumnType.DataColumn }
    ]);
  }
  
  /** Initialize the table. */
  public async Initialize(): Promise<void> {
    await super.Initialize();
    // create a cache collection for permissions
    Caches.CreateCache<IPermissions>(PermissionsByUserTable.CacheKey, 800, 400, null, this.UpdatePermissions);
  }
  
  /** Add default permissions to those associated with the specified user. */
  public async AddStandardAccess(user: IUser): Promise<void> {
    
    // add standard access
    
    for(let permission of Server.Configuration.UserStandardAccess) {
      await PermissionsByUser.SetAccess(user.Id,
        this.EvaluateResource(permission.Resource, user),
        permission.Access);
    }
    
  }
  
  /** Add administrator permissions to those associated with the specified user */
  public async AddAdminAccess(user: IUser): Promise<void> {
    
    // add the admin access
    
    for(let permission of Server.Configuration.UserAdminAccess) {
      await PermissionsByUser.SetAccess(user.Id,
        this.EvaluateResource(permission.Resource, user),
        permission.Access);
    }
    
  }
  
  /** Get whether the specified user has the specified access to the resource.
   * If no specific permissions are available, the next less-specific resource is
   * checked until the resource path is exhausted or permissions are found.
   */
  public async HasAccess(userId: string, access: AccessType, resource: string): Promise<boolean> {
    
    // get the most relevant permissions
    let permissions: IPermissions = await this.GetPermissions(userId, resource);
    
    // were the permissions retrieved? yes, return
    if(!permissions || !permissions.Access) return false;
    
    // iterate the access
    for(let i = 0; i < permissions.Access.length; ++i) {
      if(permissions.Access[i] == access) return true;
    }
    
    // access doesn't match
    return false;
    
  }
  
  /** Get most specific allowed access by user id and resource path. May return 'Null'
   * if permissions aren't found. If no specific permissions are available, the next
   * less-specific resource is checked until the resource path is exhausted or permissions
   * are found.
   */
  public async GetPermissions(userId: string, resource: string): Promise<IPermissions> {
    if(!userId || !resource) {
      Log.Error('Either user id or resource path was not specified while attempting to get access.');
      return null;
    }
    
    // split and validate the resource path
    let resourceSplit: string[] = resource.split('/');
    if(resourceSplit[0] === '') delete resourceSplit[0];
    if(resourceSplit[resourceSplit.length-1] === '') delete resourceSplit[resourceSplit.length-1];
    
    let row;
    let resourcePath: string;
    let permissions: IPermissions;
    
    // iterate the resource specifications from most specific to least specific
    for(let i = resourceSplit.length-1; i >= 0; --i) {
      
      resourcePath = resourceSplit.join('/');
      
      // try get the permissions from the cache
      permissions = Caches.TryGet(PermissionsByUserTable.CacheKey, `${userId}::${resourcePath}`);
      
      // were permissions retrieved?
      if(permissions && permissions.Access && permissions.Access.length > 0) return permissions;
      
      // try get the row
      try {
        
        row = await this.SelectSingle('access', [
          { spec: 'userid=?', param: userId },
          { spec: 'resource=?', param: resourcePath }
        ]);
      
      } catch(error) {
        
        Log.Error(`Error selecting permissions from DB. ${error}`);
        return null;
        
      }
      
      // was the row retrieved? yes, break
      if(row != null && row['access'] != null) break;
      
      // remove the last element from the collection
      resourceSplit.RemoveAt(i);
      
    }
    
    // was the row retrieved? no, return
    if(row == null || row['access'] == null) return null;
    
    // construct the permissions structure
    permissions = {
      UserId: userId,
      Resource: resourcePath,
      Access: row['access']
    };
    
    // add the permissions to the cache
    permissions = Caches.SetOrGet(PermissionsByUserTable.CacheKey, `${userId}::${resourcePath}`, permissions);
    
    // return the permissions
    return permissions;
    
  }
  
  /** Set the specified users access to the specified resource */
  public async SetAccess(userId: string, resource: string, access: AccessType[]): Promise<void> {
    
    // should access be removed?
    if(access.length === 0) {
      await this.RemoveAccess(userId, resource);
      return;
    }
    
    // split and validate the resource path
    let resourceSplit: string[] = resource.split('/');
    if(resourceSplit[0] === '') delete resourceSplit[0];
    if(resourceSplit[resourceSplit.length-1] === '') delete resourceSplit[resourceSplit.length-1];
    resource = resourceSplit.join('/');
    
    let cacheId: string = `${userId}::${resource}`;
    
    // try get the permissions from the cache
    let permissions: IPermissions = Caches.TryGet(PermissionsByUserTable.CacheKey, cacheId);
    
    // were the permissions retrieved?
    if(permissions) {
      // yes, update the access
      permissions.Access = access;
      // update the cache
      Caches.Set(PermissionsByUserTable.CacheKey, cacheId, permissions);
      return;
    }
    
    // construct the permissions
    permissions = {
      UserId: userId,
      Resource: resource,
      Access: access
    };
    
    // add to or get from cache
    permissions = Caches.SetOrGet(PermissionsByUserTable.CacheKey, cacheId, permissions);
    
    // update the permissions immediately
    await this.UpdatePermissions(cacheId, permissions);
    
  }
  
  /** Remove all access by the specified user to the specified resource */
  public async RemoveAccess(userId: string, resource?: string): Promise<void> {
    
    // has the resource been specified?
    if(resource) {
      
      // split and validate the resource path
      let resourceSplit: string[] = resource.split('/');
      if(resourceSplit[0] === '') delete resourceSplit[0];
      if(resourceSplit[resourceSplit.length-1] === '') delete resourceSplit[resourceSplit.length-1];
      resource = resourceSplit.join('/');
      
      // remove the permissions from the cache
      Caches.Delete(PermissionsByUserTable.CacheKey, `${userId}::${resource}`);
      
      // delete the permissions from the db
      await this.Delete(
        [
          { spec: 'userid=?', param: userId },
          { spec: 'resource=?', param: resource }
        ]);
      
    } else {
      
      // get all permissions
      for(let permission of await this.GetAllPermissions(userId)) {
        
        // remove the permissions from the cache
        Caches.Delete(PermissionsByUserTable.CacheKey, `${userId}::${permission.Resource}`);
        
        // delete the permissions from the db
        await this.Delete([
            { spec: 'userid=?', param: userId },
            { spec: 'resource=?', param: permission.Resource }
          ]);
        
      }
      
    }
    
  }
  
  /** Get all access the specified user has */
  public async GetAllPermissions(userId: string): Promise<IPermissions[]> {
    
    // collection of permissions to return
    let permissions = Caches.GetAll<IPermissions>(PermissionsByUserTable.CacheKey).map(v => v.value);
    for(let i = permissions.length-1; i >= 0; --i) {
      if(permissions[i].UserId !== userId) permissions.RemoveAt(i);
    }
    
    // iterate rows
    for(let row of await this.Select('resource, access', [{ spec: 'userid=?', param: userId }])) {
      
      // check the permission hasn't been added already
      let found: boolean = false;
      for(let permission of permissions) {
        if(permission.Resource === row['resource']) {
          found = true;
          break;
        }
      }
      if(found) continue;
      
      // create from the row and add to the cache
      let permission: IPermissions = {
        UserId: userId,
        Resource: row['resource'],
        Access: row['access']
      };
      
      // add the permission entry to the cache
      permission = Caches.SetOrGet(PermissionsByUserTable.CacheKey, `${userId}::${permission.Resource}`, permission);
      
      // apppend the permission to the collection
      permissions.push(permission);
      
    }
    
    // return the complete collection
    return permissions;
    
  }
  
  //------------------------------------------//
  
  /** Evaluate a resource path suplementing the specified user attributes where required */
  private EvaluateResource(resource: string, user: IUser) {
    return Function('"use strict";return (function(user){return `' + resource + '`});')()(
      user
    );
  }
  
  /** On a permissions structure being removed from the 'permissions' cache collection */
  private UpdatePermissions = async (key: string, value: IPermissions): Promise<void> => {
    
    try {
      
      // update the permissions spec
      await this.Update(
        [
          { column: 'access', param: value.Access }
        ],
        [
          { spec: 'userid=?', param: value.UserId },
          { spec: 'resource=?', param: value.Resource }
        ]);
      
    } catch(error) {
      
      // log
      Log.Error(`Error updating permissions in the DB. ${error}`);
      
      if(Application.IsRunning && value) {
        // add the session back into the cache as a buffer
        Caches.SetOrGet(PermissionsByUserTable.CacheKey, `${value.UserId}::${value.Resource}`, value);
      }
      
    }
    
    
  }
  
}

/** Instance of the sessions by cookie table */
export const PermissionsByUser: PermissionsByUserTable = new PermissionsByUserTable();

