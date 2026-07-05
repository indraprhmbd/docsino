import { describe, it, expect } from 'vitest';

import { tokenize, tokenizeWithWeights } from '../../src/utils/tokenizer';

describe('tokenize', () => {
  it('splits on non-alphanumeric', () => {
    const result = tokenize('hello-world foo_bar');
    expect(result).toEqual(['hello', 'world', 'foo', 'bar']);
  });

  it('lowercases', () => {
    const result = tokenize('Hello World');
    expect(result).toEqual(['hello', 'world']);
  });

  it('filters short tokens', () => {
    const result = tokenize('a an the cat');
    expect(result).toEqual(['cat']);
  });

  it('filters stop words', () => {
    const result = tokenize('the and for with');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('tokenizeWithWeights', () => {
  it('boosts heading tokens', () => {
    const result = tokenizeWithWeights('# Hello World');
    const hello = result.filter((t) => t === 'hello');
    expect(hello.length).toBeGreaterThanOrEqual(3);
  });

  it('boosts code fence tokens', () => {
    const result = tokenizeWithWeights('use `createUser` function');
    const createUser = result.filter((t) => t === 'createuser');
    expect(createUser.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts import paths', () => {
    const result = tokenizeWithWeights('import { foo } from "./bar/baz"');
    const bar = result.filter((t) => t === 'bar');
    expect(bar.length).toBeGreaterThanOrEqual(2);
  });
});
