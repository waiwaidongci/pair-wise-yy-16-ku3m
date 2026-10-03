import { getSeries, seriesList, basePhotoIdsForSeries } from "../data/catalog";
import type { EditableField } from "../data/types";
import { mockServer } from "./server";
import {
  OVERLAY_VERSION,
  type Conflicts,
  type FieldConflict,
  type FieldValue,
  type FlushResult,
  type PersistedDraftV1,
  type PersistedOverlay,
  type PersistedOverlayV1,
  type QueuedEdit,
  type SeriesView,
} from "./types";

const SESSION_KEY = "mira.overlay.v2";
/** v1 旧草稿（localStorage 整包）与旧会话草稿可能出现的位置。 */
const LEGACY_GLOBAL_KEYS = ["mira.overlay.v1"];
const LEGACY_SESSION_KEYS = ["mira.drafts.v1", "mira.overlay.v1.session"];

type CommittedPatch = Partial<Record<EditableField, FieldValue>>;
type Listener = () => void;

/** 稳定引用的状态快照：只有 emit 时才换新对象，避免 useSyncExternalStore 死循环。 */
export interface OverlaySnapshot {
  version: number;
  online: boolean;
  manualOffline: boolean;
  connected: boolean;
  flaky: boolean;
  autoSync: boolean;
  lastMessage: string;
  pending: readonly QueuedEdit[];
  conflicts: Readonly<Record<string, Conflicts>>;
  clientId: string;
}

export const sameValue = (a: FieldValue, b: FieldValue): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

function catalogBase(seriesId: string, field: EditableField): FieldValue {
  const s = getSeries(seriesId);
  if (!s) return field === "order" ? [] : "";
  switch (field) {
    case "title":
      return s.title;
    case "summary":
      return s.summary;
    case "coverId":
      return basePhotoIdsForSeries(seriesId)[0] ?? "";
    case "order":
      return basePhotoIdsForSeries(seriesId);
  }
}

interface SessionState {
  clientId: string;
  pending: QueuedEdit[];
  conflicts: Record<string, Conflicts>;
}

function makeClientId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 本地覆盖层引擎。
 * - 原始目录（mock-data）只读，所有编辑先进本覆盖层；
 * - 离线编辑存在 sessionStorage（标签页隔离），联网后逐条三向合并；
 * - 提交失败的草稿保留 lastError，可重试；
 * - v1 旧草稿加载时先升级到 v2 再继续处理。
 */
class OverlayStore {
  clientId: string;
  pending: QueuedEdit[] = [];
  conflicts: Record<string, Conflicts> = {};
  online = typeof navigator === "undefined" ? true : navigator.onLine;
  /** 手动离线（模拟外拍断网）。 */
  manualOffline = false;
  /** 模拟不稳定网络：提交会失败，草稿保留可重试。 */
  flaky = false;
  autoSync = true;
  lastMessage = "";
  version = 0;
  private listeners = new Set<Listener>();
  private flushToken = 0;
  private flushing: Promise<FlushResult> | null = null;
  private snapshot: OverlaySnapshot;
  /**
   * 断网瞬间冻结的“远端视图”。离线期间另一端的提交不会出现在本地视图里，
   * 恢复连接时整体刷新，再逐条做三向合并。
   */
  private serverCache: Record<string, CommittedPatch> = {};

  constructor() {
    const session = this.loadSession();
    this.clientId = session?.clientId ?? makeClientId();
    this.pending = session?.pending ?? [];
    this.conflicts = session?.conflicts ?? {};
    // 在已有会话队列之上迁移旧草稿（不能在迁移前用空数组覆盖）
    const migrated = this.migrateLegacy();
    this.refreshServerCache();
    if (migrated) {
      this.persist();
      this.lastMessage = "旧版本草稿已升级，可继续同步处理";
    }
    this.snapshot = this.buildSnapshot();
    window.addEventListener("online", this.handleConnectivity);
    window.addEventListener("offline", this.handleConnectivity);
    mockServer.onChange(() => {
      // 离线时忽略远端变化（外拍中收不到），保持冻结视图
      if (this.isConnected()) this.refreshServerCache();
      this.emit();
    });
    if (this.isConnected() && this.autoSync && this.pending.length > 0) void this.flush();
  }

  private refreshServerCache() {
    const cache: Record<string, CommittedPatch> = {};
    for (const s of seriesList) cache[s.id] = mockServer.getSeries(s.id);
    this.serverCache = cache;
  }

