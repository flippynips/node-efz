/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Miscellanous helper methods without a better place to be.
 * Revision History: None
 ******************************************************/

import * as express from 'express';
import { AddressInfo } from "net";

import { IEnum } from './IEnum';

/** Get the name of a property of a type */
export const propertyof = <T>(name: string & keyof T): string => name;
/** Get the name of a type */
export const nameof = <T>(c: T & Object): string => c.constructor.name;

/** Sleep for the specified time */
export async function Sleep(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

/** Get a rough size of an object */
export function RoughSizeOfObject(obj: object): number {
  
  let objectList = [];
  let stack = [obj];
  let bytes = 0;
  
  while (stack.length) {
    let value: any = stack.pop();
    
    if (typeof value === 'boolean') {
      bytes += 4;
    } else if (typeof value === 'string') {
      bytes += value.length * 2;
    } else if (typeof value === 'number') {
      bytes += 8;
    } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
      objectList.push(value);
      for(let i in value) stack.push(value[i]);
    }
  }
  
  return bytes;
}

/** Get whether the string is null or empty */
export function IsNullOrEmpty(str: string): boolean {
  return str == null || str.length == 0;
}

/** Get a collection of enum values and associated indices */
export function GetEnumValues<T>(e: IEnum): { Name: string, Value: T }[] {
  let values: { Name: string, Value: T }[] = [];
  let first: string;
  for(let enumValue in e) {
    let integer: number = parseInt(enumValue);
    if(isNaN(integer)) {
      if(first === enumValue) break;
      if(!first) first = enumValue;
      values.push({
        Name: enumValue,
        Value: (<any>e)[enumValue]
      });
    } else {
      let name = e[integer];
      if(first === name) break;
      if(!first) first = name;
      values.push({
        Name: name,
        Value: (<any>e)[name]
      });
    }
    
  }
  return values;
}

/** Get the index of a specified enum value */
export function GetEnumIndex(e: IEnum, value: string): number {
  if(!value) return -1;
  
  for(let enumValue in e) {
    let integer: number = parseInt(enumValue);
    if(isNaN(integer)) continue;
    if(e[integer] === value) return integer;
  }
  
  return -1;
}

/** Get the enum value that is associated with the specified string */
export function GetEnumValue<T extends IEnum>(e: IEnum, value: string): T {
  if(!value) return null;
  // dirty due to --no-implicit-any
  return (<any>e)[value];
}
