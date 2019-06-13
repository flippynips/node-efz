/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to user login management.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http, AccessType, IsNullOrEmpty, GetEnumValues, GetEnumIndex, GetEnumValue, nameof } from '../../Tools/Index';
import { IUser, Access, UserState, IPermissions, PermissionsByUser, UsersById, UsersByEmail } from '../../Data/Accounts/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { Resources, Server } from '../../Managers/Index';
import { Route } from '../Route';
import { WebErrorHandling, AuthorizePrivate, HandleAsyncErrors } from '../Middlewares/Index';

import '../../Tools/Index';
import { NetHelper, DataHelper } from '../Index';

/** Structure for users to be displayed */
interface IDisplayUser {
  
  //-----------------------//
  
  Email: string;
  TimeCreated: string;
  TimeLastSeen: string;
  State: string;
  
  //-----------------------//
  
}

DataHelper.Menu.Add({
  Name: 'Users',
  Path: '/users/list',
  Access: [Access(AccessType.Create, 'user')],
  Priority: 9
});

/** User list get */
const UserListGet: Route = {
  Path: '/users/list',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePrivate(AccessType.Create, 'user'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      let users: IDisplayUser[] = [];
      
      // get the collection of users
      for(let user of await UsersById.GetAllUsers()) {
        users.push({
          Email: user.Email,
          TimeCreated: new Date(user.TimeCreated * 1000).Format('DD/MM/YY HH:mm:ss'),
          TimeLastSeen: new Date(user.TimeLastSeen * 1000).Format('DD/MM/YY HH:mm:ss'),
          State: UserState[user.State]
        });
      }
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the dashboard page
      let page: string;
      
      try {
        page = await Resources.GetPage('Users/UserList.pug', {
          "title": 'Users',
          "datetime": new Date().toDateString(),
          "description": 'List of users.',
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await DataHelper.Menu.Get(req, res),
          "email": user.Email,
          "users": users,
          "canUpdateUsers": await PermissionsByUser.HasAccess(user.Id, AccessType.Update, 'user'),
          "canCreateUsers": await PermissionsByUser.HasAccess(user.Id, AccessType.Create, 'user')
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the users page. ${error}`,
          `There was a problem retrieving the users page.`));
        return;
      }
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/dashboard')
  ]
};

/** User get */
const UserGet: Route = {
  Path: '/user/:email',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePrivate(AccessType.Read, 'user/${req.params && req.params.email}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      
      // get the email
      let targetUserEmail: string = req.params && req.params.email || user.Email;
      
      // get the display user identity
      let targetUserId: string = await UsersByEmail.GetUserId(targetUserEmail);
      
      // was the user id retrieved?
      if(!targetUserId) {
        // no, error
        next(new RequestError(RequestErrorType.Validation,
          `Request to access non-existant user of email ${targetUserEmail} from ${NetHelper.GetEndPointString(req)}.`,
          `Permission denied`));
        return;
      }
      
      let targetUser: IUser;
      
      // does the target user match the logged in user?
      if(targetUserId === user.Id) {
        // yes, set the target user
        targetUser = user;
      } else {
        // yes, get the target user
        targetUser = await UsersById.GetUser(targetUserId);
      }
      
      // get all access types
      let accessTypes: { Name: string, Value: AccessType }[] = GetEnumValues(AccessType);
      // get all user states
      let userStates: { Name: string, Value: UserState }[] = GetEnumValues(UserState);
      
      // get the access available to the display user
      let displayPermissions: IPermissions[] = await PermissionsByUser.GetAllPermissions(targetUser.Id);
      
      // get the endpoint structure
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the dashboard page
      let page: string;
      try {
        page = await Resources.GetPage('Users/User.pug', {
          "title": 'User',
          "datetime": new Date().toDateString(),
          "description": `Edit user page.`,
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await DataHelper.Menu.Get(req, res),
          "email": user.Email,
          "displayUser": targetUser,
          "displayUserState": UserState[targetUser.State],
          "displayTimeCreated": new Date(targetUser.TimeCreated * 1000).Format('DD/MM/YY HH:mm:ss'),
          "displayTimeLastSeen": new Date(targetUser.TimeLastSeen * 1000).Format('DD/MM/YY HH:mm:ss'),
          "permissions": displayPermissions,
          "accessTypes": accessTypes,
          "userStates": userStates,
          "canUpdate": await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `user/${targetUserId}`),
          "canAdmin": await PermissionsByUser.HasAccess(user.Id, AccessType.Create, `user/${targetUserId}`)
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the user ${targetUser.Email} page. ${error}`,
          `There was a problem retrieving the user page.`));
        return;
      }
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/dashboard')
  ]
};

