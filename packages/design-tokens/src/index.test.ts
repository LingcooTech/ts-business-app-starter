import { describe, expect, it } from 'vitest';

import { breakpoints, layers } from './index.js';

describe('design tokens', () => {
  it('keeps breakpoints and layers ordered', () => {
    expect(breakpoints.compact).toBeLessThan(breakpoints.medium);
    expect(breakpoints.medium).toBeLessThan(breakpoints.wide);
    expect(layers.dialog).toBeLessThan(layers.toast);
  });
});
