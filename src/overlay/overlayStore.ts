import { createStore } from '../lib/store';
import { basePhotoIds, photoMap, seriesList, seriesMap } from '../data/base';
import type { FieldKey, Photo } from '../data/types';

export const OVERLAY_STORAGE_KEY = 'portfolio-overlay-v1';
export const OVERLAY_VERSION = 1;

export type SeriesOverlay = {
  summary?: string;
  coverPhotoId?: string;
  photoOrder?: string[];
};

/** 字段级冲突：同一字段两边都改过，保留两份等待选择 */
export type Conflict = {
  id: string;
  seriesId: string;
  field: FieldKey;
  base: unknown;
  local: unknown; // 本地（overlay 中已存在）的改动
  remote: unknown; // 对方标签页提交的改动
  draftId: string;
  createdAt: number;
};

export type OverlayState = {
  version: number;
  series: Record<string, SeriesOverlay>;
  conflicts: Conflict[];
};

const initialState: OverlayState = {
  version: OVERLAY_VERSION,
  series: {},
  conflicts: [],
};

export const overlayStore = createStore<OverlayState>(initialState, OVERLAY_STORAGE_KEY);

// ---------- 派生数据：在原始数据上应用覆盖层 ----------

export type EffectiveSeries = {
  id: string;
  title: string;
  category: string;
  summary: string;
  coverPhotoId: string;
  photoOrder: string[];
  modifiedFields: FieldKey[];
};

export function effectiveSeries(seriesId: string, state: OverlayState = overlayStore.getState()): EffectiveSeries {
  const base = seriesMap.get(seriesId);
  if (!base) throw new Error(`unknown series: ${seriesId}`);
  const ov: SeriesOverlay = state.series[seriesId] ?? {};
  const order = ov.photoOrder && ov.photoOrder.length > 0 ? ov.photoOrder : base.photoIds;
  return {
    id: base.id,
    title: base.title,
    category: base.category,
    summary: ov.summary ?? base.summary,
    coverPhotoId: ov.coverPhotoId ?? base.photoIds[0],
    photoOrder: order,
    modifiedFields: (['summary', 'coverPhotoId', 'photoOrder'] as FieldKey[]).filter((f) => {
      const v = ov[f];
      return v !== undefined && v !== null;
    }),
  };
}

export function effectivePhotos(seriesId: string, state?: OverlayState): Photo[] {
  const s = effectiveSeries(seriesId, state);
  return s.photoOrder
    .map((id) => photoMap.get(id))
    .filter((p): p is Photo => !!p && p.seriesId === seriesId);
}

/** 全部作品：按系列顺序、系列内按（覆盖后的）顺序排列 */
export function allEffectivePhotos(state?: OverlayState): Photo[] {
  const st = state ?? overlayStore.getState();
  return seriesList.flatMap((s) => effectivePhotos(s.id, st));
}

// ---------- 字段读写 ----------

export function getFieldValue(seriesId: string, field: FieldKey, state: OverlayState = overlayStore.getState()): unknown {
  const s = effectiveSeries(seriesId, state);
  return s[field];
}

export function setFieldValue(seriesId: string, field: FieldKey, value: unknown) {
  overlayStore.setState((st) => {
    const prev = st.series[seriesId] ?? {};
    const next: SeriesOverlay = { ...prev };
    if (field === 'summary') next.summary = value as string;
    else if (field === 'coverPhotoId') next.coverPhotoId = value as string;
    else if (field === 'photoOrder') next.photoOrder = value as string[];
    const series = { ...st.series, [seriesId]: next };
    return { ...st, series };
  });
}

export function clearField(seriesId: string, field: FieldKey) {
  overlayStore.setState((st) => {
    const prev = st.series[seriesId] ?? {};
    const next: SeriesOverlay = { ...prev };
    delete next[field];
    const series = { ...st.series, [seriesId]: next };
    return { ...st, series };
  });
}

// ---------- 冲突处理 ----------

export function addConflicts(newConflicts: Conflict[]) {
  if (newConflicts.length === 0) return;
  overlayStore.setState((st) => {
    // 同一系列同一字段只保留一份冲突（避免多标签页重复上报）
    const seen = new Set(st.conflicts.map((c) => `${c.seriesId}:${c.field}`));
    const merged = [...st.conflicts];
    for (const c of newConflicts) {
      const key = `${c.seriesId}:${c.field}`;
      if (!seen.has(key)) {
        merged.push(c);
        seen.add(key);
      }
    }
    return { ...st, conflicts: merged };
  });
}

export function removeConflict(conflictId: string) {
  overlayStore.setState((st) => ({
    ...st,
    conflicts: st.conflicts.filter((c) => c.id !== conflictId),
  }));
}

/** 选择保留本地或采用对方后，把选中的值写入覆盖层 */
export function resolveConflict(conflictId: string, choice: 'local' | 'remote') {
  const conflict = overlayStore.getState().conflicts.find((c) => c.id === conflictId);
  if (!conflict) return;
  const value = choice === 'local' ? conflict.local : conflict.remote;
  setFieldValue(conflict.seriesId, conflict.field, value);
  removeConflict(conflictId);
}

export { basePhotoIds };
