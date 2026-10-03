import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Photo } from "../data/types";

/**
 * 灯箱的“导航范围”：不是某个分类 id，而是打开那一刻调用方给出的
 * 已解析照片数组（例如 /work 当前筛选结果，或系列详情的当前顺序）。
 * 数据变化（筛选改变 / 系列重排 / 跨标签页覆盖更新）时按新数据重算，
 * 旧索引只用来定位同一张照片，绝不直接平移到别的照片上。
 */
export interface LightboxScope {
  /** 每次打开/换范围时重新生成，供调试与测试观察。 */
  scopeKey: string;
  photos: Photo[];
}

interface LightboxState {
  open: boolean;
  current: Photo | null;
  index: number;
  total: number;
  scopeKey: string;
  canPrev: boolean;
  canNext: boolean;
}

interface LightboxContextValue extends LightboxState {
  /** 用一组已解析的照片打开；startId 指定落在其中的哪一张。 */
  openAt: (photos: Photo[], startId: string, scopeKey?: string) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  goto: (id: string) => void;
  /** 数据变化时用新数组刷新当前打开灯箱的范围（按 id 重新定位）。 */
  rebind: (photos: Photo[], scopeKey?: string) => void;
}

const CLOSED: LightboxState = {
  open: false,
  current: null,
  index: -1,
  total: 0,
  scopeKey: "",
  canPrev: false,
  canNext: false,
};

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const scopeRef = useRef<LightboxScope>({ scopeKey: "", photos: [] });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scopeKey, setScopeKey] = useState("");

  const rebind = useCallback((nextPhotos: Photo[], nextKey?: string) => {
    scopeRef.current = {
      scopeKey: nextKey ?? scopeRef.current.scopeKey ?? "adhoc",
      photos: nextPhotos,
    };
    setScopeKey(scopeRef.current.scopeKey);
    setActiveId((prev) => {
      if (prev === null) return null;
      // 关键：旧照片已不在新范围时停在范围内第一张，而不是沿用旧下标
      return nextPhotos.some((p) => p.id === prev) ? prev : (nextPhotos[0]?.id ?? null);
    });
  }, []);

  const openAt = useCallback((nextPhotos: Photo[], startId: string, nextKey?: string) => {
    const key = nextKey ?? `scope-${Date.now()}-${nextPhotos.length}`;
    scopeRef.current = { scopeKey: key, photos: nextPhotos };
    setScopeKey(key);
    const start = nextPhotos.some((p) => p.id === startId)
      ? startId
      : (nextPhotos[0]?.id ?? null);
    setActiveId(start);
  }, []);

  const close = useCallback(() => {
    setActiveId(null);
  }, []);

  const goto = useCallback((id: string) => {
    if (scopeRef.current.photos.some((p) => p.id === id)) setActiveId(id);
  }, []);

  const step = useCallback((delta: number) => {
    setActiveId((prev) => {
      const list = scopeRef.current.photos;
      if (prev === null || list.length === 0) return prev;
      const at = list.findIndex((p) => p.id === prev);
      if (at === -1) return list[0].id;
      // 范围导航：循环限定在当前（可能已更新的）数组内
      const ni = (at + delta + list.length) % list.length;
      return list[ni].id;
    });
  }, []);

  const value = useMemo<LightboxContextValue>(() => {
    const list = scopeRef.current.photos;
    const idx = activeId === null ? -1 : list.findIndex((p) => p.id === activeId);
    const safeIdx = idx === -1 ? 0 : idx;
    const state: LightboxState = activeId === null || list.length === 0
      ? CLOSED
      : {
          open: true,
          current: list[safeIdx] ?? null,
          index: safeIdx,
          total: list.length,
          scopeKey,
          canPrev: list.length > 1,
          canNext: list.length > 1,
        };
    return {
      ...state,
      openAt,
      close,
      next: () => step(1),
      prev: () => step(-1),
      goto,
      rebind,
    };
  }, [activeId, scopeKey, openAt, close, step, goto, rebind]);

  return <LightboxContext.Provider value={value}>{children}</LightboxContext.Provider>;
}

export function useLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox 必须在 LightboxProvider 内使用");
  return ctx;
}
