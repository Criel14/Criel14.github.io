import type { ReplayRecord } from '../types';
import { getDB } from './db';
import { toDataStoreError } from './errors';
import { decodeReplay, isStoredReplayV2 } from './replay-codec';

/**
 * 读取一条录像。
 *
 * 缺失、格式损坏或 scoreId 不匹配都返回 null；IndexedDB 不可用等
 * 存储级错误继续抛出，页面可以据此显示“存储不可用”而不是“录像为空”。
 */
export async function loadReplay(scoreId: string): Promise<ReplayRecord | null> {
  if (typeof scoreId !== 'string' || scoreId.length === 0) {
    return null;
  }

  try {
    const database = await getDB();
    const stored = await database.get('replays', scoreId);
    if (!isStoredReplayV2(stored)) {
      return null;
    }

    const replay = decodeReplay(stored);
    return replay !== null && replay.scoreId === scoreId ? replay : null;
  } catch (error) {
    throw toDataStoreError(error, 'unknown');
  }
}
