import { createStore } from '../lib/store';
import type { FieldKey } from '../data/types';
import { OVERLAY_VERSION } from './overlayStore';

export const DRAFTS_STORAGE_KEY = 'portfolio-drafts-v1';

export type DraftStatus = 'pending' | 'submitting' | 'failed';

export type Draft = {
  id: string;
  schemaVersion: number;
  seriesId: string;
  changes: Partial<Record<FieldKey, unknown>>;
  /** 创建草稿时各字段的基线值（effective 值），用于三方合并 */
  base: Partial<Record<FieldKey, unknown>>;
  status: DraftStatus;
  attempts: number;
  error?: string;
  createdAt: number;
};

type DraftsState = {
  version: number;
  drafts: Draft[];
};

const initialState: DraftsState = { version: OVERLAY_VERSION, drafts: [] };

export const draftStore = createStore<DraftsState>(initialState, DRAFTS_STORAGE_KEY);

export function addDraft(draft: Draft) {
  draftStore.setState((st) => ({ ...st, drafts: [...st.drafts, draft] }));
}

export function updateDraft(id: string, patch: Partial<Draft>) {
  draftStore.setState((st) => ({
    ...st,
    drafts: st.drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  }));
}

export function removeDraft(id: string) {
  draftStore.setState((st) => ({ ...st, drafts: st.drafts.filter((d) => d.id !== id) }));
}

export function getDraft(id: string): Draft | undefined {
  return draftStore.getState().drafts.find((d) => d.id === id);
}

// ---------- 旧草稿升级（迁移） ----------

/** 旧版本（"便签时代"）草稿结构，升级后继续处理 */
type LegacyDraft = {
  id?: string;
  seriesId?: string;
  summary?: string;
  cover?: string;
  order?: string[];
  ts?: number;
  status?: 'pending' | 'failed' | 'done';
};

function migrateLegraft(raw: unknown): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const legacy = raw as LegacyDraft;
  if (!legacy.seriesId || !legacy.id) return null;
  if (legacy.status === 'done') return null; // 已完成的旧草稿不再处理
  const changes: Draft['changes'] = {};
  if (typeof legacy.summary === 'string') changes.summary = legacy.summary;
  if (typeof legacy.cover === 'string') changes.coverPhotoId = legacy.cover;
  if (Array.isArray(legacy.order)) changes.photoOrder = legacy.order;
  if (Object.keys(changes).length === 0) return null;
  return {
    id: legacy.id,
    schemaVersion: OVERLAY_VERSION,
    seriesId: legacy.seriesId,
    changes,
    base: {}, // 旧草稿无基线，迁移时按当前 overlay 作为基线（见 migrateDrafts）
    status: legacy.status === 'failed' ? 'failed' : 'pending',
    attempts: 0,
    createdAt: legacy.ts ?? Date.now(),
  };
}

/** 启动时调用：把旧版本存储里的草稿升级到当前 schema */
export function migrateDraftsOnLoad(currentOverlayBase: (seriesId: string) => Draft['base']) {
  let legacyRaw: string | null = null;
  try {
    legacyRaw = localStorage.getItem('portfolio-drafts-v0');
  } catch {
    return;
  }
  if (!legacyRaw) return;
  try {
    const parsed = JSON.parse(legacyRaw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const migrated: Draft[] = [];
    for (const item of list) {
      const d = migrateLegraft(item);
      if (!d) continue;
      // 以当前 overlay 有效值作为基线：旧改动相对当前状态做合并
      d.base = currentOverlayBase(d.seriesId);
      migrated.push(d);
    }
    if (migrated.length > 0) {
      draftStore.setState((st) => {
        const existing = new Set(st.drafts.map((x) => x.id));
        const merged = [...st.drafts];
        for (const d of migrated) {
          if (!existing.has(d.id)) merged.push(d);
        }
        return { ...st, drafts: merged };
      });
    }
    localStorage.removeItem('portfolio-drafts-v0');
    console.info(`[drafts] 已升级 ${migrated.length} 条旧草稿到 schema v${OVERLAY_VERSION}`);
  } catch (e) {
    console.warn('[drafts] 旧草稿升级失败', e);
  }
}
