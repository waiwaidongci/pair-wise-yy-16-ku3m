import type { EditableField } from "../data/types";

export const OVERLAY_VERSION = 2 as const;
/** 最近一次可识别的旧草稿结构版本（用于演示“旧草稿升级后继续处理”）。 */
export const LEGACY_VERSION = 1 as const;

export type FieldValue = string | string[];

/** 经过覆盖层解析后的某一系列视图（UI 只读这一份）。 */
export interface SeriesView {
  id: string;
  title: string;
  summary: string;
  coverId: string;
  /** 已按当前顺序解析好的照片 id。 */
  photoIds: string[];
  category: string;
}

/** 一个字段上的双方保留值（等待摄影师二选一）。 */
export interface FieldConflict {
  /** 服务器（另一个标签页）一侧的值。 */
  remote: FieldValue;
  /** 本标签页离线一侧的值。 */
  local: FieldValue;
}

export type Conflicts = Partial<Record<EditableField, FieldConflict>>;

/** 待提交的修改（一条草稿操作）。base 为三向合并所需的共同祖先。 */
export interface QueuedEdit {
  id: string;
  seriesId: string;
  field: EditableField;
  base: FieldValue;
  value: FieldValue;
  clientId: string;
  createdAt: number;
  /** 最近一次提交失败原因，存在即表示“保留草稿、可重试”。 */
  lastError?: string;
  attempts: number;
}

/**
 * 持久化草稿格式。version=1 的旧草稿用 title/note/cover/ids 等旧字段名，
 * 加载时统一升级到当前结构后继续处理。
 */
export interface PersistedDraftV1 {
  id: string;
  series: string;
  client?: string;
  created?: number;
  title?: string;
  note?: string;
  cover?: string;
  ids?: string[];
  base?: Record<string, FieldValue>;
}

export interface PersistedOverlayV1 {
  version: 1;
  clientId?: string;
  /** 旧版本把已提交覆盖值直接平铺在这里。 */
  committed?: Record<string, Partial<Record<EditableField, FieldValue>>>;
  pending?: PersistedDraftV1[];
  conflicts?: Record<string, Conflicts>;
}

export interface PersistedOverlay {
  version: typeof OVERLAY_VERSION;
  clientId: string;
  /** 待提交草稿（sessionStorage，按标签页隔离）。 */
  pending: QueuedEdit[];
  /** 解决中的字段冲突（sessionStorage，按标签页隔离）。 */
  conflicts: Record<string, Conflicts>;
}

export type SyncStatus = "online" | "offline" | "error";

export interface FlushResult {
  ok: boolean;
  /** 本次仍留在队列里的草稿（冲突或失败）。 */
  remaining: QueuedEdit[];
  /** 本次产生的字段冲突。 */
  conflicts: Record<string, Conflicts>;
  error?: string;
}
