/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Routes related to managing content via the web-interface.
 * Revision History: None
 ******************************************************/

import * as express from 'express';
import * as multer from 'multer';
import * as uuid from 'uuid';

import { IUser, Access } from '../../Data/Accounts/Index';
import { RequestError, RequestErrorType } from '../../Tools/Errors/Index';
import { HttpMethod, AccessType, IsNullOrEmpty } from '../../Tools/Index';
import { IRoute } from '../IRoute';
import { Resources, Server, Log } from '../../Managers/Index';
import { WebErrorHandling, AuthorizePrivate, HandleAsyncErrors } from '../Middlewares/Index';
import { IBlob, BlobStream, Blobs } from '../../Data/BlobStores/Index';
import { PermissionsByUser, UsersById } from '../../Data/Accounts/Index';
import { Dictionary } from 'lodash';

import '../../Tools/Index';

/** Multer instance used for file uploads */
const Multer: multer.Instance = multer({ storage: multer.memoryStorage() });

/** Content metadata structure saved to user metadata */
interface IContent {
  
  //------------------------//
  
  /** Name of the content */
  Name: string;
  /** Latest version of the content */
  Version: number;
  
  //------------------------//
  
}

/** Content metadata structure for display */
interface IDisplayContent {
  
  //------------------------//
  
  Name: string;
  Version: number;
  IsLatest: boolean;
  CanUpdate: boolean;
  CanDelete: boolean;
  Token: string;
  
  //------------------------//
  
}

/** Get the content page */
const ContentListGet: IRoute = {
  Path: '/content',
  Method: HttpMethod.Get,
  MenuItem: {
    Name: 'Content',
    Access: [Access(AccessType.Read, 'content')],
    Priority: 8
  },
  Effects: [
    AuthorizePrivate(AccessType.Read, 'content'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the user
      let user: IUser = res.locals.User;
      // get the users content
      let userContent: IContent[] = user.Metadata && user.Metadata.Content || null;
      if(!userContent) user.Metadata.Content = userContent = [];
      
      // collection of content to display
      let displayContent: IDisplayContent[] = [];
      let latestVersions: Dictionary<IDisplayContent> = {};
      
      // validate the content the user can view
      for(let i = userContent.length-1; i >= 0; --i) {
        try {
          
          // check the content still exists
          let blob: IBlob = await Blobs.GetBlob(`content:${userContent[i].Name}`, userContent[i].Version);
          if(!blob) {
            await PermissionsByUser.RemoveAccess(user.Id, `content/${userContent[i].Name}`);
            userContent.RemoveAt(i);
            continue;
          }
          
          // check at least read access to the content
          if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Read, `content/${userContent[i].Name}`)) {
            userContent.RemoveAt(i);
            continue;
          }
          
          // append to display content
          let content: IDisplayContent = {
            Name: userContent[i].Name,
            Version: userContent[i].Version,
            IsLatest: false,
            CanUpdate: await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `content/${userContent[i].Name}`),
            CanDelete: await PermissionsByUser.HasAccess(user.Id, AccessType.Delete, `content/${userContent[i].Name}`),
            Token: blob.Metadata && blob.Metadata.Token
          };
          
          displayContent.push(content);
          
          // update the latest version
          if(!latestVersions[userContent[i].Name] || latestVersions[userContent[i].Name].Version < userContent[i].Version) {
            if(latestVersions[userContent[i].Name]) latestVersions[userContent[i].Name].IsLatest = false;
            latestVersions[userContent[i].Name] = content;
            content.IsLatest = true;
          }
          
        } catch(error) {
          Log.Error(`There was an error validating content with user ${user.Id}.`);
          userContent = [];
          break;
        }
      }
      
      // sort the content by name
      displayContent.sort((a, b): number => { return a.Name.localeCompare(b.Name); });
      
      // get the endpoint struct if created
      let endPointStruct: any = Server.GetEndpointStruct(req);
      
      // get the content list page
      let page: string = await Resources.GetPage('Content/ContentList.pug', {
        'title': 'Content',
        'datetime': new Date().toDateString(),
        'description': 'Collection of content that can be accessed remotely.',
        'infoStr': endPointStruct.infoStr,
        'errorStr': endPointStruct.errorStr,
        'menu': await Server.GetMenu(req, res),
        'displayContent': displayContent,
        'contentNameRegex': Server.Configuration.ContentNameRegexStr,
        'canCreateContent': await PermissionsByUser.HasAccess(user.Id, AccessType.Create, 'content')
      });
      
      // send the dashboard
      res.set('Content-Type', 'text/html');
      res.send(page);
      
    }, `There was an error retrieving the dashboard.`),
    WebErrorHandling('/dashboard')
  ]
}

