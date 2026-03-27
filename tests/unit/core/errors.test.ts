import { describe, it, expect } from 'vitest';
import {
  ScissorhandsError,
  ParseError,
  QueryError,
  EditError,
  EditConflictError,
  ProviderError,
  ValidationError,
  FileError,
} from '../../../src/core/errors.js';

describe('ScissorhandsError', () => {
  it('sets name, code, and message', () => {
    const err = new ScissorhandsError('something went wrong', 'TEST_ERROR');
    expect(err.name).toBe('ScissorhandsError');
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('something went wrong');
    expect(err.details).toBeUndefined();
  });

  it('carries details bag', () => {
    const details = { file: 'test.ts', line: 42 };
    const err = new ScissorhandsError('fail', 'TEST', details);
    expect(err.details).toEqual(details);
  });

  it('is an instance of Error', () => {
    const err = new ScissorhandsError('fail', 'X');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ScissorhandsError);
  });
});

describe('ParseError', () => {
  it('has correct name and code', () => {
    const err = new ParseError('parse failed');
    expect(err.name).toBe('ParseError');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.message).toBe('parse failed');
  });

  it('is instanceof ScissorhandsError and Error', () => {
    const err = new ParseError('fail');
    expect(err).toBeInstanceOf(ScissorhandsError);
    expect(err).toBeInstanceOf(Error);
  });

  it('carries details', () => {
    const err = new ParseError('fail', { file: 'x.ts' });
    expect(err.details).toEqual({ file: 'x.ts' });
  });
});

describe('QueryError', () => {
  it('has correct name and code', () => {
    const err = new QueryError('query failed');
    expect(err.name).toBe('QueryError');
    expect(err.code).toBe('QUERY_ERROR');
  });

  it('is instanceof ScissorhandsError', () => {
    expect(new QueryError('fail')).toBeInstanceOf(ScissorhandsError);
  });
});

describe('EditError', () => {
  it('has correct name and code', () => {
    const err = new EditError('edit failed');
    expect(err.name).toBe('EditError');
    expect(err.code).toBe('EDIT_ERROR');
  });

  it('is instanceof ScissorhandsError', () => {
    expect(new EditError('fail')).toBeInstanceOf(ScissorhandsError);
  });
});

describe('EditConflictError', () => {
  it('has correct name', () => {
    const err = new EditConflictError('overlapping edits');
    expect(err.name).toBe('EditConflictError');
  });

  it('is instanceof EditError and ScissorhandsError', () => {
    const err = new EditConflictError('fail');
    expect(err).toBeInstanceOf(EditError);
    expect(err).toBeInstanceOf(ScissorhandsError);
    expect(err).toBeInstanceOf(Error);
  });

  it('merges EDIT_CONFLICT into details', () => {
    const err = new EditConflictError('fail', { range: '10-20' });
    expect(err.details).toEqual({ range: '10-20', code: 'EDIT_CONFLICT' });
  });
});

describe('ProviderError', () => {
  it('has correct name and code', () => {
    const err = new ProviderError('no provider');
    expect(err.name).toBe('ProviderError');
    expect(err.code).toBe('PROVIDER_ERROR');
  });

  it('is instanceof ScissorhandsError', () => {
    expect(new ProviderError('fail')).toBeInstanceOf(ScissorhandsError);
  });
});

describe('ValidationError', () => {
  it('has correct name and code', () => {
    const err = new ValidationError('invalid input');
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('is instanceof ScissorhandsError', () => {
    expect(new ValidationError('fail')).toBeInstanceOf(ScissorhandsError);
  });
});

describe('FileError', () => {
  it('has correct name and code', () => {
    const err = new FileError('file not found');
    expect(err.name).toBe('FileError');
    expect(err.code).toBe('FILE_ERROR');
  });

  it('is instanceof ScissorhandsError', () => {
    expect(new FileError('fail')).toBeInstanceOf(ScissorhandsError);
  });

  it('carries file details', () => {
    const err = new FileError('not found', { path: '/missing.ts' });
    expect(err.details).toEqual({ path: '/missing.ts' });
  });
});
