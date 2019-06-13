
/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Miscellanous helper methods without a better place to be.
 * Revision History: None
 ******************************************************/

/** Get the name of a property of a type */
export const propertyof = <T>(name: string & keyof T): string => name;
/** Get the name of a type */
export const nameof = <T>(c: T & Object): string => c.constructor.name;

/** Key-value pair */
export interface Dictionary<T> { [Key: string]: T };

/** Defines a structure for a collection of types with a
 * current assignment.
 */
export interface WithAlternatives<T> {
  /** Current instance. */
  Current: T;
  /** Collection of alternatives. */
  Alternatives: T[];
}

/** Function that can be used to cascade promise rejections. */
export function CascadeRejection(err: any) {
  return Promise.reject(err);
}

/** Represents the name by index capability of an enum */
export interface IEnum {
  [id: number]: string;
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

/** Merge values with ascending priority on item values. */
export function Merge<T extends Object>(...items: T[]): T {
  if(items.length === 0) return null;
  let result: any = items[0];
  
  for(let i = 1; i < items.length; ++i) {
    let item = items[i];
    if(!item) continue;
    switch(typeof item) {
      case 'object':
        if(Array.isArray(item)) {
          result = item.Clone();
        } else {
          if(!result) result = {};
          for(let key in item) {
            if(!item.hasOwnProperty(key)) continue;
            result[key] = Merge(result[key], item[key]);
          }
        }
        break;
      case 'undefined':
        break;
      default:
        result = items[i];
    }
  }
  return result;
}

/** Merge values with ascending priority on item values.
 * Arrays are also merged.
 */
export function MergeWithArrays<T extends Object>(...items: T[]): T {
  if(items.length === 0) return null;
  let result: any = items[0];
  
  for(let i = 1; i < items.length; ++i) {
    let item = items[i];
    if(!item) continue;
    switch(typeof item) {
      case 'object':
        if(Array.isArray(item)) {
          if(!result) result = [];
          for(let i = 0; i < item.length; ++i) {
            result.push(item[i]);
          }
        } else {
          if(!result) result = {};
          for(let key in item) {
            if(!item.hasOwnProperty(key)) continue;
            result[key] = Merge(result[key], item[key]);
          }
        }
        break;
      case 'undefined':
        break;
      default:
        result = items[i];
    }
  }
  return result;
}

/** Compare the values of one object with another. */
export function CompareObjects(object1: any, object2: any): boolean {
  if(object1 == null && object2 == null) return true;
  if(object1 == null || object2 == null || typeof object1 !== typeof object2) return false;
  for(let key in object1) {
    if(!object1.hasOwnProperty(key)) continue;
    
    let value1: any = object1[key];
    let value2: any = object2[key];
    
    if(value1 == null && value2 == null) continue;
    if(value1 == null || value2 == null || typeof value1 !== typeof value2) return false;
    
    if(typeof value1 === 'object') {
      if(!CompareObjects(value1, value2)) return false;
    } else if(value1 !== value2) {
      return false;
    }
  }
  
  return true;
}

/** Attempt a deep copy of an object. Worth testing if crucial. */
export function CloneObject(src: any): any {
  let target: any = {};
  for (let prop in src) {
    if (!src.hasOwnProperty(prop)) continue
    if(typeof src[prop] === 'object') {
      target[prop] = CloneObject(src[prop]);
    } else {
      target[prop] = src[prop];
    }
  }
  return target;
}
