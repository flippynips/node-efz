/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Global log methods.
 * Revision History: None
 ******************************************************/

import { Application } from './Application';
import { Manager, IConfiguration } from "./Index";
import '../Tools/ExtendArray';

/** Log configuration */
class Configuration {
  /** Log level used by the console logger. */
  LogLevel = 'info';
}

/** Manager of all things logging. */
export class LogManager extends Manager {
  
  //-----------------------------------//
  
  public static readonly Reset = "\x1b[0m";
  public static readonly Bright = "\x1b[1m";
  public static readonly Dim = "\x1b[2m";
  public static readonly Underscore = "\x1b[4m";
  public static readonly Blink = "\x1b[5m";
  public static readonly Reverse = "\x1b[7m";
  public static readonly Hidden = "\x1b[8m";
  
  public static readonly FgBlack = "\x1b[30m";
  public static readonly FgRed = "\x1b[31m";
  public static readonly FgGreen = "\x1b[32m";
  public static readonly FgYellow = "\x1b[33m";
  public static readonly FgBlue = "\x1b[34m";
  public static readonly FgMagenta = "\x1b[35m";
  public static readonly FgCyan = "\x1b[36m";
  public static readonly FgWhite = "\x1b[37m";
  
  public static readonly BgBlack = "\x1b[40m";
  public static readonly BgRed = "\x1b[41m";
  public static readonly BgGreen = "\x1b[42m";
  public static readonly BgYellow = "\x1b[43m";
  public static readonly BgBlue = "\x1b[44m";
  public static readonly BgMagenta = "\x1b[45m";
  public static readonly BgCyan = "\x1b[46m";
  public static readonly BgWhite = "\x1b[47m";
  
  /** Log configuration. */
  public get Configuration(): Configuration {
    return this._configuration.Item;
  }
  
  //-----------------------------------//
  
  private static readonly _prefixInfo: string = `${LogManager.FgCyan}INFO:${LogManager.Reset} `;
  private static readonly _prefixDebug: string = `${LogManager.FgGreen}DBUG:${LogManager.Reset} `;
  private static readonly _prefixWarning: string = `${LogManager.FgYellow}WARN:${LogManager.Reset} `;
  private static readonly _prefixError: string = `${LogManager.FgRed}${LogManager.Blink}EROR:${LogManager.Reset} `;
  private static readonly _prefixVerbose: string = `${LogManager.FgBlue}VBOS:${LogManager.Reset} `;
  private static readonly _prefixSilly: string = `${LogManager.FgMagenta}SILY:${LogManager.Reset} `;
  
  /** Configuration instance. */
  protected _configuration: IConfiguration<Configuration>;
  
  //-----------------------------------//
  
  /** Create a manager of logs */
  constructor() {
    super();
  }
  
  public async Start(): Promise<void> {
    await super.Start();
    this._configuration = Application.Configuration(
      './config/LogManager.config',
      new Configuration(),
      this.OnConfiguration
    );
  }
  
  /** Log information. */
  public Info(message: string): void {
    console.info(LogManager._prefixInfo+message);
  }
  
  /** Log a debug message. */
  public Debug(message: string): void {
    console.debug(LogManager._prefixDebug+message);
  }
  
  /** Log a warning. */
  public Warning(message: string): void {
    console.warn(LogManager._prefixWarning+message);
  }
  
  /** Log an error. */
  public Error(message: string): void {
    console.error(LogManager._prefixError+message);
  }
  
  /** Log a verbose message. */
  public Verbose(message: string): void {
    console.info(LogManager._prefixVerbose+message);
  }
  
  /** Log a silly message. */
  public Silly(message: string): void {
    console.info(LogManager._prefixSilly+message);
  }
  
  //-----------------------------------//
  
  /** On the config being updated */
  protected OnConfiguration = (config: Configuration): void => {
    
    let logLevels: string[] = [
      'error',
      'warn',
      'info',
      'verbose',
      'debug',
      'silly'
    ];
    
    if(config.LogLevel) {
      config.LogLevel = config.LogLevel.toLowerCase();
      for(let i = logLevels.length-1; i >= 0; --i) {
        if(logLevels[i] === config.LogLevel) {
          break;
        } else {
          logLevels.RemoveAt(i);
        }
      }
    }
    
    if(logLevels.length == 0) {
      console.info(`No valid log levels specified by ${config.LogLevel}.`);
      return;
    }
    
  }
  
  
}

/** Global log manager instance */
export const Log: LogManager = new LogManager();

