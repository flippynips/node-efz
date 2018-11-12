/******************************************************
 * Project: EFZ
 * Author: Joshua Graham
 * Purpose: Extension methods for dates.
 * Revision History: None
 ******************************************************/
/** Javascript Source; http://cwestblog.com/2012/09/27/javascript-date-prototype-format/ */

const D = "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(",");
const M = "January,February,March,April,May,June,July,August,September,October,November,December".split(",");

// ensure this is treated as a module
export {};

declare global {
  interface Date {
    /** Format the date using the specified format string */
    Format: (format: string) => string;
  }
}

Date.prototype.Format = function(format: string): string {
  let date: Date = this;
  return format.replace(/a|A|Z|S(SS)?|ss?|mm?|HH?|hh?|D{1,4}|M{1,4}|YY(YY)?|'([^']|'')*'/g, function(str, args: any[]) {
    let c1: any = str.charAt(0);
    let ret: string | number = str.charAt(0) == "'"
        ? (c1=0) || str.slice(1, -1).replace(/''/g, "'")
        : str == "a"
          ? (date.getHours() < 12 ? "am" : "pm")
          : str == "A"
            ? (date.getHours() < 12 ? "AM" : "PM")
            : str == "Z"
              ? (("+" + -date.getTimezoneOffset() / 60).replace(/^\D?(\D)/, "$1").replace(/^(.)(.)$/, "$10$2") + "00")
              : c1 == "S"
                ? date.getMilliseconds()
                : c1 == "s"
                  ? date.getSeconds()
                  : c1 == "H"
                    ? date.getHours()
                    : c1 == "h"
                      ? (date.getHours() % 12) || 12
                      : (c1 == "D" && str.length > 2)
                        ? D[date.getDay()].slice(0, str.length > 3 ? 9 : 3)
                        : c1 == "D"
                          ? date.getDate()
                          : (c1 == "M" && str.length > 2)
                            ? M[date.getMonth()].slice(0, str.length > 3 ? 9 : 3)
                            : c1 == "m"
                              ? date.getMinutes()
                              : c1 == "M"
                                ? date.getMonth() + 1
                                : ("" + date.getFullYear()).slice(-str.length);
    return c1 && str.length < 4 && ("" + ret).length < str.length
      ? ("00" + ret).slice(-str.length)
      : ret.toString();
  });
  
};
