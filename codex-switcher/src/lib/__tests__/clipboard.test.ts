import { describe, it, expect } from 'vitest';
import { buildCopyText } from '../clipboard';
import { makeAccount } from '../../test/factories';

describe('buildCopyText', () => {
  it('returns email when present', () => {
    const account = makeAccount({ email: 'work@example.com', label: 'Work' });
    expect(buildCopyText(account)).toBe('work@example.com');
  });

  it('falls back to label when email is empty', () => {
    const account = makeAccount({ email: '', label: 'Personal' });
    expect(buildCopyText(account)).toBe('Personal');
  });

  it('falls back to label when email is whitespace', () => {
    const account = makeAccount({ email: '   ', label: 'Work' });
    expect(buildCopyText(account)).toBe('Work');
  });
});