/** User update */
const UserUpdate: Route = {
  Path: '/user/:email/update',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'user/${req.params && req.params.email}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      
      // get the email
      let email: string = req.params && req.params.email || null;
      
      // validate the email
      if(!email) {
        next(new RequestError(RequestErrorType.Validation,
          `Missing 'email' parameter in update user request from ${NetHelper.GetEndPointString(req)}.`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the target user
      let targetUserId: string = await UsersByEmail.GetUserId(email) || null;
      // validate the target user
      if(!targetUserId) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid 'email' parameter in update user request from ${NetHelper.GetEndPointString(req)}.`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      let targetUser: IUser = await UsersById.GetUser(targetUserId);
      
      // get the endpoint structure
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      switch(req.body && req.body.action) {
        // Add permission
        case 'Add':
          
          // validate required access to the user
          if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Create, `user/${targetUserId}`)) {
            next(new RequestError(RequestErrorType.Validation,
              `Unauthorized access to update user from ${NetHelper.GetEndPointString(req)}.`,
              `Permission denied.`));
            return;
          }
          
          // get the details of the permission to be added
          let permissionResource: string = req.body && req.body.newPermissionResource;
          if(IsNullOrEmpty(permissionResource)) {
            next(new RequestError(RequestErrorType.Validation,
              `Invalid permission resource in add permission request from ${NetHelper.GetEndPointString(req)}.`,
              `We received invalid information from your browser. Please try again.`));
            return;
          }
          
          let accessStrs: string[] | string = req.body && req.body.newPermissionAccess;
          if(!accessStrs) {
            endPointStruct.errorStr = 'No access specified for new permission.';
            res.redirect(`/user/${targetUser.Email}`);
            return;
          }
          if(typeof accessStrs !== 'string' && !Array.isArray(accessStrs)) {
            next(new RequestError(RequestErrorType.Validation,
              `Invalid access parameter in add permission request from ${NetHelper.GetEndPointString(req)}.`,
              `We received invalid information from your browser. Please try again.`));
            return;
          }
          
          let access: AccessType[] = [];
          
          if(typeof accessStrs === 'string') {
            
            let accessType: AccessType = GetEnumValue(AccessType, accessStrs);
            if(!accessType) {
              next(new RequestError(RequestErrorType.Validation,
                `Invalid access type in add permission request from ${NetHelper.GetEndPointString(req)}.`,
                `We received invalid information from your browser. Please try again.`));
              return;
            }
            access.push(accessType);
            
          } else {
            
            if(accessStrs.length == 0) {
              next(new RequestError(RequestErrorType.Validation,
                `Invalid access parameter in add permission request from ${NetHelper.GetEndPointString(req)}.`,
                `No access specified for new permission. Please select at least one allowed access type.`));
              return;
            }
            
            // get the access types
            for(let accessStr of accessStrs) {
              let accessType: AccessType = GetEnumValue(AccessType, accessStr);
              if(!accessType) {
                next(new RequestError(RequestErrorType.Validation,
                  `Invalid access type in add permission request from ${NetHelper.GetEndPointString(req)}.`,
                  `We received invalid information from your browser. Please try again.`));
                return;
              }
              access.push(accessType);
            }
          }
          
          try {
            
            // add the permission
            await PermissionsByUser.SetAccess(targetUser.Id, permissionResource, access);
            
          } catch(error) {
            next(new RequestError(RequestErrorType.Server,
              `Error setting permission access for user ${targetUser.Id}. ${error}`,
              `There was a problem adding the specified permission. Please try again.`));
            return;
          }
          
          // set the info string
          endPointStruct.infoStr = `Permission added.`;
          
          break;
        case 'Update':
          
          // validate required access to the user
          if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `user/${targetUserId}`)) {
            next(new RequestError(RequestErrorType.Validation,
              `Unauthorized access to update user from ${NetHelper.GetEndPointString(req)}.`,
              `Permission denied.`));
            return;
          }
        
          // get the parameters of the update user request
          let state: number = GetEnumIndex(UserState, req.body && req.body.userState);
          if(state < 0) {
            next(new RequestError(RequestErrorType.Validation,
              `Missing 'state' parameter in update request from ${NetHelper.GetEndPointString(req)}`,
              `We received invalid information from your browser. Please try again.`));
            return;
          }
          
          // get the metadata json object
          let metadata: any;
          try {
            
            metadata = JSON.parse(req.body && req.body.userMetadata && req.body.userMetadata) || null;
            
          } catch(error) {
            
            next(new RequestError(RequestErrorType.Validation,
              `Invalid metadata parameter in user update request from ${NetHelper.GetEndPointString(req)}`,
              `We received invalid information from your browser. The metadata was invalid.`));
            return;
            
          }
          if(!metadata) {
            next(new RequestError(RequestErrorType.Validation,
              `Missing 'metadata' parameter in update request from ${NetHelper.GetEndPointString(req)}`,
              `We received invalid information from your browser. Please try again.`));
            return;
          }
          
          // get the existing user permissions
          let permissions: IPermissions[] = await PermissionsByUser.GetAllPermissions(targetUser.Id);
          for(let permission of permissions) {
            
            // get the access for the established permission
            let accessStrs: (string | string[]) = req.body[`access_${permission.Resource}`];
            
            // any access types specified?
            if(!accessStrs || accessStrs.length == 0) {
              
              // remove the permission
              await PermissionsByUser.RemoveAccess(targetUser.Id, permission.Resource);
              
            } else if(typeof accessStrs === 'string') {
              
              // update the access
              let access: AccessType[] = [];
              let accessType: AccessType = GetEnumValue(AccessType, accessStrs);
              if(!accessType) {
                next(new RequestError(RequestErrorType.Validation,
                  `Invalid access type in add permission request from ${NetHelper.GetEndPointString(req)}.`,
                  `We received invalid information from your browser. Please try again.`));
                return;
              }
              access.push(accessType);
              
              // update the permissions
              await PermissionsByUser.SetAccess(targetUser.Id, permission.Resource, access);
              
            } else {
              
              // update the access
              let access: AccessType[] = [];
              for(let accessStr of accessStrs) {
                let accessType: AccessType = GetEnumValue(AccessType, accessStr);
                if(!accessType) {
                  next(new RequestError(RequestErrorType.Validation,
                    `Invalid access type in add permission request from ${NetHelper.GetEndPointString(req)}.`,
                    `We received invalid information from your browser. Please try again.`));
                  return;
                }
                access.push(accessType);
              }
              
              // update the permissions
              await PermissionsByUser.SetAccess(targetUser.Id, permission.Resource, access);
              
            }
            
          }
          
          // update the user
          targetUser.State = state;
          targetUser.Metadata = metadata;
          await UsersById.UpdateUser(targetUser);
          
          // set the info string
          endPointStruct.infoStr = `User '${targetUser.Email}' updated.`;
          
          break;
        case 'Delete':
          
          // validate required access to the user
          if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `user/${targetUserId}`)) {
            next(new RequestError(RequestErrorType.Validation,
              `Unauthorized access to update user from ${NetHelper.GetEndPointString(req)}.`,
              `Permission denied.`));
            return;
          }
          
          // remove the user from relevant tables
          
          try {
            await UsersByEmail.RemoveUser(targetUser.Email);
          } catch(error) {
            next(new RequestError(RequestErrorType.Server,
              `Error removing user ${targetUser.Email} from ${nameof(UsersByEmail)} table. ${error}`,
              `There was a problem removing the user.`,
              `user/${targetUser.Email}`));
            return;
          }
          try {
            await UsersById.RemoveUser(targetUser);
          } catch(error) {
            next(new RequestError(RequestErrorType.Server,
              `Error removing user ${targetUser.Email} from ${nameof(UsersById)} table. User was succcessfully removed from ${nameof(UsersByEmail)}. ${error}`,
              `There was a problem removing the user.`,
              `user/${targetUser.Email}`));
            return;
          }
          try {
            await PermissionsByUser.RemoveAccess(targetUser.Id);
          } catch(error) {
            next(new RequestError(RequestErrorType.Server,
              `Error removing user ${targetUser.Email} permissions from ${nameof(PermissionsByUser)} table. ${error}`,
              `There was a slight problem clearing the users permissions.`,
              `/users/list`));
            return;
          }
          
          // set the info string
          endPointStruct.infoStr = `User with email '${targetUser.Email}' removed`;
          
          // redirect to the user list
          res.redirect(`/users/list`);
          
          return;
        default:
          next(new RequestError(RequestErrorType.Validation,
            `Invalid 'email' parameter in update user request from ${NetHelper.GetEndPointString(req)}.`,
            `We received invalid information from your browser. Please try again.`,
            `/login`));
          return;
      }
      
      // redirect to the target users page
      res.redirect(`/user/${targetUser.Email}`);
      
    }),
    WebErrorHandling(`/dashboard`)
  ]
};

/** Get the user create page */
const UserCreateGet: Route = {
  Path: '/users/create',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePrivate(AccessType.Create, 'user'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      
      // get all user states
      let userStates: { Name: string, Value: UserState }[] = GetEnumValues(UserState);
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the dashboard page
      let page: string;
      
      try {
        page = await Resources.GetPage('Users/UserCreate.pug', {
          "title": 'Create User',
          "datetime": new Date().toDateString(),
          "description": 'Create a new user.',
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await DataHelper.Menu.Get(req, res),
          "email": user.Email,
          "userStates": userStates
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the users page. ${error}`,
          `There was a problem retrieving the users page.`));
        return;
      }
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/users/list')
  ]
};

