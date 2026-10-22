import { describe, expect, it } from 'vitest';
import { DataStoreError } from './errors';
import {
  createMemoryStorage,
  readJsonResult,
  writeJson,
  type StorageAdapter,
} from './local-storage';

describe('createMemoryStorage', () => {
  it('支持读写、删除和枚举键', () => {
    const storage = createMemoryStorage({ existing: 'value' });

    expect(storage.get('existing')).toBe('value');
    expect(storage.keys()).toEqual(['existing']);

    storage.set('next', '1');
    expect(storage.get('next')).toBe('1');
    expect(storage.keys()).toEqual(['existing', 'next']);

    storage.remove('existing');
    expect(storage.get('existing')).toBeNull();
    expect(storage.keys()).toEqual(['next']);
  });
});

describe('readJsonResult / writeJson', () => {
  it('往返读写 JSON', () => {
    const storage = createMemoryStorage();
    const value = { version: 2, data: { name: '测试' } };

    writeJson(storage, 'key', value);

    expect(readJsonResult(storage, 'key')).toEqual({ status: 'ok', value });
  });

  it('区分缺失键和损坏 JSON', () => {
    const storage = createMemoryStorage({ broken: 'not-json' });

    expect(readJsonResult(storage, 'missing')).toEqual({ status: 'missing' });
    expect(readJsonResult(storage, 'broken')).toEqual({ status: 'corrupt' });
  });

  it('循环引用转换为 validation 错误', () => {
    const storage = createMemoryStorage();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expectDataStoreError(() => writeJson(storage, 'key', circular), 'validation');
  });

  it('写入配额错误转换为 quota', () => {
    const storage: StorageAdapter = {
      get: () => null,
      set: () => {
        const error = new Error('quota full');
        error.name = 'QuotaExceededError';
        throw error;
      },
      remove: () => undefined,
      keys: () => [],
    };

    expectDataStoreError(() => writeJson(storage, 'key', {}), 'quota');
  });

  it('读取存储错误返回 unavailable，和损坏 JSON 区分', () => {
    const storage: StorageAdapter = {
      get: () => {
        throw new DataStoreError('unavailable', '不可用');
      },
      set: () => undefined,
      remove: () => undefined,
      keys: () => [],
    };

    expect(readJsonResult(storage, 'key')).toEqual({ status: 'unavailable' });
  });
});

function expectDataStoreError(action: () => void, code: DataStoreError['code']): void {
  try {
    action();
    throw new Error('预期抛出 DataStoreError');
  } catch (error) {
    expect(error).toBeInstanceOf(DataStoreError);
    expect((error as DataStoreError).code).toBe(code);
  }
}
