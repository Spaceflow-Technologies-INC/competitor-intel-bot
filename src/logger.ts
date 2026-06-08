export type Logger = {
  info(input: unknown, message?: string): void;
  warn(input: unknown, message?: string): void;
  error(input: unknown, message?: string): void;
};

export function createLogger(): Logger {
  return {
    info: (input, message) => writeLog("info", input, message),
    warn: (input, message) => writeLog("warn", input, message),
    error: (input, message) => writeLog("error", input, message)
  };
}

function writeLog(level: string, input: unknown, message?: string): void {
  const payload = {
    level,
    message,
    input,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(payload));
}
