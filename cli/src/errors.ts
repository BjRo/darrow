export class DarrowError extends Error {
  constructor(
    message: string,
    readonly category = "configuration",
    readonly exitCode = 2,
  ) {
    super(message);
    this.name = "DarrowError";
  }
}
