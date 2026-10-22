import { DataStoreError, toDataStoreError } from './errors';

/**
 * 同步存储的最小接口。
 * 页面和 core 不直接操作 localStorage；测试可以注入内存实现。
 */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

function getLocalStorage(): Storage {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      throw new DataStoreError('unavailable', '当前环境没有 localStorage');
    }
    return storage;
  } catch (error) {
    throw toDataStoreError(error, 'unavailable');
  }
}

/** 包装真实 localStorage；每次操作都重新取引用，避免缓存失效的连接。 */
export function createLocalStorage(): StorageAdapter {
  return {
    get(key) {
      try {
        return getLocalStorage().getItem(key);
      } catch (error) {
        throw toDataStoreError(error, 'unavailable');
      }
    },
    set(key, value) {
      try {
        getLocalStorage().setItem(key, value);
      } catch (error) {
        throw toDataStoreError(error, 'unavailable');
      }
    },
    remove(key) {
      try {
        getLocalStorage().removeItem(key);
      } catch (error) {
        throw toDataStoreError(error, 'unavailable');
      }
    },
    keys() {
      try {
        const storage = getLocalStorage();
        const result: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key !== null) {
            result.push(key);
          }
        }
        return result;
      } catch (error) {
        throw toDataStoreError(error, 'unavailable');
      }
    },
  };
}

/** 内存实现；用于单元测试和旧数据清理的隔离测试。 */
export function createMemoryStorage(
  initial: Readonly<Record<string, string>> = {},
): StorageAdapter {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    get(key) {
      return values.get(key) ?? null;
    },
    set(key, value) {
      values.set(key, value);
    },
    remove(key) {
      values.delete(key);
    },
    keys() {
      return [...values.keys()];
    },
  };
}

/** 读取 localStorage 的结果状态；页面据此决定是否提示用户。 */
export type StorageReadStatus = 'ok' | 'missing' | 'corrupt' | 'unavailable';

/**
 * 读取并解析 JSON 的结果。
 * ok 时 value 是解析后的任意 JSON；其余状态没有可用值。
 */
export type JsonReadResult =
  | { readonly status: 'ok'; readonly value: unknown }
  | { readonly status: 'missing' | 'corrupt' | 'unavailable' };

/**
 * 读取并解析 JSON，同时保留“缺失 / 损坏 / 不可用”的区别。
 * 存储访问错误不再向上抛，由页面根据 unavailable 状态统一提示。
 */
export function readJsonResult(storage: StorageAdapter, key: string): JsonReadResult {
  let raw: string | null;
  try {
    raw = storage.get(key);
  } catch {
    return { status: 'unavailable' };
  }

  if (raw === null) {
    return { status: 'missing' };
  }

  try {
    return { status: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { status: 'corrupt' };
  }
}

/** 序列化并写入 JSON；序列化或写入失败转换为 DataStoreError。 */
export function writeJson(storage: StorageAdapter, key: string, value: unknown): void {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new DataStoreError('validation', '数据无法序列化为 JSON', { cause: error });
  }

  if (serialized === undefined) {
    throw new DataStoreError('validation', '数据无法序列化为 JSON');
  }

  try {
    storage.set(key, serialized);
  } catch (error) {
    throw toDataStoreError(error, 'unavailable');
  }
}
