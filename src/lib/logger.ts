// Security: Secure logger that prevents sensitive data exposure in production
// Only logs in development mode, sanitizes data, and can integrate with error tracking services

const isDevelopment = import.meta.env.DEV;

interface LoggerConfig {
  enableConsole: boolean;
  enableErrorTracking: boolean;
  maxStringLength: number;
}

const config: LoggerConfig = {
  enableConsole: isDevelopment,
  enableErrorTracking: !isDevelopment,
  maxStringLength: 1000
};

// Sanitize sensitive data before logging
const sanitizeData = (data: any): any => {
  if (!data) return data;

  // Don't sanitize in development for debugging
  if (isDevelopment) return data;

  if (typeof data === 'string') {
    // Truncate long strings
    if (data.length > config.maxStringLength) {
      return data.substring(0, config.maxStringLength) + '... [truncated]';
    }

    // Mask potential PII patterns
    return data
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\bhttps?:\/\/[^\s]+linkedin[^\s]*/gi, '[LINKEDIN_URL]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{16}\b/g, '[CARD]');
  }

  if (typeof data === 'object') {
    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      // Skip sensitive keys entirely
      if (/password|secret|token|key|credential/i.test(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = sanitizeData(data[key]);
    }

    return sanitized;
  }

  return data;
};

// Send to error tracking service (Sentry, LogRocket, etc.)
const sendToErrorTracking = (level: string, message: string, data?: any) => {
  if (!config.enableErrorTracking) return;

  // TODO: Integrate with your error tracking service
  // Example: Sentry.captureMessage(message, { level, extra: data });

  // For now, just a placeholder
  console.warn('[Error Tracking Placeholder]', { level, message, data });
};

export const logger = {
  log: (message: string, ...args: any[]) => {
    if (config.enableConsole) {
      console.log(message, ...args.map(sanitizeData));
    }
  },

  info: (message: string, ...args: any[]) => {
    if (config.enableConsole) {
      console.info(message, ...args.map(sanitizeData));
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (config.enableConsole) {
      console.warn(message, ...args.map(sanitizeData));
    }
    sendToErrorTracking('warning', message, args);
  },

  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    const sanitizedArgs = args.map(sanitizeData);

    if (config.enableConsole) {
      console.error(message, error, ...sanitizedArgs);
    }

    // Always send errors to tracking in production
    if (error instanceof Error) {
      sendToErrorTracking('error', `${message}: ${error.message}`, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...sanitizedArgs
      });
    } else {
      sendToErrorTracking('error', message, { error, ...sanitizedArgs });
    }
  },

  debug: (message: string, ...args: any[]) => {
    // Debug only in development
    if (isDevelopment) {
      console.debug(message, ...args);
    }
  },

  // Security audit trail - always log security events
  security: (event: string, details: any) => {
    const sanitizedDetails = sanitizeData(details);

    console.warn(`[SECURITY] ${event}`, sanitizedDetails);
    sendToErrorTracking('warning', `Security Event: ${event}`, sanitizedDetails);
  }
};

export default logger;
