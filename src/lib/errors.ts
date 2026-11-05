export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
