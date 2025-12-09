// Structured logging with trace_id and log levels

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  traceId?: string;
  userId?: string;
  organizationId?: string;
  serviceId?: string;
  [key: string]: any;
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logLevel: LogLevel;
  private traceIdGenerator: () => string;

  constructor() {
    // Default log level from environment or 'info'
    // In Cloudflare Workers, use globalThis or env vars
    let envLogLevel: LogLevel | undefined;
    if (typeof process !== 'undefined' && process.env) {
      envLogLevel = process.env.LOG_LEVEL as LogLevel;
    }
    this.logLevel = envLogLevel || 'info';
    
    // Simple trace ID generator (in production, use proper UUID)
    this.traceIdGenerator = () => {
      return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    };
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Generate a trace ID
   */
  generateTraceId(): string {
    return this.traceIdGenerator();
  }

  /**
   * Log a message with structured format
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId: context?.traceId,
      context: context ? { ...context } : undefined,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Remove traceId from context if it's already in root
    if (logEntry.context && logEntry.context.traceId) {
      delete logEntry.context.traceId;
    }

    // Output based on level
    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'debug':
        console.log(logString);
        break;
      case 'info':
        console.log(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warn level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Create a child logger with a trace ID
   */
  withTrace(traceId: string): Logger {
    const childLogger = Object.create(Object.getPrototypeOf(this));
    childLogger.logLevel = this.logLevel;
    childLogger.traceIdGenerator = this.traceIdGenerator;
    
    // Override log method to always include traceId
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, context?: LogContext, error?: Error) => {
      const contextWithTrace = { ...context, traceId };
      originalLog(level, message, contextWithTrace, error);
    };

    // Copy other methods
    childLogger.setLogLevel = this.setLogLevel.bind(childLogger);
    childLogger.getLogLevel = this.getLogLevel.bind(childLogger);
    childLogger.generateTraceId = this.generateTraceId.bind(childLogger);
    childLogger.debug = this.debug.bind(childLogger);
    childLogger.info = this.info.bind(childLogger);
    childLogger.warn = this.warn.bind(childLogger);
    childLogger.error = this.error.bind(childLogger);

    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for custom instances
export { Logger };
