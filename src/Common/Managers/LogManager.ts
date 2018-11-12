/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Global log methods.
 * Revision History: None
 ******************************************************/

import * as winston from 'winston';

import { Manager } from "./Index";
import '../Tools/ExtendArray';

/** Log configuration */
class Configuration {
  /** Log level used by the console logger. */
  LogLevel = 'info';
}

/** Manager of all things logging. */
class LogManager extends Manager<Configuration> {
  
  //-----------------------------------//
  
  /** Logger instance. */
  public Logger: winston.Logger;
  
  //-----------------------------------//
  
  private static readonly _format = winston.format.printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
  });
  
  //-----------------------------------//
  
  /** Create a manager of logs */
  constructor() {
    super(Configuration);
    this.OnConfiguration(this.Configuration);
  }
  
  /** Log information. */
  public Info(message: string): void {
    Log.Logger.info(message);
  }
  
  /** Log a debug message. */
  public Debug(message: string): void {
    Log.Logger.debug(message);
  }
  
  /** Log a warning. */
  public Warning(message: string): void {
    Log.Logger.warn(message);
  }
  
  /** Log an error. */
  public Error(message: string): void {
    Log.Logger.error(message);
  }
  
  /** Log a verbose message. */
  public Verbose(message: string): void {
    Log.Logger.verbose(message);
  }
  
  /** Log a silly message. */
  public Silly(message: string): void {
    Log.Logger.silly(message);
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
    
    for(let i = logLevels.length-1; i >= 0; --i) {
      if(config.LogLevel === logLevels[i]) {
        break;
      } else {
        logLevels.RemoveAt(i);
      }
    }
    
    // has the logger been created? yes, close the existing logger
    if(this.Logger) this.Logger.close();
    
    if(logLevels.length == 0) {
      console.info(`No valid log levels specified by ${config.LogLevel}.`);
      return;
    }
    
    // setup the default logger
    this.Logger = winston.createLogger({
      level: config.LogLevel,
      format: winston.format.combine(
        winston.format.cli(),
        winston.format.timestamp(),
        LogManager._format
      ),
      transports: [
        new winston.transports.Console({
          stderrLevels: logLevels,
          eol: '\n'
        })
      ]
    });
    
  }
  
  
}

/** Global log manager instance */
export var Log: LogManager = new LogManager();

