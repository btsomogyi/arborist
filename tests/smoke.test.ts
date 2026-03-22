import { describe, it, expect } from 'vitest';
import { version } from '../src/version.js';

describe('smoke test', () => {
  it('exports a version string', () => {
    expect(version).toBe('0.1.0');
  });
});
