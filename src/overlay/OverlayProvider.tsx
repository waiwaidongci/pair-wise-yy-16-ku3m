import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FieldKey } from '../data/types';
import { seriesMap } from '../data/base';
import {
  type Conflict,
  type OverlayState,
  addConflicts,
  effectiveSeries,
  overlayStore,
  resolveConflict as resolveConflictInStore,
} from './overlayStore';
import {
  type Draft,
  addDraft,
  draftStore,
  migrateDraftsOnLoad,
  removeDraft,
  updateDraft,
} from './draftStore';
import { mergeDraftIntoOverlay, snapshotBase } from './merge';
import { broadcast, onMessage } from './syncChannel';
import { simulateSubmit } from './submit';

const FORCE_OFFLINE_KEY = 'portfolio-force-offline';
const OVERLAY_STORAGE_KEY = 'portfolio-overlay-v1';
const DRAFTS_STORAGE_KEY = 'portfolio-drafts-v1';

function readForceOffline(): boolean {
  try {
    return localStorage.getItem(FORCE_OFFLINE_KEY) === '1';
  } catch {
    return false;
  }
}

function readOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

type OverlayApi = {
  online: boolean;
  forceOffline: boolean;
  setForceOffline: (v: boolean) => void;
  overlay: OverlayState;
  drafts: Draft[];
  conflicts: Conflict[];
  /** 其他标签页正在编辑的系列（presence 提示） */
  remoteEditingSeries: string[];
  /** 创建一条编辑草稿：在线立即提交，离线留在本地队列，恢复后逐条合并 */
  createDraft: (seriesId: string, changes: Partial<Record<FieldKey, unknown>>) => Draft;
  retryDraft: (id: string) => void;
  resolveConflict: (conflictId: string, choice: 'local' | 'remote') => void;
  /** 把某字段恢复为原始值（同样走草稿流程，保证多标签页一致） */
  resetField: (seriesId: string, field: FieldKey) => void;
};

