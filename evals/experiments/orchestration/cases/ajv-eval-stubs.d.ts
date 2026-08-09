declare module "re2" {
  type RE2 = RegExp;
  interface RE2Constructor extends RegExpConstructor {
    new (pattern: RegExp | string, flags?: string): RE2;
    (pattern: RegExp | string, flags?: string): RE2;
    readonly prototype: RE2;
  }
  const RE2: RE2Constructor;
  export = RE2;
}
