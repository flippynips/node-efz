/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Email management. Provides email transport and dynamically
 *  sending emails.
 * Revision History: None
 ******************************************************/

import * as nodemailer from 'nodemailer';

import { IsNullOrEmpty, ApplicationName } from '../Tools/Index';
import { Manager, Log, Input } from "./Index";

/** Email configuration */
class Configuration {
  /** Name given to the email transporter */
  Name: string = 'email';
  /** Service end-point of the email transporter */
  Service: string = null;
  /** Service port */
  ServicePort: number = 587;
  /** Optional username to authenticate with the service */
  Username: string = null;
  /** Optional password to authenticate with the service */
  Password: string = null;
  /** Default email sender. Used when sending emails from command line. */
  DefaultSender: string = `noreply@${ApplicationName}`;
  /** Service connection timeout */
  ConnectionTimeout: number = 1000 * 60 * 2;
  /** TODO : Implement and test secure transporter */
  Secure: boolean = false;
}

/** Manager of emails. */
class EmailManager extends Manager<Configuration> {
  
  //-------------------------------------//
  
  //-------------------------------------//
  
  /** Default email transporter instance */
  private _transporter: nodemailer.Transporter;
  
  //-------------------------------------//
  
  /** Construct a new email manager */
  constructor() {
    super(Configuration);
  }
  
  /** Send an email with the specified options */
  public async Send(options: nodemailer.SendMailOptions): Promise<void> {
    await this._transporter.sendMail(options);
  }
  
  /** Send an email with the specified options synchronously */
  public SendSync(options: nodemailer.SendMailOptions, callback?: (err: Error, info: any) => void): void {
    if(callback == null) {
      callback = (err, info) => {
        if(err != null) Log.Error(`An error occurred sending a mail message from ${options.from} to ${options.to}. ${err}`);
        if(info != null) Log.Info(`Mail message info; ${info}`);
      };
    }
    this._transporter.sendMail(options, callback);
  }
  
  //-------------------------------------//
  
  /** On the email manager configuration being updated. */
  protected OnConfiguration = (config: any): void => {
    
    config.Name = config.Name || 'email';
    config.Service = config.Service || null;
    config.ServicePort = config.ServicePort || 587;
    config.Username = config.Username || '';
    config.Password = config.Password || '';
    config.DefaultSender = config.DefaultSender || `noreply@${ApplicationName}`;
    config.ConnectionTimeout = config.ConnectionTimeout || 1000 * 60 * 2;
    config.Secure = config.Secure || false;
    
    // if service isn't specified, skip setup
    if(IsNullOrEmpty(config.Service)) return;
    
    Log.Info(`Starting email transporter ${config.Name} with service ${config.Service}`)
    
    let transporterOptions: any = {
      name: config.Name,
      service: config.Service,
      connectionTimeout: config.ConnectionTimeout
    };
    
    if(config.Secure) {
      transporterOptions.secure = true;
      transporterOptions.requireTLS = true;
      transporterOptions.tls = {
        host: config.Service,
        port: config.ServicePort
      };
    }
    
    if(config.Username != '' && config.Password != '') {
      transporterOptions.auth = {
        user: config.Username,
        pass: config.Password
      };
    }
    
    // create the transporter
    this._transporter = nodemailer.createTransport(transporterOptions);
    
    // verify connection
    this._transporter.verify((error: Error, success: boolean) => {
      if(!success) Input.SubscribeToPrefix('send', this.OnSendCommand, 'Manually send an Email. Use; send [from] {to} {subject} {message}');
      else Log.Warning(`SMTP connection failed. ${error}`);
    });
    
  }
  
  /** On a send command line */
  private OnSendCommand(text: string): void {
    
    // parse the command line options
    let args = text.ParseArguments();
    
    // determine args
    switch(args.length) {
      case 3:
        Email.SendSync({
          from: Email.Configuration.DefaultSender,
          to: args[0],
          subject: args[1],
          text: args[2],
        });
        break;
      case 4:
        Email.SendSync({
          from: args[0],
          to: args[1],
          subject: args[2],
          text: args[3],
        });
        break;
      default:
        Log.Warning('Incorrect arguments for the send command. Use; send [from] {to} {subject} ["]{message}["]');
        return;
    }
    
  }
  
}

/** Global email manager instance */
export var Email: EmailManager = new EmailManager();
