/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Extension methods for strings.
 * Revision History: None
 ******************************************************/

// treat as module
export {};

declare global {
  interface String {
    
    /** Parse the specified string into individual arguments separated by spaces
     * and potentially escaped using double quotes.
     */
    ParseArguments(): string[];
    /** Replace the character at the specified index with the specified replacement
     * string.
     */
    ReplaceAt(index: number, replacement: string): string;
    /** Replace all instances of the specified string and return the result.
     * NOTE : Will interpret regular expression special characters. Use 'EscapeRegEx()' first for safety.
     */
    ReplaceAll(searchValue: string, replaceValue?: string): string;
    /** Escape a string containing regular expression special characters. */
    EscapeRegEx(): string;
    
    /** Find the number of times the specified search value exists. */
    Occurances(search: string, allowOverlapping?: boolean): number;
    
    /** Generate a hash code from the string. */
    HashCode(): number;
    
  }
}

String.prototype.ParseArguments = function(): string[] {
  
  let str: String = this;
  
  str = str.trim();
  let args: string[] = [];
  
  // iterate the string and append each argument
  let quoted: boolean = false;
  let index: number = 0;
  for(let i = 0; i < str.length; ++i) {
    switch(str[i]) {
      case ' ':
        if(quoted) continue;
        let arg: string;
        if(str[index] == '"' && str[i-1] == '"') arg = str.substr(index + 1, i - index - 2);
        else arg = str.substr(index, i - index);
        args.push(arg);
        index = i+1;
        break;
      case '"':
        quoted = !quoted;
        break;
    }
  }
  
  // append the last argument
  if(index < str.length) {
    let arg: string;
    if(str[index] == '"' && str[str.length-1] == '"') arg = str.substr(index + 1, str.length - 2 - index);
    else arg = str.substr(index, str.length - 1 - index);
    args.push(arg);
  }
  
  return args;
  
};

String.prototype.ReplaceAt = function(index: number, replacement: string) {
  return this.substr(0, index) + replacement + this.substr(index + replacement.length);
};

String.prototype.EscapeRegEx = function(): string {
  return this.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

String.prototype.ReplaceAll = function(searchValue: string, replaceValue: string = ''): string {
  return this.replace(new RegExp(searchValue, 'g'), replaceValue);
};

/** Function that count occurrences of a substring in a string;
 * @param {String} string               The string
 * @param {String} subString            The sub string to search for
 * @param {Boolean} [allowOverlapping]  Optional. (Default:false)
 *
 * @author Vitim.us https://gist.github.com/victornpb/7736865
 * @see Unit Test https://jsfiddle.net/Victornpb/5axuh96u/
 * @see http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string/7924240#7924240
 */
String.prototype.Occurances = function(this: string, subString: string, allowOverlapping?: boolean): number {
  
  if(subString.length <= 0) return (this.length + 1);
  
  let n = 0;
  let pos = 0;
  let step = allowOverlapping ? 1 : subString.length;

  while(true) {
    pos = this.indexOf(subString, pos);
    if(pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }
  
  return n;
  
};

/** Generate a hash code from a string.
 * @author: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/ */
String.prototype.HashCode = function(this: string): number {
  if(this.length === 0) return 0;
  let hash: number = 0;
  for(let i = this.length-1; i >= 0; --i) {
    hash  = ((hash << 5) - hash) + this.charCodeAt(i);
    hash |= 0; // convert to 32bit integer
  }
  return hash;
};