/** User create post */
const UserCreatePost: Route = {
  Path: '/users/create',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePrivate(AccessType.Create, 'user'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      let email: string;
      
      try {
        
        // clear the end point struct strings
        let endPointStruct: any = Server.GetEndPointStruct(req);
        
        // get the user parameters
        email = req.body && req.body.userEmail || null;
        let password: string = req.body && req.body.userPassword || null;
        let stateStr: string = req.body && req.body.userState || null;
        let requirePasswordChange: boolean = req.body && req.body.userRequirePasswordChange || false;
        let setStandardPermissions: boolean = req.body && req.body.userSetStandardPermissions || false;
        let setAdminPermissions: boolean = req.body && req.body.userSetAdminPermissions || false;
        let metadataStr: string = req.body && req.body.userMetadata || null;
        if(IsNullOrEmpty(metadataStr)) metadataStr = '{}';
        let metadata: any;
        try {
          metadata = JSON.parse(metadataStr);
        } catch(error) {
          next(new RequestError(RequestErrorType.Validation,
            `Error parsing metadata in create new user request from ${NetHelper.GetEndPointString(req)}. ${error}`,
            `Invalid metadata JSON.`));
          return;
        }
        
        let stateIndex = GetEnumIndex(UserState, stateStr);
        if(stateIndex < 0) {
          next(new RequestError(RequestErrorType.Validation,
            `Missing user state in create new user request from ${NetHelper.GetEndPointString(req)}.`,
            `We received invalid information from your browser.`));
          return;
        }
        
        // validate the user doesn't already exist
        if(await UsersByEmail.GetUserId(email)) {
          // the user already exists
          next(new RequestError(RequestErrorType.Validation,
            `Duplicate user email ${email} detected during create user request from ${NetHelper.GetEndPointString(req)}.`,
            `User already registered for email ${email}.`));
          return;
        }
        
        // add the password change metadata
        if(requirePasswordChange) metadata.RequirePasswordChange = true;
        
        // create the user
        let newUser: IUser = await UsersById.CreateUser(email, metadata);
        await UsersByEmail.AddUser(email, password, newUser.Id);
        
        newUser.State = stateIndex;
        
        if(setStandardPermissions) await PermissionsByUser.AddStandardAccess(newUser);
        if(setAdminPermissions) await PermissionsByUser.AddAdminAccess(newUser);
        
        endPointStruct.infoStr = `User ${newUser.Email} created.`;
        
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `An error occured creating user ${email}. ${error}`,
          `There was a problem creating the user.`));
        return;
      }
      
      // redirect to the user list
      res.redirect('/users/list');
      
    }),
    WebErrorHandling('/users/list')
  ]
};

