import { useEffect } from "react";
import { useLightbox } from "../state/LightboxContext";
import { categoryLabel } from "../data/catalog";
import { RatioImage } from "./RatioImage";

/**
 * 全局共享灯箱：不是路由，挂在布局层，任何页面都可打开。
 * 导航范围完全来自打开时传入 / 后续 rebind 的照片数组；
 * 数据源更新后按新数组和照片 id 重新定位，不沿用旧下标。
 */
export function Lightbox() {
  const lb = useLightbox();

  useEffect(() => {
    if (!lb.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") lb.close();
      if (e.key === "ArrowRight") lb.next();
      if (e.key === "ArrowLeft") lb.prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lb]);

  if (!lb.open || !lb.current) return null;
  const p = lb.current;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={p.title} data-scope={lb.scopeKey}>
      <div className="lb-stage">
        <button type="button" className="lb-close" aria-label="关闭灯箱" onClick={lb.close}>
          ✕
        </button>
        <button
          type="button"
          className="lb-arrow lb-prev"
          aria-label="上一张"
          onClick={lb.prev}
          disabled={!lb.canPrev}
        >
          ‹
        </button>

        <div className="lb-frame">
          <RatioImage photo={p} eager />
        </div>

        <button
          type="button"
          className="lb-arrow lb-next"
          aria-label="下一张"
          onClick={lb.next}
          disabled={!lb.canNext}
        >
          ›
        </button>

        {/* 移动端：底部说明条（桌面端 CSS 隐藏，改用右侧信息带） */}
        <div className="lb-bottom-bar">
          <span className="tag">{categoryLabel(p.category)}</span>
          <h3>{p.title}</h3>
          <p>{p.caption}</p>
        </div>
      </div>

      {/* 桌面端：右侧信息带 */}
      <aside className="lb-info">
        <span className="tag">{categoryLabel(p.category)}</span>
        <h3>{p.title}</h3>
        <p>{p.caption}</p>
        <div className="lb-counter" data-testid="lb-counter">
          {lb.index + 1} / {lb.total}
        </div>
      </aside>
    </div>
  );
}