  /* ---------------- 订阅 ---------------- */

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    this.version += 1;
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private buildSnapshot(): OverlaySnapshot {
    return {
      version: this.version,
      online: this.online,
      manualOffline: this.manualOffline,
      connected: this.isConnected(),
      flaky: this.flaky,
      autoSync: this.autoSync,
      lastMessage: this.lastMessage,
      pending: this.pending,
      conflicts: this.conflicts,
      clientId: this.clientId,
    };
  }

  getSnapshot = (): OverlaySnapshot => this.snapshot;

  private handleConnectivity = () => {
    this.online = navigator.onLine;
    if (this.isConnected()) {
      // 恢复连接：拉取自断网以来远端的全部变化，再逐条合并本地草稿
      this.refreshServerCache();
      if (this.autoSync) void this.flush();
    }
    this.emit();
  };

  isConnected(): boolean {
    return this.online && !this.manualOffline;
  }

  /* ---------------- 持久化与迁移 ---------------- */

  private loadSession(): SessionState | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedOverlay | SessionState;
      if ((parsed as PersistedOverlay).version === OVERLAY_VERSION) {
        const p = parsed as PersistedOverlay;
        return { clientId: p.clientId, pending: p.pending, conflicts: p.conflicts };
      }
      return parsed as SessionState;
    } catch {
      return null;
    }
  }

  private persist() {
    const payload: PersistedOverlay = {
      version: OVERLAY_VERSION,
      clientId: this.clientId,
      pending: this.pending,
      conflicts: this.conflicts,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  /**
   * 升级旧草稿：
   * v1 中一个系列的修改可能打包成 {title,note,cover,ids} 一条草稿，
   * v2 拆成按字段的三向合并队列（note→summary、cover→coverId、ids→order）。
   */
  private migrateLegacy(): boolean {
    let migrated = false;

    const upgradeV1 = (raw: string): PersistedOverlayV1 | null => {
      try {
        const obj = JSON.parse(raw) as PersistedOverlayV1;
        if (obj && obj.version === 1) return obj;
      } catch {
        /* 忽略损坏内容 */
      }
      return null;
    };

    const fieldMap: Record<string, EditableField> = {
      title: "title",
      note: "summary",
      cover: "coverId",
      ids: "order",
    };

    const importDraft = (d: PersistedDraftV1, fallbackClient: string, now: number) => {
      const entries: Array<[EditableField, FieldValue | undefined]> = [
        ["title", d.title],
        ["summary", d.note],
        ["coverId", d.cover],
        ["order", d.ids],
      ];
      for (const [field, value] of entries) {
        if (value === undefined) continue;
        const base = d.base?.[field] ?? catalogBase(d.series, field);
        this.pending.push({
          id: d.id ? `${d.id}-${field}` : `legacy-${now}-${Math.random().toString(36).slice(2, 7)}`,
          seriesId: d.series,
          field,
          base,
          value,
          clientId: d.client ?? fallbackClient,
          createdAt: d.created ?? now,
          attempts: 0,
        });
        migrated = true;
      }
    };

    const now = Date.now();
    const fallbackClient = makeClientId();

    for (const key of LEGACY_GLOBAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const v1 = upgradeV1(raw);
      if (!v1) continue;
      const client = v1.clientId ?? fallbackClient;
      // 旧版本平铺的已提交覆盖值，作为服务器现状补录（不覆盖已有值）。
      for (const [seriesId, patch] of Object.entries(v1.committed ?? {})) {
        const current = mockServer.getSeries(seriesId);
        for (const [oldField, value] of Object.entries(patch)) {
          const field = fieldMap[oldField] ?? (oldField as EditableField);
          if (value !== undefined && current[field] === undefined) {
            void mockServer.commitField(
              seriesId,
              field,
              catalogBase(seriesId, field),
              value,
            );
          }
        }
      }
      (v1.pending ?? []).forEach((d) => importDraft(d, client, now));
      if (v1.conflicts) {
        for (const [seriesId, c] of Object.entries(v1.conflicts)) {
          const upgraded: Conflicts = {};
          for (const [oldField, cf] of Object.entries(c)) {
            upgraded[fieldMap[oldField] ?? (oldField as EditableField)] = cf as FieldConflict;
          }
          this.conflicts[seriesId] = { ...this.conflicts[seriesId], ...upgraded };
        }
      }
      localStorage.removeItem(key);
    }

    for (const key of LEGACY_SESSION_KEYS) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const v1 = upgradeV1(raw);
      if (v1) {
        (v1.pending ?? []).forEach((d) => importDraft(d, v1.clientId ?? fallbackClient, now));
      }
      sessionStorage.removeItem(key);
    }

    return migrated;
  }

  /* ---------------- 读取视图 ---------------- */

  private committedPatch(seriesId: string): CommittedPatch {
    // 视图读取“断网瞬间冻结”的远端视图；在线时缓存实时跟随 storage 事件
    return this.serverCache[seriesId] ?? {};
  }

  /** 把基础目录、已提交覆盖、待提交草稿、冲突解析成当前视图。 */
  seriesView(seriesId: string): SeriesView | null {
    const s = getSeries(seriesId);
    if (!s) return null;
    const committed = this.committedPatch(seriesId);
    const pick = (field: EditableField): FieldValue =>
      committed[field] ?? catalogBase(seriesId, field);

    const view: SeriesView = {
      id: s.id,
      category: s.category,
      title: pick("title") as string,
      summary: pick("summary") as string,
      coverId: pick("coverId") as string,
      photoIds: [...(pick("order") as string[])],
    };

    // 待提交（或冲突中保留本地值）的字段覆盖在最上层
    const byField = new Map<EditableField, FieldValue>();
    for (const op of this.pending) {
      if (op.seriesId === seriesId) byField.set(op.field, op.value);
    }
    for (const [field, cf] of Object.entries(this.conflicts[seriesId] ?? {})) {
      if (cf && !byField.has(field as EditableField)) {
        byField.set(field as EditableField, cf.local);
      }
    }
    for (const [field, value] of byField) {
      if (field === "order") view.photoIds = [...(value as string[])];
      else view[field] = value as string;
    }
    return view;
  }

  allSeriesViews(): SeriesView[] {
    return seriesList
      .map((s) => this.seriesView(s.id))
      .filter((s): s is SeriesView => s !== null);
  }

  pendingFor(seriesId: string, field: EditableField): QueuedEdit | undefined {
    return this.pending.find((o) => o.seriesId === seriesId && o.field === field);
  }

  hasLocalChange(seriesId: string): boolean {
    return (
      this.pending.some((o) => o.seriesId === seriesId) ||
      Object.keys(this.conflicts[seriesId] ?? {}).length > 0
    );
  }

  /* ---------------- 编辑入队 ---------------- */

  /**
   * 记录一次修改。同一字段在离线期间连续修改会合并成一条草稿，
   * 保留最初的共同祖先 base，联网后仍能正确做三向合并。
   */
  recordEdit(seriesId: string, field: EditableField, value: FieldValue) {
    const existing = this.pendingFor(seriesId, field);
    const committed = this.committedPatch(seriesId)[field];
    const base = existing?.base ?? committed ?? catalogBase(seriesId, field);
    if (existing) {
      existing.value = value;
      existing.createdAt = Date.now();
    } else {
      this.pending.push({
        id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        seriesId,
        field,
        base,
        value,
        clientId: this.clientId,
        createdAt: Date.now(),
        attempts: 0,
      });
    }
    this.lastMessage = this.isConnected() ? "修改已保存，正在同步…" : "当前离线，修改已保留，联网后自动同步";
    this.persist();
    this.emit();
    if (this.isConnected() && this.autoSync) void this.flush();
  }

  /** 编辑器批量保存（标题/说明/封面/顺序各算一条，逐条合并）。 */
  recordBatch(
    seriesId: string,
    changes: Partial<Record<EditableField, FieldValue>>,
  ) {
    for (const [field, value] of Object.entries(changes)) {
      if (value !== undefined) this.recordEdit(seriesId, field as EditableField, value);
    }
  }

  /* ---------------- 同步 ---------------- */

  setManualOffline(v: boolean) {
    this.manualOffline = v;
    if (!v) {
      // 从模拟断网恢复：先取远端最新状态，再逐条合并
      this.refreshServerCache();
    }
    this.persist();
    if (this.isConnected() && this.autoSync) void this.flush();
    this.emit();
  }

  setFlaky(v: boolean) {
    this.flaky = v;
    this.emit();
  }

  setAutoSync(v: boolean) {
    this.autoSync = v;
    if (v && this.isConnected()) void this.flush();
    this.emit();
  }

  /**
   * 逐条提交队列。每条独立三向合并：
   * 成功 → 移出队列；冲突 → 双方值保留到 conflicts 等待选择；
   * 失败 → 草稿带 lastError 留在队列，可重试。
   * 同一时刻只允许一轮 runFlush 操作队列（StrictMode/连续编辑可能并发触发）；
   * 等待中的 flush 在本轮结束后若还有新入队草稿会再跑一轮，不丢草稿。
   */
  async flush(): Promise<FlushResult> {
    if (this.flushing) {
      await this.flushing;
      if (this.pending.length > 0) return this.flush();
      return this.lastResult;
    }
    this.flushing = this.runFlush()
      .then((r) => {
        this.lastResult = r;
        return r;
      })
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  private lastResult: FlushResult = { ok: true, remaining: [], conflicts: {} };

  private async runFlush(): Promise<FlushResult> {
    const token = ++this.flushToken;
    if (!this.isConnected()) {
      this.lastMessage = "离线中，修改将在恢复连接后同步";
      this.emit();
      return { ok: false, remaining: [...this.pending], conflicts: this.conflicts, error: "offline" };
    }
    // 复制一份顺序处理，recordEdit 不会在 await 期间重排已有项
    const queue = [...this.pending];
    // 开始同步前重新拉取远端状态（断网恢复后可能已积累另一端的多次提交）
    this.refreshServerCache();
    for (const op of queue) {
      if (token !== this.flushToken) break;
      op.attempts += 1;
      if (this.flaky) {
        op.lastError = "提交失败：网络不稳定，草稿已保留，可重试";
        this.persist();
        this.emit();
        continue;
      }
      try {
        const result = await mockServer.commitField(op.seriesId, op.field, op.base, op.value);
        if (result.outcome === "conflict") {
          // 两边都改了同一字段：留两份，等待摄影师选择
          const bucket = (this.conflicts[op.seriesId] ??= {});
          bucket[op.field] = { remote: result.remoteValue, local: op.value };
          this.pending = this.pending.filter((o) => o.id !== op.id);
        } else {
          this.pending = this.pending.filter((o) => o.id !== op.id);
        }
        // 本字段合并完成后刷新缓存，同系列后续字段按最新远端状态继续三向合并
        this.serverCache[op.seriesId] = mockServer.getSeries(op.seriesId);
      } catch (err) {
        op.lastError = err instanceof Error ? `提交失败：${err.message}` : "提交失败，草稿已保留";
      }
      this.persist();
      this.emit();
    }
    const failed = this.pending.filter((o) => o.lastError);
    const conflictCount = Object.values(this.conflicts).reduce(
      (n, c) => n + Object.keys(c).length,
      0,
    );
    if (failed.length > 0) {
      this.lastMessage = `${failed.length} 条草稿提交失败，已保留可重试`;
    } else if (conflictCount > 0) {
      this.lastMessage = `${conflictCount} 处字段与另一处修改冲突，等待选择`;
    } else if (this.pending.length === 0 && queue.length > 0) {
      this.lastMessage = "所有修改已同步";
    }
    this.emit();
    return {
      ok: failed.length === 0,
      remaining: [...this.pending],
      conflicts: this.conflicts,
      error: failed.length ? "partial-failure" : undefined,
    };
  }

  retryFailed() {
    for (const op of this.pending) delete op.lastError;
    this.persist();
    this.emit();
    void this.flush();
  }

  discardDraft(seriesId: string, field: EditableField) {
    this.pending = this.pending.filter(
      (o) => !(o.seriesId === seriesId && o.field === field),
    );
    this.persist();
    this.emit();
  }

  /**
   * 解决冲突：
   * - local：以本地值覆盖。先把共同祖先更新为服务器现值，
   *   重新入队提交（服务器未再变化即直接接受）；
   * - remote：放弃本地值，删除冲突，视图自动回到服务器版本。
   */
  resolveConflict(seriesId: string, field: EditableField, choice: "local" | "remote") {
    const cf = this.conflicts[seriesId]?.[field];
    if (!cf) return;
    if (choice === "local") {
      const base = cf.remote;
      const value = cf.local;
      this.pending = this.pending.filter(
        (o) => !(o.seriesId === seriesId && o.field === field),
      );
      this.pending.push({
        id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        seriesId,
        field,
        base,
        value,
        clientId: this.clientId,
        createdAt: Date.now(),
        attempts: 0,
      });
    }
    const bucket = { ...(this.conflicts[seriesId] ?? {}) };
    delete bucket[field];
    if (Object.keys(bucket).length === 0) delete this.conflicts[seriesId];
    else this.conflicts[seriesId] = bucket;
    this.persist();
    this.emit();
    if (choice === "local" && this.isConnected() && this.autoSync) void this.flush();
  }
}

export const overlayStore = new OverlayStore();