/** Post a new content item */
const ContentAddPost: IRoute = {
  Path: '/content/add',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Create, 'content'),
    Multer.single('content'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the user
      let user: IUser = res.locals.User;
      
      // check the user permissions
      if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Create, `content`)) {
        next(new RequestError(RequestErrorType.Validation,
          `Unauthorized access to add content from ${Server.GetIpEndPoint(req)}`,
          `Insufficient permissions to add content.`));
        return;
      }
      
      // get the request content
      let name: string = req.body && req.body.name && req.body.name.trim() || null;
      let buffer: Buffer = req.file && req.file.buffer || null;
      let version: number = req.body && req.body.version && parseInt(req.body.version);
      
      // have the parameters been specified?
      if(IsNullOrEmpty(name) || !buffer || isNaN(version) || version < 0 || buffer.length == 0 || !Server.ContentNameRegex.test(name)) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during add content request from ${Server.GetIpEndPoint(req)}`, 
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // check the name and version hasn't been used
      
      // get the collection of content managed by this user
      let userContent: IContent[] = user.Metadata && user.Metadata.Content;
      if(!userContent) userContent = user.Metadata.Content = userContent = [];
      
      for(let content of userContent) {
        if(content.Name === name) {
          next(new RequestError(RequestErrorType.Validation,
            `Duplicate content name and version ${name} v${version}.`,
            `The content name ${name} is already in use.`));
          return;
        }
      }
      
      // get the blobs of the specified name
      let blob: IBlob[] = await Blobs.GetBlobs(`content:${name}`);
      
      // was the blob retrieved?
      if(blob && blob.length > 0) {
        // yes, the blob already exists
        next(new RequestError(RequestErrorType.Validation,
          `Duplicate content name and version ${name} v${version}.`,
          `The content name ${name} is already in use.`));
        return;
      }
      
      // write the buffer to the blob
      try {
        let stream: BlobStream = await Blobs.GetStream(`content:${name}`, version);
        if(!stream.write(buffer)) {
          next(new RequestError(RequestErrorType.Server,
            `An error occurred uploading buffer to content ${name} v${version}`,
            `There was a problem uploading the content.`));
          return;
        }
        stream.end();
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `An error occurred uploading buffer to content ${name} v${version}. ${error}`,
          `There was a problem uploading the content.`));
        return;
      }
      
      // add the content to the user
      userContent.push({
        Name: name,
        Version: version
      });
      
      // ensure the user has been updated
      await UsersById.UpdateUser(user);
      
      // add permissions for the user
      await PermissionsByUser.SetAccess(user.Id, `content/${name}`, [
        AccessType.Read,
        AccessType.Update,
        AccessType.Delete
      ]);
      
      // get the endpoint struct if created
      let endPointStruct: any = Server.GetEndpointStruct(req);
      endPointStruct.infoStr = `Content ${name} v${version} added.`;
      
      // redirect to the content list page
      res.redirect('/content');
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Update an existing content item */
const ContentUpdatePost: IRoute = {
  Path: '/content/update',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'content/${req.query && req.query.name}'),
    Multer.single('content'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // get the request content
      let name: string = req.query && req.query.name || null;
      let buffer: Buffer = req.file && req.file.buffer || null;
      let version: number = req.body && req.body.version && parseInt(req.body.version);
      
      // have the parameters been specified?
      if(!name || !buffer || isNaN(version) || version < 0 || buffer.length == 0 || !Server.ContentNameRegex.test(name)) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during add content request from ${Server.GetIpEndPoint(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the user
      let user: IUser = res.locals.User;
      
      // get the collection of content managed by this user
      let userContent: IContent[] = user.Metadata && user.Metadata.Content;
      if(!userContent) userContent = user.Metadata.Content = userContent = [];
      
      for(let content of userContent) {
        if(content.Name === name && content.Version === version) {
          next(new RequestError(RequestErrorType.Validation,
            `Duplicate content name and version ${name} v${version}.`,
            `The content ${name} v${version} is already in use.`));
          return;
        }
      }
      
      let previousBlob: IBlob;
      try {
        // get the blob of the specified name
        let blobs: IBlob[] = await Blobs.GetBlobs(`content:${name}`);
        
        // iterate and get the latest blob
        for(let blob of blobs) {
          // does the blob match the version to be added?
          if(blob.Version === version) {
            // yes, the blob already exists
            next(new RequestError(RequestErrorType.Validation,
              `Duplicate content name and version ${name} v${version}.`,
              `The content ${name} v${version} already exists.`));
            return;
          }
          if(!previousBlob || blob.Version > previousBlob.Version) {
            previousBlob = blob;
          }
        }
        
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `An error occurred retrieving existing blob ${name} v${version}`,
          `There was a problem validating the updated content.`));
        return;
      }
      
      // write the buffer to the blob
      let newBlob: IBlob;
      try {
        let stream: BlobStream = await Blobs.GetStream(`content:${name}`, version);
        newBlob = stream.Blob;
        if(!stream.write(buffer)) {
          next(new RequestError(RequestErrorType.Server,
            `An error occurred uploading buffer to content ${name} v${version}`,
            `There was a problem uploading the content.`));
          return;
        }
        stream.end();
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `An error occurred uploading buffer to content ${name} v${version}. ${error}`,
          `There was a problem uploading the content.`));
        return;
      }
      
      // was there a previous blob with a token?
      if(previousBlob && previousBlob.Metadata && previousBlob.Metadata.Token) {
        // yes, duplicate the previous blobs token
        newBlob.Metadata.Token = previousBlob.Metadata.Token;
      }
      
      // add the content to the user
      userContent.push({
        Name: name,
        Version: version
      });
      await UsersById.UpdateUser(user);
      
      // get the endpoint struct if created
      let endPointStruct: any = Server.GetEndpointStruct(req);
      endPointStruct.infoStr = `Content ${name} updated to version ${version}.`;
      
      // redirect to the content list page
      res.redirect('/content');
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Remove an existing content item */
const ContentRemovePost: IRoute = {
  Path: '/content/remove',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Delete, 'content/${req.query && req.query.name}'),
    Multer.single('content'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // validate the name and version parameters
      let name: string = req.query && req.query.name || null;
      let version: number = req.query && req.query.version && parseInt(req.query.version);
      
      if(!name || isNaN(version) || version < 0) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during remove content request from ${Server.GetIpEndPoint(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the user
      let user: IUser = res.locals.User;
      let endPointStruct: any = Server.GetEndpointStruct(req);
      
      
      let blob: IBlob;
      try {
        // check the existence of the blob
        blob = await Blobs.GetBlob(`content:${name}`, version);
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Error while removing blob ${name} v${version}. ${error}`,
          `There was a problem removing content ${name} v${version}.`))
        return;
      }
      
      // get the collection of content managed by this user
      let userContent: IContent[] = user.Metadata && user.Metadata.Content;
      if(!userContent) userContent = user.Metadata.Content = userContent = [];
      
      // remove the content from the users metadata
      let removeAccess: boolean = true;
      for(let i = userContent.length-1; i >= 0; --i) {
        if(userContent[i].Name === name) {
          if(userContent[i].Version === version) {
            userContent.RemoveAt(i);
          } else {
            removeAccess = false;
          }
        }
      }
      
      // ensure user metadata is updated
      await UsersById.UpdateUser(user);
      
      // remove permissions from the user
      if(removeAccess) await PermissionsByUser.RemoveAccess(user.Id, `content/${name}`);
      
      // get the endpoint struct if created
      if(blob) endPointStruct.infoStr = `Content ${name} v${version} removed.`;
      else endPointStruct.errorStr = `Content was already removed.`;
      
      // redirect to the content list page
      res.redirect('/content');
      
      // await the actual removal
      if(blob) await Blobs.RemoveBlob(`content:${name}`, version);
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Create an api token and associate it with a content item */
const ContentTokenAddPost: IRoute = {
  Path: '/content/token_add',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'content/${req.query && req.query.name}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // validate the name and version parameters
      let name: string = req.query && req.query.name || null;
      let version: number = req.query && req.query.version && parseInt(req.query.version);
      
      if(!name || isNaN(version) || version < 0) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received for content token generation request from ${Server.GetIpEndPoint(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the user
      let user: IUser = res.locals.User;
      let endPointStruct: any = Server.GetEndpointStruct(req);
      
      // validate the users access to the content
      if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `content/${name}`)) {
        next(new RequestError(RequestErrorType.Validation,
          `Unauthorized access to add token to content ${name} v${version} from ${Server.GetIpEndPoint(req)}`,
          `Permission denied.`));
        return;
      }
      
      
      let blob: IBlob;
      try {
        // check the existence of the blob
        blob = await Blobs.GetBlob(`content:${name}`, version);
        
        // was the blob retrieved?
        if(blob == null) {
          next(new RequestError(RequestErrorType.Validation,
            `Request to get token for missing content ${name} v${version} from ${Server.GetIpEndPoint(req)}.`,
            `Content ${name} v${version} doesn't exist.`));
          return;
        }
        
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Error while getting token for content ${name} v${version}. ${error}`,
          `There was a problem adding api token to ${name} v${version}.`));
        return;
      }
      
      // check for an existing api token
      if(blob.Metadata && blob.Metadata.Token) {
        next(new RequestError(RequestErrorType.Validation,
          `Request to add existing token to ${name} v${version} from ${Server.GetIpEndPoint(req)}.`,
          `Content ${name} v${version} already has a token.`));
        return;
      }
      
      // generate a token
      if(!blob.Metadata) blob.Metadata = {};
      let guid: string = uuid.v1();
      // set the token
      blob.Metadata.Token = guid;
      
      // get the endpoint struct if created
      endPointStruct.infoStr = `Generated api token for ${name} v${version}.`;
      
      // redirect to the content list page
      res.redirect('/content');
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Remove an existing content item */
const ContentTokenRemovePost: IRoute = {
  Path: '/content/token_remove',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Update, 'content/${req.query && req.query.name}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // validate the name and version parameters
      let name: string = req.query && req.query.name || null;
      let version: number = req.query && req.query.version && parseInt(req.query.version);
      
      if(!name || isNaN(version) || version < 0) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received for content token generation request from ${Server.GetIpEndPoint(req)}`,
          `We received invalid information from your browser. Please try again.`));
        return;
      }
      
      // get the user
      let user: IUser = res.locals.User;
      let endPointStruct: any = Server.GetEndpointStruct(req);
      
      // validate the users access to the content
      if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `content/${name}`)) {
        next(new RequestError(RequestErrorType.Validation,
          `Unauthorized access to add token to content ${name} v${version} from ${Server.GetIpEndPoint(req)}`,
          `Permission denied.`));
        return;
      }
      
      let blob: IBlob;
      try {
        // check the existence of the blob
        blob = await Blobs.GetBlob(`content:${name}`, version);
        
        // was the blob retrieved?
        if(blob == null) {
          next(new RequestError(RequestErrorType.Validation,
            `Request to get token for missing content ${name} v${version} from ${Server.GetIpEndPoint(req)}.`,
            `Content ${name} v${version} doesn't exist.`));
          return;
        }
        
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Error while removing token from content ${name} v${version}. ${error}`,
          `There was a problem removing token from ${name} v${version}.`));
        return;
      }
      
      // check for an existing api token
      if(!blob.Metadata || !blob.Metadata.Token) {
        next(new RequestError(RequestErrorType.Validation,
          `Request to remove non-existent api token from content ${name} v${version} from ${Server.GetIpEndPoint(req)}.`,
          `Content ${name} v${version} doesn't have a token.`));
        return;
      }
      
      // delete the token
      delete blob.Metadata.Token;;
      
      // get the endpoint struct if created
      endPointStruct.infoStr = `Removed api token from ${name} v${version}.`;
      
      // redirect to the content list page
      res.redirect('/content');
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Remove an existing content item */
const ContentDownloadGet: IRoute = {
  Path: '/content/:name',
  Method: HttpMethod.Post,
  Effects: [
    AuthorizePrivate(AccessType.Read, 'content/${req.params && req.params.name}'),
    HandleAsyncErrors(async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      
      // validate the name and version parameters
      let name: string = req.params && req.params.name || null;
      let version: number = req.query && req.query.version && parseInt(req.query.version);
      
      if(!name || isNaN(version) || version < 0) {
        next(new RequestError(RequestErrorType.Validation,
          `Invalid data received during downloading content request from ${Server.GetIpEndPoint(req)}`,
          'We received invalid information from your browser. Please try again.'));
        return;
      }
      
      // get the user
      let user: IUser = res.locals.User;
      
      // validate the users access to the content
      if(!await PermissionsByUser.HasAccess(user.Id, AccessType.Update, `content/${name}`)) {
        next(new RequestError(RequestErrorType.Validation,
          `Unauthorized access to downloading content ${name} v${version} from ${Server.GetIpEndPoint(req)}`,
          `Insufficient permissions to remove content ${name}.`));
        return;
      }
      
      // check the existence of the blob
      let stream: BlobStream;
      try {
        stream = await Blobs.GetStream(`content:${name}`, version);
      } catch(error) {
        next(new RequestError(RequestErrorType.Server,
          `Error while downloading blob ${name} v${version}. ${error}`,
          `There was a problem removing content ${name} v${version}.`));
        return;
      }
      
      // was the blob retrieved?
      if(!stream) {
        next(new RequestError(RequestErrorType.Validation,
          `Request to download missing content ${name} v${version} from ${Server.GetIpEndPoint(req)}.`,
          `Content ${name} v${version} no longer exists.`));
        return;
      }
      
      // pipe the stream to the response
      res.contentType('application/octet-stream');
      res.header('Content-Disposition', 'attachment');
      stream.pipe(res, { end: true });
      stream.end();
      
    }),
    WebErrorHandling('/content')
  ]
}

/** Collection of 'content' routes */
export const Content: IRoute[] = [
  ContentListGet,
  ContentAddPost,
  ContentRemovePost,
  ContentUpdatePost,
  ContentTokenAddPost,
  ContentTokenRemovePost,
  ContentDownloadGet
];
