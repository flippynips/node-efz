import * as http from 'http';
import * as forge from 'node-forge';

import { Log } from '../Managers/Index';
import { Http, Dictionary } from './Index';

/** Max http response length */
const MaxResponseLength: number = 1024 * 100;

/** Represents a generic http request. */
export interface Request {
  Method: Http.Method;
  Host: string;
  Port?: number;
  Path?: string;
  Data?: string;
  Headers?: Dictionary<string>;
  Retries?: number;
  Timeout?: number;
}

/** Represents a generic http response. */
export interface Response {
  Status: number;
  Headers?: Dictionary<string>;
  Data?: string;
}

/** Make a http request. */
export const MakeRequest = async function(request: Request): Promise<Response> {
  
  if(!request.Timeout) request.Timeout = 455 + Math.random() * 152;
  else if(request.Timeout < 0) throw new Error(`Timed out before send`);
  if(!request.Retries) request.Retries = 1;
  if(!request.Headers) request.Headers = {};
  
  // has data been specified?
  if(request.Data) {
    if(!request.Headers['content-type']) request.Headers['content-type'] = 'text/plain;charset=utf-8';
  }
  
  // iterate the retries
  while(--request.Retries >= 0) {
    
    let response: Response = await new Promise<http.IncomingMessage>(
      (resolve, reject) => {
        
        try {
          
          // make the request
          var req: http.ClientRequest = http.request(
            {
              method: Http.GetMethodString(request.Method),
              host: request.Host,
              port: request.Port || 80,
              path: request.Path,
              headers: request.Headers,
              timeout: request.Timeout
              /*
              protocol: 'http:',
              hostname: undefined,
              family: undefined,
              defaultPort: undefined,
              localAddress: undefined,
              socketPath: undefined,
              auth: undefined,
              agent: undefined,
              createConnection: undefined
              */
            },
            resolve
          );
          
          // set timeout
          req.setTimeout(request.Timeout,
            () => {
              if(req.aborted) return;
              req.destroy(new Error(`Timed out before a response was received.`));
            }
          );
          
          // subscribe to error events
          req.on('error', reject);
          
          // send the request
          if(request.Data) req.end(request.Data);
          else req.end();
          
        } catch(error) {
          
          reject(error);
          
        }
        
      }
    ).then((res: http.IncomingMessage) => new Promise<Response>((resolve, reject) => {
      
      // check for known and handled status codes
      if(res.statusCode !== Http.Status.Ok) {
        switch(res.statusCode) {
          case Http.Status.Temporary:
            try { res.destroy(); } catch {}
            reject(new Error(`Http response indicated a temporary problem with the server.`));
            break;
          default:
            if(res.statusCode < 500 && res.statusCode >= 450) {
              try { res.resume(); } catch {}
              resolve({
                Status: res.statusCode
              });
            } else {
              try { res.destroy(); } catch {}
              reject(new Error(`Http response error '${res.statusCode}; ${res.statusMessage}'.`));
            }
            break;
        }
        return;
      }
      
      let chunks: Uint8Array[] = [];
      let length: number = 0;
      res.on(
        'data',
        (chunk) => {
          if(!chunks) return;
          chunks.push(chunk);
          length += chunk.length;
          if(length > MaxResponseLength) {
            chunks = undefined;
            try { res.destroy(); } catch {}
            reject(new Error(`Max response length '${MaxResponseLength}' was exceeded by ` +
              `'${(res.connection ? `${res.connection.remoteAddress}:${res.connection.remotePort}` : 'disconnected')}'.`));
          }
        }
      ).on(
        'end',
        () => {
          if(!chunks) return;
          
          resolve({
            Status: res.statusCode,
            Headers: res.headers as Dictionary<string>,
            Data: forge.util.binary.raw.encode(Buffer.concat(chunks))
          });
          
        }
      ).on(
        'error',
        (err) => {
          try { res.destroy(); } catch {}
          reject(err);
        }
      );
      
    }), (error) => Promise.reject(error))
    .catch(
      (error) => {
        Log.Debug(`Error with '${Http.Method[request.Method]}' request to '${request.Host}:${request.Port}${request.Path}'. ${error}`);
        return null;
      }
    );
    
    if(response) return response;
    
  }
  
  return null;
  
}
