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
  }
}

String.prototype.ParseArguments = function(): string[] {
  
  let str: string = this;
  
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
  
}

String.prototype.ReplaceAt = function(index, replacement) {
  return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}

