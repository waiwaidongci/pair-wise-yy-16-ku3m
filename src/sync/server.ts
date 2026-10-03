import type { EditableField } from "../data/types";
import type { FieldValue } from "./types";

/**
 * 前端模拟的“远端服务器”：用 localStorage 充当两个标签页之外的第三方存储，
 * 因此 A 标签页 flush 后，B 标签页通过 storage 事件能看到“服务器上”的新值。
 * 真实项目里这里替换成 fetch 调用即可，合并协议保持不变。
 */

const SERVER_KEY = "mira.server.v2";
const LOCK_KEY = "mira.server.lock.v2";

type Patch = Partial<Record<EditableField, FieldValue>>;
type ServerSeries = Record<string, Patch>;

interface ServerState {
  series: ServerSeries;
}

function read(): ServerState {
  try {
    const raw = localStorage.getItem(SERVER_KEY);
    if (raw) return JSON.parse(raw) as ServerState;
  } catch {
    /* 损坏的服务端缓存按空状态重建 */
  }
  return { series: {} };
}

function write(state: ServerState) {
  localStorage.setItem(SERVER_KEY, JSON.stringify(state));
}

/** 简单互斥锁，避免同一标签页内连续 flush 交叉写入。 */
async function withLock<T>(fn: () => T): Promise<T> {
  const token = `${Math.random().toString(36).slice(2)}:${Date.now()}`;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40; i += 1) {
    if (localStorage.getItem(LOCK_KEY) === null) {
      localStorage.setItem(LOCK_KEY, token);
      // 双读确认（storage 锁的惯用法）
      await wait(10);
      if (localStorage.getItem(LOCK_KEY) === token) {
        try {
          return fn();
        } finally {
          if (localStorage.getItem(LOCK_KEY) === token) {
            localStorage.removeItem(LOCK_KEY);
          }
        }
      }
    }
    await wait(25);
  }
  throw new Error("服务器繁忙，请稍后重试");
}

export interface RemoteAccept {
  outcome: "accept";
  value: FieldValue;
}

export interface RemoteConflict {
  outcome: "conflict";
  remoteValue: FieldValue;
}

export type RemoteResult = RemoteAccept | RemoteConflict;

export const mockServer = {
  /** 读取服务器上某个系列当前的覆盖补丁（含基础值合并视角由调用方处理）。 */
  getSeries(seriesId: string): Patch {
    return read().series[seriesId] ?? {};
  },

  onChange(handler: () => void): () => void {
    const listener = (e: StorageEvent) => {
      if (e.key === SERVER_KEY) handler();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  },

  /**
   * 提交一个字段的修改。三向合并：
   * - 本地未改（value === base）→ 采用服务器值；
   * - 服务器未改（server === base）→ 本地直接覆盖；
   * - 两边改成同一个值 → 幂等成功；
   * - 两边都改且不同 → 409，双方值都返回，留给摄影师选择。
   */
  async commitField(
    seriesId: string,
    field: EditableField,
    base: FieldValue,
    value: FieldValue,
  ): Promise<RemoteResult> {
    return withLock(() => {
      const state = read();
      const hasServer = field in (state.series[seriesId] ?? {});
      const serverValue = state.series[seriesId]?.[field];
      const same = (a: FieldValue, b: FieldValue) =>
        JSON.stringify(a) === JSON.stringify(b);

      if (!same(value, base)) {
        if (hasServer && serverValue !== undefined && !same(serverValue, base)) {
          if (same(serverValue, value)) {
            return { outcome: "accept" as const, value };
          }
          return {
            outcome: "conflict" as const,
            remoteValue: serverValue,
          };
        }
        const patch = (state.series[seriesId] ??= {});
        patch[field] = value;
        write(state);
      }
      return { outcome: "accept" as const, value };
    });
  },
};
