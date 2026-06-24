/**
 * Safely extracts a human-readable error message string from various formats.
 * Handles: plain strings, objects with nested message fields (e.g., { error: { message: "..." } }),
 * and JSON-stringified error objects that may be stored in the database.
 *
 * This function is shared between timeline-store.ts and notification-handlers.ts
 * to avoid code duplication.
 */
export function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    // Quick check: only try to parse if it looks like JSON
    if (value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          // Handle { error: { message: "..." } } format
          if (
            typeof parsed.error === 'object' &&
            parsed.error !== null &&
            typeof parsed.error.message === 'string'
          ) {
            return parsed.error.message;
          }
          // Handle { message: "..." } format
          if (typeof parsed.message === 'string') {
            return parsed.message;
          }
        }
      } catch {
        // Not valid JSON, use as-is
      }
    }
    return value;
  }
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return 'Error occurred (unable to extract details)';
    }
  }
  return 'Unknown error';
}
