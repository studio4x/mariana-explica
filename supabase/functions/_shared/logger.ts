export type LogLevel = "debug" | "info" | "warn" | "error"

function writeLog(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  console[level](
    JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }),
  )
}

export function logInfo(message: string, context: Record<string, unknown> = {}) {
  writeLog("info", message, context)
}

export function logWarn(message: string, context: Record<string, unknown> = {}) {
  writeLog("warn", message, context)
}

export function logError(message: string, context: Record<string, unknown> = {}) {
  writeLog("error", message, context)
}

