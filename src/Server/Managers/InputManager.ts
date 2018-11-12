/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Input management. Maintains input subscription callbacks,
 *  command-line help and input helper methods.
 * Revision History: None
 ******************************************************/

import { Dictionary } from 'lodash';

import { Manager } from "./Index";
import { ApplicationName, MajorVersion, MinorVersion, Sleep } from "../Tools/Index";

/** Manager of dynamic input handling. */
class InputManager extends Manager<any> {
  
  //-------------------------------------//
  
  /** Number of columns in the console or terminal window */
  public ConsoleWidth: number;
  /** Number of rows in the console or terminal window */
  public ConsoleHeight: number;
  
  //-------------------------------------//
  
  /** Subscribe to all input */
  private subText: Array<{ callback: (text: string) => void, help: string }>;
  
  /** Subscribe to input prefixed by a specified string */
  private subPrefix: Array<{ key: string, callback: (text: string) => void, help: string }>;
  
  /** Map of keys to string callbacks */
  private subKeys: Dictionary<{ callback: (text: string) => void, help: string }>;
  
  /** Map of keys to empty callbacks */
  private subFlags: Dictionary<{ callback: () => void, help: string }>;
  
  /** Flag indicating input is paused until [Enter] is pressed */
  private pausedUntilEnterIsPressed: boolean;
  
  //-------------------------------------//
  
  /** Construct a new input manager. */
  public constructor() {
    super();
    
    this.subKeys = {};
    this.subFlags = {};
    this.subText = new Array<{ callback: (text: string) => void, help: string }>();
    this.subPrefix = new Array<{ key: string, callback: (text: string) => void, help: string }>();
    
    this.ConsoleWidth = process.stdout.columns;
    this.ConsoleHeight = process.stdout.rows;
    
    // enable the stdin stream
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    // subscribe to console input events
    process.stdin.on('data', this.OnInput);
    // subscribe to console resize events
    process.stdout.on('resize', this.OnConsoleResize);
    
    this.subFlags['help'] = { callback: this.OnHelp, help: "'help' for this help text." };
    
  }
  
  /** Subscribe to messages consisting of the specified key followed by '=' */
  public SubscribeToSetting(key: string, callback: (text: string) => void, help: string = null): void {
    
    // set the callback
    Input.subKeys[key] = { callback: callback, help: help };
    
  }
  
  /** Unsubscribe to messages consisting of the specified key */
  public UnsubscribeToSetting(key: string): void {
    
    // remove the callback
    delete Input.subKeys[key];
    
  }
  
  /** Subscribe to the prefix */
  public SubscribeToPrefix(key: string, callback: (text: string) => void, help: string = null): void {
    
    // add the callback
    Input.subPrefix.push({ key, callback, help });
    
  }
  
  /** Unsubscribe to the prefix */
  public UnsubscribeToPrefix(key: string): void {
    
    // remove the callback
    for(let i = 0; i < Input.subPrefix.length; ++i) {
      if(Input.subPrefix[i].key === key) {
        delete Input.subPrefix[i];
        break;
      }
    }
    
  }
  
  /** Subscribe to input prefixed by the specified key */
  public SubscribeToFlag(key: string, callback: () => void, help: string = null): void {
    
    // set the callback
    Input.subFlags[key] = { callback, help };
    
  }
  
  /** Unsubscribe to messages consisting of the specified key */
  public UnsubscribeToFlag(key: string, callback: () => void): void {
    
    // remove the callback
    delete Input.subFlags[key];
    
  }
  
  /** Subscribe to input prefixed by the specified key */
  public SubscribeToText(callback: (text: string) => void, help: string = null): void {
    
    // set the callback
    Input.subText.push({ callback, help });
    
  }
  
  /** Subscribe to input prefixed by the specified key */
  public UnsubscribeToText(callback: (text: string) => void): void {
    
    // remove the callback
    for(let i = 0; i < Input.subText.length; ++i) {
      if(Input.subText[i].callback === callback) {
        delete Input.subText[i];
        break;
      }
    }
    
  }
  
  /** Pause until a key is pressed */
  public async PressEnterToContinue(): Promise<void> {
    
    Input.pausedUntilEnterIsPressed = true;
    while(Input.pausedUntilEnterIsPressed) {
      await Sleep(50);
    }
    
  }
  
