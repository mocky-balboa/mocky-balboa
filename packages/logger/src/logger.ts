import chalk from "chalk";

export type LoggerContext = Record<string, unknown>;

export class Logger {
  constructor(private readonly packageName: string) {}

  private getTimeString() {
    const time = new Date();
    return `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
  }

  private getContextString(
    ctx?: LoggerContext,
    color: chalk.Chalk = chalk.grey,
  ) {
    if (!ctx) return "";
    return color(JSON.stringify(ctx, null, 2));
  }

  private log(message: string, ctx: string) {
    const time = chalk.grey(this.getTimeString());
    console.log(`${time} [${chalk.blue(this.packageName)}] ${message}\n${ctx}`);
  }

  info(message: string, ctx?: LoggerContext) {
    this.log(chalk.white(message), this.getContextString(ctx));
  }

  warn(message: string, ctx?: LoggerContext) {
    this.log(
      chalk.yellow(message),
      this.getContextString(ctx, chalk.hex("#cc9602")),
    );
  }

  error(message: string, ctx?: LoggerContext): void;
  error(message: string, error: unknown, ctx?: LoggerContext): void;
  error(message: string, error: unknown, ctx?: LoggerContext) {
    let errorString: string | undefined;
    if (error instanceof Error) {
      errorString = error.stack;
    }

    const messageWithError = errorString
      ? `${message}\n\n${errorString}`
      : message;
    this.log(
      chalk.red(messageWithError),
      this.getContextString(ctx, chalk.red),
    );
  }
}

export const createLogger = (packageName: string) => new Logger(packageName);
