/** 数据层统一错误码；页面只依赖这些语义，不直接依赖浏览器异常名。 */
export type DataStoreErrorCode =
  'unavailable' | 'blocked' | 'quota' | 'validation' | 'corrupt' | 'unknown';

export interface DataStoreErrorOptions {
  readonly cause?: unknown;
}

/**
 * 浏览器存储异常的统一包装。
 *
 * localStorage 和 IndexedDB 在隐私模式、配额、其他标签页升级等场景下
 * 抛出的异常名并不一致；数据层先归一化，页面再决定提示方式。
 */
export class DataStoreError extends Error {
  readonly code: DataStoreErrorCode;

  constructor(code: DataStoreErrorCode, message: string, options: DataStoreErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DataStoreError';
    this.code = code;
  }
}

export function isDataStoreError(value: unknown): value is DataStoreError {
  return value instanceof DataStoreError;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 把原生异常转换为 DataStoreError。
 * 已经归一化过的错误原样返回，避免丢失更具体的错误码。
 */
export function toDataStoreError(
  error: unknown,
  fallback: DataStoreErrorCode = 'unknown',
): DataStoreError {
  if (isDataStoreError(error)) {
    return error;
  }

  const name = getErrorName(error);
  if (name === 'QuotaExceededError') {
    return new DataStoreError('quota', '浏览器存储配额不足', { cause: error });
  }
  if (name === 'ConstraintError') {
    return new DataStoreError('validation', '数据违反存储约束（例如主键重复）', {
      cause: error,
    });
  }
  if (name === 'VersionError') {
    return new DataStoreError('blocked', '数据库版本不兼容或连接被其他标签页阻塞', {
      cause: error,
    });
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return new DataStoreError('unavailable', '浏览器存储不可用', { cause: error });
  }

  return new DataStoreError(fallback, getErrorMessage(error) || '浏览器存储操作失败', {
    cause: error,
  });
}
