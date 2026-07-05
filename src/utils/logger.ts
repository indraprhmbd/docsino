import picocolors from 'picocolors';

const { dim, green, yellow, red, bold } = picocolors;

export type LogLevel = 'normal' | 'verbose' | 'quiet';
export type OutputMode = 'text' | 'json';

interface LoggerOptions {
  level: LogLevel;
  mode: OutputMode;
}

class Logger {
  private level: LogLevel;
  private mode: OutputMode;

  constructor(opts?: Partial<LoggerOptions>) {
    this.level = opts?.level ?? 'normal';
    this.mode = opts?.mode ?? 'text';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  info(msg: string): void {
    if (this.mode === 'json') return;
    if (this.level === 'quiet') return;
    console.log(msg);
  }

  verbose(msg: string): void {
    if (this.mode === 'json') return;
    if (this.level !== 'verbose') return;
    console.log(dim(msg));
  }

  success(msg: string): void {
    if (this.mode === 'json') return;
    if (this.level === 'quiet') return;
    console.log(green(msg));
  }

  warn(msg: string): void {
    if (this.mode === 'json') return;
    console.log(yellow(msg));
  }

  error(msg: string): void {
    if (this.mode === 'json') return;
    console.error(red(bold(msg)));
  }

  json(data: unknown): void {
    if (this.mode !== 'json') return;
    console.log(JSON.stringify(data));
  }
}

export const logger = new Logger();