/** Get the user change password page */
const UserChangePasswordGet: Route = {
  Path: '/user/:email/change_password',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'user/${req.params && req.params.email}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      
      // get the target users email
      let targetUserEmail: string = req.params && req.params.email;
      if(!targetUserEmail) {
        next(new RequestError(RequestErrorType.Validation,
          `Missing email parameter in change password request from ${NetHelper.GetEndPointString(req)}.`,
          `Missing email parameter.`));
        return;
      }
      
      let targetUser: IUser;
      if(targetUserEmail === user.Email) {
        targetUser = user;
      } else {
        
        // get the target user
        let targetUserId: string = await UsersByEmail.GetUserId(targetUserEmail);
        if(!targetUserId) {
          next(new RequestError(RequestErrorType.Validation,
            `Target user of email ${targetUserEmail} doesn't exist for change password request from ${NetHelper.GetEndPointString(req)}.`,
            `Permission denied.`));
          return;
        }
        
        targetUser = await UsersById.GetUser(targetUserId);
        
        // get the user
        if(!targetUser) {
          next(new RequestError(RequestErrorType.Validation,
            `User of id ${targetUserId} and email ${targetUserEmail} missing for change password request from ${NetHelper.GetEndPointString(req)}.`,
            `Permission denied.`));
          return;
        }
        
      }
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the dashboard page
      let page: string;
      
      try {
        page = await Resources.GetPage('Users/UserChangePassword.pug', {
          "title": 'Change Password',
          "datetime": new Date().toDateString(),
          "description": user.Id === targetUser.Id ?
            `Change your password.` :
            `Change password for ${targetUser.Email}.`,
          "errorStr": endPointStruct.errorStr,
          "infoStr": endPointStruct.infoStr,
          "menu": await DataHelper.Menu.Get(req, res),
          "password_regex": /[A-Za-z0-9@$!%*?&# ()+=_\/\\-]{6,30}/,
          "email": user.Email,
          "targetUser": targetUser
        });
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `There was an error retrieving the change password page. ${error}`,
          `There was a problem retrieving the change password page.`));
        return;
      }
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/dashboard')
  ]
};


