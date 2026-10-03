import type { FieldKey } from '../data/types';
import type { Draft } from './draftStore';
import {
  type Conflict,
  type OverlayState,
  effectiveSeries,
} from './overlayStore';

export type MergeResult = {
  overlay: OverlayState;
  conflicts: Conflict[];
};

function isEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

function setField(state: OverlayState, seriesId: string, field: FieldKey, value: unknown): OverlayState {
  const prev = state.series[seriesId] ?? {};
  const next = { ...prev };
  if (field === 'summary') next.summary = value as string;
  else if (field === 'coverPhotoId') next.coverPhotoId = value as string;
  else if (field === 'photoOrder') next.photoOrder = value as string[];
  return { ...state, series: { ...state.series, [seriesId]: next } };
}

/**
 * 三方合并：把一条草稿的改动合并进当前 overlay。
 * - 当前值 == 基线：本地没动过 → 直接采用草稿的值（fast-forward）
 * - 当前值 == 草稿值：已应用过 → 幂等跳过
 * - 否则：同一字段两边都改过 → 记录冲突，留两份等待选择
 */
export function mergeDraftIntoOverlay(prevState: OverlayState, draft: Draft): MergeResult {
  let state: OverlayState = { ...prevState, series: { ...prevState.series } };
  const conflicts: Conflict[] = [];

  for (const [field, remoteValue] of Object.entries(draft.changes) as [FieldKey, unknown][]) {
    const baseValue = draft.base[field];
    const localValue = effectiveSeries(draft.seriesId, state)[field];

    if (isEqual(localValue, baseValue)) {
      state = setField(state, draft.seriesId, field, remoteValue);
    } else if (isEqual(localValue, remoteValue)) {
      // 已合并，跳过
    } else {
      conflicts.push({
        id: `conflict:${draft.id}:${field}`,
        seriesId: draft.seriesId,
        field,
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        draftId: draft.id,
        createdAt: Date.now(),
      });
    }
  }

  return { overlay: state, conflicts };
}

/** 字段的基线值（effective 值），用于新建草稿时记录 */
export function snapshotBase(seriesId: string, fields: FieldKey[], state: OverlayState): Draft['base'] {
  const s = effectiveSeries(seriesId, state);
  const base: Draft['base'] = {};
  for (const f of fields) base[f] = s[f];
  return base;
}
