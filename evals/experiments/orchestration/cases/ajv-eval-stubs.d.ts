declare module "re2" {
  interface RE2 extends RegExp {}
  interface RE2Constructor extends RegExpConstructor {
    new (pattern: RegExp | string, flags?: string): RE2;
    (pattern: RegExp | string, flags?: string): RE2;
    readonly prototype: RE2;
  }
  var RE2: RE2Constructor;
  export = RE2;
}
