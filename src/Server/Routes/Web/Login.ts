/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to logging in and out of the web
 *  application.
 * Revision History: None
 ******************************************************/

import * as express from 'express';

import { Http, AccessType, IsNullOrEmpty, TimeoutController } from '../../Tools/Index';
import { ISession, IUser, UserState, Access } from '../../Data/Accounts/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { Route } from '../Route';
import { Log, Email, Resources, Server, Crypto, Time, Application } from '../../Managers/Index';
import { AuthorizePublic, WebErrorHandling, AuthorizePrivate, HandleAsyncErrors } from '../Middlewares/Index';
import { SessionsByCookie, UsersByEmail, UsersById, PermissionsByUser } from '../../Data/Accounts/Index';
import { NetHelper, DataHelper } from '../Index';

DataHelper.Menu.Add({
  Name: 'Login',
  Path: '/login',
  Predicate: (req, res): boolean => { return !res.locals || !res.locals.User; },
  Priority: -1
});

/** Get the login page */
const LoginPageGet: Route = {
  Path: '/login',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the endpoint struct if created
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      let page = await Resources.GetPage('Login/Login.pug', {
        "title": 'Log In',
        "datetime": new Date().toDateString(),
        "description": 'Log in to access your dashboard.',
        "menu": await DataHelper.Menu.Get(req, res),
        "errorStr": endPointStruct.errorStr,
        "infoStr": endPointStruct.infoStr
      });
      
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Login form submission */
const LoginPost: Route = {
  Path: '/login',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the session
      let session: ISession = res.locals.Session;
      
      // is there a request body?
      if(req.body == null) {
        // no, invalid
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during login request from ${NetHelper.GetEndPointString(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the form parameters
      let email: string = ''+req.body["email"];
      let password: string = ''+req.body["password"];
      
      // check types
      if(IsNullOrEmpty(email) ||
         IsNullOrEmpty(password)) {
        
        // invalid form data
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during login request from ${NetHelper.GetEndPointString(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
        
      }
      
      // validate the username and password
      let userId: string;
      let user: IUser;
      try {
        
        userId = await UsersByEmail.Validate(email, password);
        
        if(userId == null) {
          // get the login attempts
          let loginAttempts: number = session.Metadata && session.Metadata.login_attempts;
          
          // validate the retries
          if(loginAttempts == null || typeof loginAttempts !== 'number') loginAttempts = 0;
          
          if(++loginAttempts > Server.Configuration.LoginAttemptLimit) {
            next(new RequestError(RequestErrorType.Authentication,
              `Too many login attempts from ${NetHelper.GetEndPointString(req)}.`,
              `Too many login attempts.`));
            return;
          }
          
          session.Metadata.login_attempts = loginAttempts;
          next(new RequestError(RequestErrorType.Authentication,
            `Invalid email and password.`,
            `Incorrect email or password.`));
          return;
        }
        
        user = await UsersById.GetUser(userId);
        
        if(user == null) {
          next(new RequestError(RequestErrorType.Validation,
            `User '${email} : ${password}' doesn't exist.`,
            `There was a problem validating your account.`));
          return;
        }
        
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Validating the user '${email} : ${password}' caused an error. ${error}`,
          `There was a problem validating your account.`));
        return;
      }
      // get the user
      switch(user.State) {
        case UserState.Active:
          // all good
          
          // reset the login attempt count
          if(session.Metadata.login_attempts) session.Metadata.login_attempts = 0;
          // set the user id
          session.UserId = user.Id;
          
          // update the session
          SessionsByCookie.SetSession(session);
          
          break;
        case UserState.Pending:
          next(new RequestError(RequestErrorType.Authentication,
            `Attempted pending account access '${email}'.`,
            'Your email address has not yet been confirmed.'));
          return;
        case UserState.Disabled:
          next(new RequestError(RequestErrorType.Authentication,
            `Attempted disabled account access '${email}'.`,
            'Your account has been disabled.'));
          return;
        case UserState.Suspended:
          next(new RequestError(RequestErrorType.Authentication,
            `Attempted pending account access '${email}'.`,
            'Your account has been suspended.'));
          return;
      }
      
      // does the user need to change their password?
      if(user.Metadata && user.Metadata.RequirePasswordChange) {
        // redirect to the change password page
        let endPointStruct: any = Server.GetEndPointStruct(req);
        endPointStruct.infoStr = `Password change required.`;
        res.redirect(`/user/${user.Email}/change_password`);
        return;
      }
      
      // go to the dashboard
      res.redirect('/dashboard');
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Get the create login page */
const LoginCreatePageGet: Route = {
  Path: '/login/create',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the error string if set
      var endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the login creation page
      let page = await Resources.GetPage('Login/LoginCreate.pug', {
        "title": 'Create Log In',
        "datetime": new Date().toDateString(),
        "description": 'Create a new log in account.',
        "errorStr": endPointStruct.errorStr,
        "infoStr": endPointStruct.infoStr,
        "menu": await DataHelper.Menu.Get(req, res),
        "password_regex": DataHelper.PasswordRegex,
        "code": req.query['code'] == Server.Configuration.AdminCode ? Server.Configuration.AdminCode : null
      });
      
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/login/create')
  ]
};

/** Login create form submission */
const LoginCreatePost: Route = {
  Path: '/login/create',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the session
      let session: ISession = res.locals.Session;
      // was the session retrieved?
      if(session == null) {
        // no, return
        next(new RequestError(RequestErrorType.Authentication, 'No session found for login request.', 'Please enable cookies.'));
        return;
      }
      
      // is there a request body?
      if(req.body == null) {
        // no, invalid
        next(new RequestError(RequestErrorType.Validation, `Invalid form submission from ${NetHelper.GetEndPointString(req)}`, 'We received invalid information from your browser. Please try again.'));
        return;
      }
      
      // get the form parameters
      let email: string = req.body && req.body.email;
      let password1: string = req.body && req.body.password_1;
      let password2: string = req.body && req.body.password_2;
      
      // check types and test regex
      if(email == null ||
         password1 == null ||
         password2 == null ||
         typeof email !== 'string' ||
         typeof password1 !== 'string' ||
         typeof password2 !== 'string'||
         !/[A-Za-z0-9@$!%*?&# ()+=_\/\\-]{6,30}/.test(password1)) {
        
        // invalid form data
        next(new RequestError(RequestErrorType.Validation,
          `Invalid form submission from ${NetHelper.GetEndPointString(req)}`,
          'We received invalid information from your browser. Please try again.'));
        return;
        
      }
      
      // validate the passwords
      if(password1 !== password2) {
        next(new RequestError(RequestErrorType.Validation,
          `Caught password mismatch from ${NetHelper.GetEndPointString(req)}.`,
          'The passwords you entered did not match.'));
        return;
      }
      
      // create the user
      let user: IUser;
      try {
        if(await UsersByEmail.GetUserId(email)) {
          next(new RequestError(RequestErrorType.Validation,
            `Duplicate email registration attempt by ${NetHelper.GetEndPointString(req)}.`,
            `An account is already registered to email address '${email}'.`))
          return;
        }
        user = await UsersById.CreateUser(email);
        UsersByEmail.AddUser(email, password1, user.Id);
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Error creating user '${email}' for '${NetHelper.GetEndPointString(req)}'. ${error}`,
          'There was a problem creating your account.'));
        return;
      }
      
      // set the session user id
      session.UserId = user.Id;
      SessionsByCookie.SetSession(session);
      
      // test whether the admin code has been received
      if(req.query['code'] == Server.Configuration.AdminCode) {
        
        // activate the user
        user.State = UserState.Active;
        
        await PermissionsByUser.AddStandardAccess(user);
        await PermissionsByUser.AddAdminAccess(user);
        
        // redirect to the dashboard
        res.redirect('/dashboard');
        
        return;
      }
      
      let endPointStruct: any = Server.GetEndPointStruct(req);
      endPointStruct.infoStr = `Your login request has been submitted. Please await further instructions from ${email}.`;
      
      res.redirect('/login');
      
      // get the user id encrypted user id
      let encryptedUserId: string = Crypto.EncryptWithPassword(user.Id, Server.Configuration.CookieEncryptionPassword, "hex");
      
      // get the verify email page html
      let confirmEmailHtml = await Resources.GetPage('Emails/ConfirmEmailAddress.pug', {
        "application_name": Application.Name,
        "email": email,
        "confirmation_url": `${Server.GetWebHost()}/login/confirmation?user=${encryptedUserId}`
      });
      
      // send confirmation email
      try {
        await Email.Send({
          from: 'noreply@tattsgroup.com',
          to: email,
          subject: `${Application.Name} - Email Address Confirmation`,
          html: confirmEmailHtml
        });
      } catch(error) {
        Log.Warning(`There was an error sending an email to ${email} for ${NetHelper.GetEndPointString(req)}. ${error}`);
      }
      
    }),
    WebErrorHandling('/login/create')
  ]
};

/** Get the confirm login page */
const LoginConfirmationPageGet: Route = {
  Path: '/login/confirmation',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the session
      let session: ISession = res.locals.Session;
      // was the session retrieved?
      if(session == null) {
        // no, return
        next(new RequestError(RequestErrorType.Authentication,
          `No session found for login confirmation from ${NetHelper.GetEndPointString(req)}.`,
          'Please enable cookies.'));
        return;
      }
      
      // get the encrypted user id
      let userId: string = req.query['user'];
      
      if(!userId) {
        next(new RequestError(RequestErrorType.Validation,
          `Missing user id confirmation from ${NetHelper.GetEndPointString(req)}`,
          `We received invalid information from your browser.`));
        return;
      }
      
      try {
        // decrypt the user id
        userId = Crypto.DecryptWithPassword(userId, Server.Configuration.CookieEncryptionPassword, 'hex');
      } catch(error) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid confirmation user id received from ${NetHelper.GetEndPointString(req)}.`,
          `We received invalid information from your browser.`));
        return;
      }
      
      // get the user
      let user: IUser;
      try {
        user = await UsersById.GetUser(userId);
      } catch(error) {
        next(new RequestError(RequestErrorType.Validation,
          `No user matching confirmation id ${userId}.`,
          `We received invalid information from your browser.`));
        return;
      }
      
      if(user == null) {
        next(new RequestError(RequestErrorType.Validation,
          `No user matching confirmation id ${userId}.`,
          `We received invalid information from your browser.`));
        return;
      }
      
      // validate the user state
      switch(user.State) {
        case UserState.Pending:
          // set default user access
          user.State = UserState.Active;
          await PermissionsByUser.AddStandardAccess(user);
          break;
        case UserState.Active:
          next(new RequestError(RequestErrorType.Validation,
            `User already confirmed ${userId}.`,
            `Your login has already confirmed.`));
          return;
        default:
          next(new RequestError(RequestErrorType.Validation,
            `No user matching confirmation id ${userId}.`,
            `We received invalid information from your browser.`));
          return;
      }
      
      // get the endpoint struct
      let endPointStruct: any = Server.GetEndPointStruct(req);
      endPointStruct.infoStr = `Your login has been confirmed!`;
      
      // set the sessions user id
      session.UserId = user.Id;
      SessionsByCookie.SetSession(session);
      
      // redirect to the dashboard
      res.redirect('/dashboard');
      
    }),
    WebErrorHandling('/login')
  ]
};

DataHelper.Menu.Add({
  Name: 'Log Out',
  Path: '/logout',
  Predicate: (req, res) => { return res.locals && res.locals.User; },
  Priority: -1
});

/** Log the current user out, this creates a new session */
const LogOutGet: Route = {
  Path: '/logout',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePrivate(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // is the user logged in?
      if(!res.locals || !res.locals.Session || !res.locals.User) {
        // yes, redirect to the login page
        res.redirect('/login');
        return;
      }
      
      // remove the session cookie
      res.clearCookie(Server.Configuration.SessionCookieName);
      
      // get the endpoint struct if created
      let endPointStruct: any = Server.GetEndPointStruct(req);
      endPointStruct.infoStr = 'Logged out.';
      
      // redirect to the login page
      res.redirect('/login');
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Log the current user out, this creates a new session */
const LoginResetPasswordGet: Route = {
  Path: '/login/reset_password',
  Method: Http.Method.Get,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the end point string
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the change password page
      let page = await Resources.GetPage('Login/LoginResetPassword.pug', {
        "title": 'Reset Password',
        "datetime": new Date().toDateString(),
        "description": 'Enter your Email address to reset your password.',
        "menu": await DataHelper.Menu.Get(req, res),
        "errorStr": endPointStruct.errorStr,
        "infoStr": endPointStruct.infoStr
      });
      
      // send the page
      res.set('Content-Type', 'text/html');
      res.send(page);
      
      // clear end point strings
      delete endPointStruct.errorStr;
      delete endPointStruct.infoStr;
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Log the current user out, this creates a new session */
const LoginResetPasswordPost: Route = {
  Path: '/login/reset_password',
  Method: Http.Method.Post,
  Effects: [
    AuthorizePublic(AccessType.Read, 'public/page'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      
      // get the endpoint structure
      let endPointStruct: any = Server.GetEndPointStruct(req);
      
      // get the email
      let email: string = '' + req.body && req.body.email;
      
      // was the email retrieved?
      if(IsNullOrEmpty(email)) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid email entered in reset password request from ${NetHelper.GetEndPointString(req)}.`,
          `Invalid email entered.`));
        return;
      }
      
      // does the email exist?
      let userId: string = await UsersByEmail.GetUserId(email);
      let user: IUser = await UsersById.GetUser(userId);
      if(!user) {
        endPointStruct.infoStr = 'If the Email is registered, an Email will be sent containing instructions for resetting your password.';
        res.redirect('/login');
        return;
      }
      
      // was a previous reset email sent in the last 30 seconds?
      if(user.Metadata && user.Metadata.PasswordResetEmailSent && Time.Now - user.Metadata.PasswordResetEmailSent < 30) {
        // yes, don't send again
        endPointStruct.infoStr = 'If the Email is registered, an Email will be sent containing instructions for resetting your password.';
        res.redirect('/login');
        return;
      }
      
      // set the user metadata flagging the user
      user.Metadata.PasswordResetEmailSent = user.TimeLastSeen;
      
      // get the user id encrypted user id
      let encryptedUserId: string = Crypto.EncryptWithPassword(user.Id, Server.Configuration.CookieEncryptionPassword, "hex");
      
      // get the verify email page html
      let resetPasswordEmailHtml: string = await Resources.GetPage('Emails/ConfirmEmailAddress.pug', {
        "application_name": Application.Name,
        "email": email,
        "confirmation_url": `${Server.GetWebHost()}/login/reset_password?user=${encryptedUserId}`
      });
      
      // send confirmation email
      try {
        await Email.Send({
          from: 'noreply@tattsgroup.com',
          to: email,
          subject: `${Application.Name} - Email Address Confirmation`,
          html: resetPasswordEmailHtml
        });
      } catch(error) {
        Log.Warning(`There was an error sending an email to ${email} for ${NetHelper.GetEndPointString(req)}. ${error}`);
      }
      
      // get the endpoint struct if created
      endPointStruct.infoStr = 'Reset password email sent.';
      
      // redirect to the login page
      res.redirect('/login');
      
    }),
    WebErrorHandling('/login')
  ]
};

/** Collection of 'login' routes */
export const Login: Route[] = [
  LoginPageGet,
  LoginPost,
  LoginCreatePageGet,
  LoginCreatePost,
  LoginConfirmationPageGet,
  LogOutGet,
];
