import { extractErrorMessage } from '../error-utils';

describe('extractErrorMessage', () => {
  describe('plain strings', () => {
    it('returns plain strings as-is', () => {
      expect(extractErrorMessage('test error')).toBe('test error');
    });

    it('returns empty string as-is', () => {
      expect(extractErrorMessage('')).toBe('');
    });

    it('returns non-JSON strings as-is', () => {
      expect(extractErrorMessage('not json')).toBe('not json');
    });
  });

  describe('JSON strings', () => {
    it('extracts message from { error: { message: "..." } }', () => {
      const input = JSON.stringify({ error: { message: 'nested error' } });
      expect(extractErrorMessage(input)).toBe('nested error');
    });

    it('extracts message from { message: "..." }', () => {
      const input = JSON.stringify({ message: 'direct message' });
      expect(extractErrorMessage(input)).toBe('direct message');
    });

    it('prioritizes error.message over message', () => {
      const input = JSON.stringify({
        message: 'direct message',
        error: { message: 'nested error' },
      });
      expect(extractErrorMessage(input)).toBe('nested error');
    });

    it('handles invalid JSON strings gracefully', () => {
      expect(extractErrorMessage('{invalid json')).toBe('{invalid json');
    });

    it('handles JSON strings without message fields', () => {
      const input = JSON.stringify({ foo: 'bar' });
      expect(extractErrorMessage(input)).toBe('{"foo":"bar"}');
    });
  });

  describe('Error instances', () => {
    it('extracts message from Error instances', () => {
      expect(extractErrorMessage(new Error('test error'))).toBe('test error');
    });

    it('handles Error with empty message', () => {
      expect(extractErrorMessage(new Error(''))).toBe('');
    });
  });

  describe('objects', () => {
    it('extracts message from objects with message field', () => {
      expect(extractErrorMessage({ message: 'object message' })).toBe('object message');
    });

    it('extracts message from nested error objects', () => {
      expect(
        extractErrorMessage({ error: { message: 'nested message' } }),
      ).toBe('nested message');
    });

    it('stringifies objects without message fields', () => {
      const result = extractErrorMessage({ foo: 'bar' });
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('handles empty objects', () => {
      const result = extractErrorMessage({});
      expect(result).toBe('{}');
    });
  });

  describe('null/undefined', () => {
    it('handles null', () => {
      expect(extractErrorMessage(null)).toBe('Unknown error');
    });

    it('handles undefined', () => {
      expect(extractErrorMessage(undefined)).toBe('Unknown error');
    });
  });

  describe('other types', () => {
    it('handles numbers', () => {
      expect(extractErrorMessage(42)).toBe('Unknown error');
    });

    it('handles booleans', () => {
      expect(extractErrorMessage(true)).toBe('Unknown error');
    });

    it('handles arrays', () => {
      const result = extractErrorMessage([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });
  });

  describe('edge cases', () => {
    it('handles deeply nested error objects', () => {
      const input = {
        error: {
          error: {
            message: 'deeply nested',
          },
        },
      };
      // Only one level of nesting is supported
      expect(extractErrorMessage(input)).toBe('Unknown error');
    });

    it('handles objects with non-string message', () => {
      expect(extractErrorMessage({ message: 123 })).toBe('Unknown error');
    });

    it('handles objects with null message', () => {
      expect(extractErrorMessage({ message: null })).toBe('Unknown error');
    });
  });
});
