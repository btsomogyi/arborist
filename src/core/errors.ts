export class ScissorhandsError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ScissorhandsError';
    this.code = code;
    this.details = details;
  }
}

export class ParseError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

export class QueryError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUERY_ERROR', details);
    this.name = 'QueryError';
  }
}

export class EditError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'EDIT_ERROR', details);
    this.name = 'EditError';
  }
}

export class EditConflictError extends EditError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { ...details, code: 'EDIT_CONFLICT' });
    this.name = 'EditConflictError';
  }
}

export class ProviderError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROVIDER_ERROR', details);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class FileError extends ScissorhandsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}
