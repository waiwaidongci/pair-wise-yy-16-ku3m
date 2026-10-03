import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { overlayStore, type OverlaySnapshot } from "../sync/store";
import type { SeriesView } from "../sync/types";

/** 覆盖层（离线编辑/同步）的实时快照与动作。 */
interface OverlayContextValue {
  snap: OverlaySnapshot;
  views: SeriesView[];
  viewFor: (seriesId: string) => SeriesView | null;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(overlayStore.subscribe, overlayStore.getSnapshot);

  const value = useMemo<OverlayContextValue>(() => {
    // 每次快照变化都重算视图；视图完全由当前数据派生，不缓存任何旧索引
    const views = overlayStore.allSeriesViews();
    const map = new Map<string, SeriesView>(views.map((v) => [v.id, v]));
    return {
      snap,
      views,
      viewFor: (seriesId: string) => map.get(seriesId) ?? null,
    };
  }, [snap]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay 必须在 OverlayProvider 内使用");
  return ctx;
}
