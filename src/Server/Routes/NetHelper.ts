import * as express from 'express';

import { AddressInfo } from 'net';

/** Get the ip address of an express request.
 * Will throw if remote address isn't available. */
export const GetRequestHost = function(req: express.Request): string {
  
  if(req.connection.remoteAddress) return req.connection.remoteAddress;
  
  // check the ip address of the requestor and node end point
  let requestorInfo: string | AddressInfo = req.connection.address();
  if(!requestorInfo) throw new Error(`Request host wasn't retrievable.`);
  if(typeof requestorInfo === 'string') return requestorInfo;
  else return requestorInfo.address;
  
}

/** Get the remote ip address and port of a request. Should not throw. */
export const GetEndPointString = function(req: express.Request | express.Response): string {
    
  let address: string | AddressInfo = req.connection
    && (req.connection.address && req.connection.address() || req.connection.remoteAddress)
    || <string>null;
  
  if(address && typeof address !== 'string') address = address.address;
  
  // get the remote port
  let port: number = req.connection && req.connection.remotePort;
  if(!port) return address as string;
  
  return EndPointString(address as string, port);
  
}

/** Get an end point string from an ip and end point. */
export const EndPointString = function(ip: string, port: number): string {
  if(ip && (ip.length > 15 || ip.indexOf(':') !== -1)) return `[${ip}]:${port}`;
  return `${ip}:${port}`;
}