/** Perform the user change password routine */
const UserChangePasswordPost: Route = {
  Path: '/user/:email/change_password',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'user/${req.params && req.params.email}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the current user
      let user: IUser = res.locals.User;
      
      // get the target users email
      let targetUserEmail: string = req.params && req.params.email;
      if(!targetUserEmail) {
        next(new RequestError(RequestErrorType.Validation,
          `Missing email parameter in change password request from ${NetHelper.GetEndPointString(req)}.`,
          `Missing email parameter.`));
        return;
      }
      
      let targetUser: IUser;
      if(targetUserEmail === user.Email) {
        targetUser = user;
      } else {
        
        // get the target user
        let targetUserId: string = await UsersByEmail.GetUserId(targetUserEmail);
        if(!targetUserId) {
          next(new RequestError(RequestErrorType.Validation,
            `Target user of email ${targetUserEmail} doesn't exist for change password request from ${NetHelper.GetEndPointString(req)}.`,
            `Permission denied.`));
          return;
        }
        
        targetUser = await UsersById.GetUser(targetUserId);
        
        // get the user
        if(!targetUser) {
          next(new RequestError(RequestErrorType.Validation,
            `User of id ${targetUserId} and email ${targetUserEmail} missing for change password request from ${NetHelper.GetEndPointString(req)}.`,
            `Permission denied.`));
          return;
        }
        
      }
      
      // clear the end point struct strings
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the password parameters
      let password1: string = req.body && req.body.password_1;
      let password2: string = req.body && req.body.password_2;
      
      // validate the passwords
      if(typeof password1 !== 'string' ||
         typeof password2 !== 'string' ||
         !/[A-Za-z0-9@$!%*?&# ()+=_\/\\-]{6,30}/.test(password1)) {
        // invalid form data
        next(new RequestError(RequestErrorType.Validation,
          `Invalid form submission from ${NetHelper.GetEndPointString(req)}`,
          'We received invalid information from your browser. Please try again.'));
        return;
      }
      
      // check the passwords match
      if(password1 !== password2) {
        endPointStruct.errorStr = 'The passwords you entered did not match.';
        res.redirect(`/users/${targetUserEmail}`);
        return;
      }
      
      // update the password
      await UsersByEmail.UpdateUserPassword(targetUser.Email, password1);
      
      // was a password change requirement fullfilled?
      if(targetUser.Metadata && targetUser.Metadata.RequirePasswordChange) {
        delete targetUser.Metadata.RequirePasswordChange;
      }
      
      // set the info string
      endPointStruct.infoStr = `Password changed.`;
      
      // redirect to the users page
      res.redirect(`/user/${targetUser.Email}`);
      
    }),
    WebErrorHandling('/dashboard')
  ]
};

/** Collection of 'users' routes */
export const Users: Route[] = [
  UserListGet,
  UserGet,
  UserUpdate,
  UserCreateGet,
  UserCreatePost,
  UserChangePasswordGet,
  UserChangePasswordPost
];
