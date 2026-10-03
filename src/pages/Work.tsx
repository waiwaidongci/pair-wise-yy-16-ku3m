import { useEffect, useMemo } from "react";
import { categories, getPhoto } from "../data/catalog";
import type { Photo } from "../data/types";
import { useFilter } from "../state/FilterContext";
import { useLightbox } from "../state/LightboxContext";
import { useOverlay } from "../state/OverlayContext";
import { PhotoCard } from "../components/PhotoCard";

export function Work() {
  const { filter, setFilter, filterLabel } = useFilter();
  const { views } = useOverlay();
  const lb = useLightbox();

  /**
   * 网格数据始终从“当前覆盖层视图”派生：系列标题/说明/封面/顺序一变
   * （包括另一个标签页同步过来的值），这里立即按新数据重算。
   */
  const visiblePhotos = useMemo<Photo[]>(() => {
    const list: Photo[] = [];
    for (const series of views) {
      if (filter !== "all" && series.category !== filter) continue;
      for (const id of series.photoIds) list.push(getPhoto(id));
    }
    return list;
  }, [views, filter]);

  const scopeKey = `work:${filter}`;

  // 灯箱打开期间筛选或数据发生变化：用新数组重新定位当前照片，旧索引不平移
  useEffect(() => {
    if (lb.open) lb.rebind(visiblePhotos, scopeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePhotos, scopeKey]);

  return (
    <div className="container">
      <header className="work-head">
        <p className="eyebrow">Portfolio</p>
        <h1>作品</h1>
        <p>
          三个系列、十四张照片。筛选条件会在浏览期间保持，灯箱的切换也限定在当前筛选结果之内。
        </p>
      </header>

      <div className="filters" role="tablist" aria-label="按分类筛选">
        <div className="filters-scroll">
          <button
            type="button"
            className={`chip ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            data-filter="all"
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${filter === c.id ? "active" : ""}`}
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              data-filter={c.id}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="eyebrow" data-testid="result-count" style={{ marginBottom: 20 }}>
        {filterLabel} · {visiblePhotos.length} 张
      </p>

      {visiblePhotos.length === 0 ? (
        <p className="empty-note">该分类下暂时没有照片。</p>
      ) : (
        <div className="masonry" data-testid="masonry">
          {visiblePhotos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onOpen={(photo) => lb.openAt(visiblePhotos, photo.id, scopeKey)}
            />
          ))}
        </div>
      )}

      <div style={{ height: 120 }} />
    </div>
  );
}
