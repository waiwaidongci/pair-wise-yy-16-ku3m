import type { Draft } from './draftStore';
import type { Conflict } from './overlayStore';

/** 多标签页同步：BroadcastChannel 不可用时静默降级（仅靠 storage 事件） */
export type SyncMessage =
  | { type: 'draft-created'; draft: Draft }
  | { type: 'overlay-changed'; seriesId?: string }
  | { type: 'conflict-created'; conflict: Conflict }
  | { type: 'conflict-resolved'; conflictId: string };

const CHANNEL_NAME = 'portfolio-overlay-sync';

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

export function broadcast(message: SyncMessage) {
  try {
    channel?.postMessage(message);
  } catch {
    /* 广播失败不影响本地流程 */
  }
}

export function onMessage(handler: (msg: SyncMessage) => void): () => void {
  if (!channel) return () => {};
  const listener = (e: MessageEvent) => handler(e.data as SyncMessage);
  channel.addEventListener('message', listener);
  return () => channel?.removeEventListener('message', listener);
}
