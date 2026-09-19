export class AppsScriptError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly action: string
  ) {
    super(message)
    this.name = "AppsScriptError"
  }
}
