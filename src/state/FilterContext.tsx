import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { categories } from "../data/catalog";

/**
 * /work 的分类筛选状态放在路由树之外（导航到系列详情再返回仍保留），
 * 同时作为灯箱导航范围的数据源。
 */
export type FilterId = "all" | string;

interface FilterContextValue {
  filter: FilterId;
  setFilter: (id: FilterId) => void;
  filterLabel: string;
}

const FilterContext = createContext<FilterContextValue | null>(null);
const VALID = new Set(["all", ...categories.map((c) => c.id)]);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterRaw] = useState<FilterId>(() => {
    const saved = sessionStorage.getItem("mira.work.filter");
    return saved && VALID.has(saved) ? saved : "all";
  });

  const setFilter = useCallback((id: FilterId) => {
    setFilterRaw(id);
    sessionStorage.setItem("mira.work.filter", id);
  }, []);

  const value = useMemo<FilterContextValue>(() => {
    const label =
      filter === "all"
        ? "全部作品"
        : categories.find((c) => c.id === filter)?.label ?? "";
    return { filter, setFilter, filterLabel: label };
  }, [filter, setFilter]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter 必须在 FilterProvider 内使用");
  return ctx;
}