const Ctx = createContext<OverlayApi | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(readOnline());
  const [forceOffline, setForceOfflineState] = useState(readForceOffline);
  const [overlay, setOverlay] = useState<OverlayState>(() => overlayStore.getState());
  const [drafts, setDrafts] = useState<Draft[]>(() => draftStore.getState().drafts);
  const [remoteEditingSeries, setRemoteEditingSeries] = useState<string[]>([]);
  const processingRef = useRef<Set<string>>(new Set());

  // 订阅 store
  useEffect(() => {
    const sync = () => setOverlay(overlayStore.getState());
    sync();
    return overlayStore.subscribe(sync);
  }, []);
  useEffect(() => {
    const sync = () => setDrafts(draftStore.getState().drafts);
    sync();
    return draftStore.subscribe(sync);
  }, []);

  // 在线状态：系统事件 + 手动模拟离线
  useEffect(() => {
    const update = () => setOnline(readOnline() && !readForceOffline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [forceOffline]);

  const setForceOffline = useCallback((v: boolean) => {
    try {
      if (v) localStorage.setItem(FORCE_OFFLINE_KEY, '1');
      else localStorage.removeItem(FORCE_OFFLINE_KEY);
    } catch {
      /* ignore */
    }
    setForceOfflineState(v);
    setOnline(readOnline() && !v);
  }, []);

  // ---------- 草稿处理 ----------

  const applyMergeResult = useCallback((draft: Draft) => {
    const result = mergeDraftIntoOverlay(overlayStore.getState(), draft);
    overlayStore.setState(() => result.overlay);
    addConflicts(result.conflicts);
    if (result.conflicts.length > 0) {
      result.conflicts.forEach((c) => {
        console.info(`[overlay] 字段冲突已挂起等待选择: ${c.seriesId}.${c.field}`, c);
        broadcast({ type: 'conflict-created', conflict: c });
      });
    }
    broadcast({ type: 'overlay-changed', seriesId: draft.seriesId });
  }, []);

  const processDraft = useCallback(
    async (id: string) => {
      const draft = draftStore.getState().drafts.find((d) => d.id === id);
      if (!draft || processingRef.current.has(id)) return;
      if (draft.status === 'submitting') return;
      processingRef.current.add(id);
      updateDraft(id, { status: 'submitting', error: undefined });
      try {
        await simulateSubmit();
        // 提交成功：三方合并进覆盖层
        applyMergeResult(draft);
        removeDraft(id);
      } catch (e) {
        updateDraft(id, {
          status: 'failed',
          attempts: draft.attempts + 1,
          error: e instanceof Error ? e.message : '提交失败',
        });
      } finally {
        processingRef.current.delete(id);
      }
    },
    [applyMergeResult],
  );

  // 其他标签页创建的草稿（合并前先攒着，提交时一并三方合并）
  const remoteDraftsRef = useRef<Draft[]>([]);

  const mergeRemoteDrafts = useCallback(() => {
    const pending = remoteDraftsRef.current;
    remoteDraftsRef.current = [];
    if (pending.length === 0) return;
    for (const rd of pending) {
      const result = mergeDraftIntoOverlay(overlayStore.getState(), rd);
      overlayStore.setState(() => result.overlay);
      addConflicts(result.conflicts);
      result.conflicts.forEach((c) => broadcast({ type: 'conflict-created', conflict: c }));
    }
    broadcast({ type: 'overlay-changed' });
  }, []);

  // 恢复在线后：先合并其他标签页的待处理草稿，再逐条提交本地草稿
  const syncAndProcess = useCallback(() => {
    mergeRemoteDrafts();
    const queue = draftStore
      .getState()
      .drafts.filter((d) => d.status === 'pending' || d.status === 'submitting');
    queue.forEach((d) => {
      void processDraft(d.id);
    });
  }, [mergeRemoteDrafts, processDraft]);

  useEffect(() => {
    if (online) syncAndProcess();
  }, [online, syncAndProcess]);

  // 启动时升级旧草稿
  useEffect(() => {
    migrateDraftsOnLoad((seriesId) => {
      const fields: FieldKey[] = ['summary', 'coverPhotoId', 'photoOrder'];
      return snapshotBase(seriesId, fields, overlayStore.getState());
    });
  }, []);

  // ---------- 对外 API ----------

  const createDraft = useCallback(
    (seriesId: string, changes: Partial<Record<FieldKey, unknown>>): Draft => {
      const fields = Object.keys(changes) as FieldKey[];
      const base = snapshotBase(seriesId, fields, overlayStore.getState());
      const draft: Draft = {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        schemaVersion: 1,
        seriesId,
        changes,
        base,
        status: 'pending',
        attempts: 0,
        createdAt: Date.now(),
      };
      addDraft(draft);
      broadcast({ type: 'draft-created', draft });
      if (readOnline() && !readForceOffline()) {
        syncAndProcess();
      }
      return draft;
    },
    [processDraft, syncAndProcess],
  );

  const retryDraft = useCallback(
    (id: string) => {
      updateDraft(id, { status: 'pending', error: undefined });
      void processDraft(id);
    },
    [processDraft],
  );

  const resolveConflict = useCallback(
    (conflictId: string, choice: 'local' | 'remote') => {
      resolveConflictInStore(conflictId, choice);
      broadcast({ type: 'conflict-resolved', conflictId });
      broadcast({ type: 'overlay-changed' });
    },
    [],
  );

  const resetField = useCallback(
    (seriesId: string, field: FieldKey) => {
      const baseSeries = seriesMap.get(seriesId);
      if (!baseSeries) return;
      const value =
        field === 'summary'
          ? baseSeries.summary
          : field === 'coverPhotoId'
            ? baseSeries.photoIds[0]
            : baseSeries.photoIds;
      createDraft(seriesId, { [field]: value });
    },
    [createDraft],
  );

  // ---------- 多标签页同步 ----------

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'draft-created') {
        // 对方标签页的草稿：先攒着，提交时三方合并（未冲突字段自动并入，同字段冲突挂起）
        const exists = remoteDraftsRef.current.some((d) => d.id === msg.draft.id);
        if (!exists) remoteDraftsRef.current.push(msg.draft);
        const sid = msg.draft.seriesId;
        setRemoteEditingSeries((list) => (list.includes(sid) ? list : [...list, sid]));
        window.setTimeout(() => {
          setRemoteEditingSeries((list) => list.filter((x) => x !== sid));
        }, 8000);
        // 在线时立即合并对方草稿
        if (readOnline() && !readForceOffline()) mergeRemoteDrafts();
      } else if (msg.type === 'conflict-created') {
        // 对方提交时产生的字段冲突：两份都挂起等待选择
        addConflicts([msg.conflict]);
      } else if (msg.type === 'overlay-changed' || msg.type === 'conflict-resolved') {
        // 以 localStorage 中的最新状态为准重新读取
        setOverlay(overlayStore.getState());
      }
    });
    return off;
  }, []);

  // storage 事件兜底（部分环境 BroadcastChannel 不可用）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === OVERLAY_STORAGE_KEY) setOverlay(overlayStore.getState());
      if (e.key === DRAFTS_STORAGE_KEY) setDrafts(draftStore.getState().drafts);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value: OverlayApi = {
    online,
    forceOffline,
    setForceOffline,
    overlay,
    drafts,
    conflicts: overlay.conflicts,
    remoteEditingSeries,
    createDraft,
    retryDraft,
    resolveConflict,
    resetField,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOverlay(): OverlayApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
}

/** 便捷 hook：读取某系列的有效数据 */
export function useEffectiveSeries(seriesId: string) {
  const { overlay } = useOverlay();
  return effectiveSeries(seriesId, overlay);
}
