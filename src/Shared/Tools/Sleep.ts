
import { Time, Log } from '../Managers/Index';

let theNextTick: (callback: (...args: any[]) => void, ...args: any[]) => any;
let theSetImmediate: (callback: (...args: any[]) => void, ...args: any[]) => any;

// define setImmediate and nextTick
(function() {
  // use native nextTick (unless we're in webpack)
  // webpack (or better node-libs-browser polyfill) sets process.browser.
  // this way we can detect webpack properly
  if(typeof process !== 'undefined' && process.nextTick && !(<any>process).browser) {
    theNextTick = process.nextTick;
    if(typeof setImmediate === 'function') {
      theSetImmediate = setImmediate;
    } else {
      // polyfill setImmediate with nextTick, older versions of node
      // (those w/o setImmediate) won't totally starve IO
      theSetImmediate = theNextTick;
    }
    return;
  }
  
  // polyfill nextTick with native setImmediate
  if(typeof setImmediate === 'function') {
    theSetImmediate = function() { return setImmediate.apply(undefined, arguments); };
    theNextTick = function(callback, ...args: any[]) {
      return setImmediate(callback, ...args);
    };
    return;
  }
  
  /* Note: A polyfill upgrade pattern is used here to allow combining
  polyfills. For example, MutationObserver is fast, but blocks UI updates,
  so it needs to allow UI updates periodically, so it falls back on
  postMessage or setTimeout. */
  
  // polyfill with setTimeout
  theSetImmediate = function(callback, ...args: any[]) {
    setTimeout(callback, 0, args);
  };
  
  // upgrade polyfill to use postMessage
  //@ts-ignore
  if(typeof window !== 'undefined' && typeof window.postMessage === 'function') {
    let msg = 'spice.setImmediate';
    let callbacks: {cb:((...args: any[]) => void), args:any[]}[] = [];
    theSetImmediate = function(callback,args) {
      callbacks.push({cb:callback,args:args});
      // only send message when one hasn't been sent in
      // the current turn of the event loop
      if(callbacks.length === 1) {
        //@ts-ignore
        window.postMessage(msg, '*');
      }
    };
    let handler = (event: any) => {
      //@ts-ignore
      if(event.source === window && event.data === msg) {
        event.stopPropagation();
        let copy = callbacks.slice();
        callbacks.length = 0;
        copy.forEach(function(callback) {
          callback.cb(...callback.args);
        });
      }
    }
    //@ts-ignore
    window.addEventListener('message', handler, true);
  }
  
  // upgrade polyfill to use MutationObserver
  //@ts-ignore
  if(typeof MutationObserver !== 'undefined') {
    // polyfill with MutationObserver
    let now = Date.now();
    let attr = true;
    //@ts-ignore
    let div = document.createElement('div');
    let callbacks: {cb: ((...args: any[]) => void), args: any[]}[] = [];
    //@ts-ignore
    new MutationObserver(function() {
      let copy = callbacks.slice();
      callbacks.length = 0;
      copy.forEach(function(callback) {
        callback.cb(...callback.args);
      });
    }).observe(div, {attributes: true});
    let oldSetImmediate = theSetImmediate;
    theSetImmediate = function(callback, ...args: any[]) {
      if(Time.Now - now > 15) {
        now = Time.Now;
        oldSetImmediate(callback, args);
      } else {
        callbacks.push({cb:callback,args:args});
        // only trigger observer when it hasn't been triggered in
        // the current turn of the event loop
        if(callbacks.length === 1) {
          div.setAttribute('a', <any>(attr = !attr));
        }
      }
    };
  }
  
  theNextTick = theSetImmediate;
  
})();

export const NextTick: (callback: (...args: any[]) => void, ...args: any[]) => any = theNextTick;
export const SetImmediate: (callback: (...args: any[]) => void, ...args: any[]) => any = theSetImmediate;

/** Sleep for the specified time */
export async function Sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/** Nap using NextTick. */
export function Nap(): Promise<void> {
  return new Promise<void>(resolve => NextTick(resolve));
}

/** Create a function to limit function callbacks to a minimum number of milliseconds. Binds the returned
 * function to the current context. */
export function Debounce(ms: number, callback: (...args: any[]) => any): (...args: any[]) => any {
  let lastTime: number = 0;
  let waiting: boolean = false;
  let lastArgs: any[];
  let result: (...args: any[]) => any;
  result = function(this: any, ...args: any[]) {
    if(Time.Now - lastTime < ms) {
      if(waiting) {
        lastArgs = args;
        return;
      }
      lastTime = Time.Now;
      waiting = true;
      Time.AddTimer(
        Math.max(0, ms - (Time.Now - lastTime)),
        result.bind(this),
        ...args
      );
    } else {
      waiting = false;
      lastTime = Time.Now;
      // use the last arguments
      if(lastArgs) {
        args = lastArgs;
        lastArgs = undefined;
      }
      return callback.call(this, ...args);
    }
  };
  return result;
}