  //-------------------------------------//
  
  /** On the console or terminal resized */
  private OnConsoleResize(): void {
    
    // update the console width
    Input.ConsoleWidth = process.stdout.columns;
    // update the console height
    Input.ConsoleHeight = process.stdout.rows;
    
  }
  
  /** On standard input */
  private OnInput(text: string): void {
    
    if(Input.pausedUntilEnterIsPressed) {
      Input.pausedUntilEnterIsPressed = false;
      return;
    }
    
    // remove the newline ending
    if(text[text.length-1] === '\n') {
      if(text[text.length-2] === '\r') {
        if(text.length == 2) return;
        text = text.substring(0, text.length-2);
      } else {
        if(text.length == 1) return;
        text = text.substring(0, text.length-1);
      }
    }
    
    // is the text surrounded by quotes?
    if(text.startsWith('\'') && text.endsWith('\'') ||
       text.startsWith('"') && text.endsWith('"') ||
       text.startsWith('`') && text.endsWith('`')) {
      
      // yes, process as a single string
      text = text.substring(1, text.length-1);
      
      // run callbacks for all text
      for(let i = 0; i < Input.subText.length; ++i) Input.subText[i].callback(text);
      
      // run callbacks for prefixes
      for(let i = 0; i < Input.subPrefix.length; ++i) {
        if(text.startsWith(Input.subPrefix[i].key)) Input.subPrefix[i].callback(text.substring(Input.subPrefix[i].key.length));
      }
      
      // try get callback
      let callbackStructure = Input.subFlags[text];
      
      // was the callback found? yes, run it
      if(callbackStructure) callbackStructure.callback();
      
      return;
      
    }
    
    // parse the input
    var index = text.indexOf('=');
    // was an index found?
    if (index >= 0) {
      
      // yes, parse
      let key: string = text.substr(0, index);
      let value: string = text.substr(index+1);
      
      // is the value quoted?
      if(value.startsWith('\'') && value.endsWith('\'') ||
         value.startsWith('"') && value.endsWith('"') ||
         value.startsWith('`') && value.endsWith('`')) {
        
        // yes, process as a single string
        value = value.substring(1, text.length-1);
        
      }
      
      // try find the callback
      let callbackStructure = Input.subKeys[key];
      
      // was the callback found? yes, run it
      if(callbackStructure) callbackStructure.callback(value);
      
    }
    
    // try find the callback for flag spec
    let callbackStructure = Input.subFlags[text];
    
    // was the callback found? yes, run it
    if(callbackStructure) callbackStructure.callback();
    
    // run callbacks for all text
    for(let i = 0; i < Input.subText.length; ++i) Input.subText[i].callback(text);
    
    // run callbacks for prefixes
    for(let i = 0; i < Input.subPrefix.length; ++i) {
      if(text.startsWith(Input.subPrefix[i].key)) Input.subPrefix[i].callback(text.substring(Input.subPrefix[i].key.length));
    }
    
  }
  
  /** On 'help' being entered */
  private OnHelp(): void {
    
    // iterate all subscriptions and append to log
    
    let separator: string = ' ' + new Array(Input.ConsoleWidth-1).join('-');
    let helpStr: string = `\n\x1b[32m${separator}`;
    
    helpStr += `\n \x1b[36m${ApplicationName} v${MajorVersion}.${MinorVersion}.0\n\n\x1b[0m`;
    
    for(let i = 0; i < Input.subText.length; ++i) {
      if(Input.subText[i].help) helpStr += `  - ${Input.subText[i].help}\n`;
    }
    
    for (const [key, value] of Object.entries(Input.subFlags)) {
      if(value.help) helpStr += `  - ${value.help}\n`;
    }
    
    for (const [key, value] of Object.entries(Input.subKeys)) {
      if(value.help) helpStr += `  - ${value.help}\n`;
    }
    
    for(let i = 0; i < Input.subPrefix.length; ++i) {
      if(Input.subPrefix[i].help) helpStr += `  - ${Input.subPrefix[i].help}\n`;
    }
    
    helpStr += `\n\x1b[32m${separator}\x1b[0m`;
    
    console.log(helpStr);
    
  }
  
}

/** Global input manager instance */
export var Input: InputManager = new InputManager();
