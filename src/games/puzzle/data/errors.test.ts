import { describe, expect, it } from 'vitest';
import { DataStoreError, isDataStoreError, toDataStoreError } from './errors';

function namedError(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe('toDataStoreError', () => {
  it('已归一化的错误原样返回', () => {
    const error = new DataStoreError('quota', '满了');
    expect(toDataStoreError(error)).toBe(error);
    expect(isDataStoreError(error)).toBe(true);
  });

  it('映射常见浏览器异常名', () => {
    expect(toDataStoreError(namedError('QuotaExceededError')).code).toBe('quota');
    expect(toDataStoreError(namedError('ConstraintError')).code).toBe('validation');
    expect(toDataStoreError(namedError('VersionError')).code).toBe('blocked');
    expect(toDataStoreError(namedError('SecurityError')).code).toBe('unavailable');
    expect(toDataStoreError(namedError('InvalidStateError')).code).toBe('unavailable');
  });

  it('未知异常使用 fallback，并保留 cause', () => {
    const source = namedError('UnknownError', '原始错误');
    const error = toDataStoreError(source, 'unknown');

    expect(error.code).toBe('unknown');
    expect(error.message).toBe('原始错误');
    expect(error.cause).toBe(source);
  });
});
