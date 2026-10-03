import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPhoto } from "../data/catalog";
import { useOverlay } from "../state/OverlayContext";
import { useLightbox } from "../state/LightboxContext";
import { RatioImage } from "../components/RatioImage";
import { SeriesEditor } from "../components/SeriesEditor";
import { ConflictBanner } from "../components/ConflictBanner";
import { categoryLabel } from "../data/catalog";

export function SeriesDetail() {
  const { seriesId = "" } = useParams();
  const { viewFor, snap } = useOverlay();
  const lb = useLightbox();
  const [editing, setEditing] = useState(false);

  const view = viewFor(seriesId);

  const photos = useMemo(
    () => (view ? view.photoIds.map(getPhoto) : []),
    [view],
  );

  const scopeKey = `series:${seriesId}`;

  // 系列内容或顺序变化（覆盖层/另一端合并）时，已打开的灯箱按新数据重算范围
  useEffect(() => {
    if (view && lb.open) lb.rebind(photos, scopeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, scopeKey]);

  if (!view) {
    return (
      <div className="container" style={{ paddingBlock: 120, textAlign: "center" }}>
        <p className="eyebrow">404</p>
        <h1 style={{ marginBottom: 24 }}>找不到这个系列</h1>
        <Link to="/work" className="btn">返回作品页</Link>
      </div>
    );
  }

  const cover = getPhoto(view.coverId);

  return (
    <>
      <section className="series-hero">
        <RatioImage photo={cover} eager className="hero-ratio" />
        <div className="hero-scrim" />
        <div className="series-title-block">
          <div className="inner">
            <span className="tag">{categoryLabel(view.category)}</span>
            <h1>《{view.title}》</h1>
          </div>
        </div>
      </section>

      <section className="series-narrative">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="section-actions">
            <Link to="/work" className="tag">← 返回作品页（筛选保持）</Link>
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(true)}
              data-testid="open-editor"
            >
              ✎ 临时便签：改说明 / 封面 / 顺序
            </button>
          </div>

          <ConflictBanner seriesId={view.id} />
          {snap.pending.some((o) => o.seriesId === view.id) && (
            <p className="retry-hint" data-testid="local-pending-note" style={{ marginBottom: 24 }}>
              该系列有尚未同步的本地修改，已安全保留在本地覆盖层。
            </p>
          )}

          <blockquote className="pull-quote">{view.summary}</blockquote>

          {photos.map((p, i) => (
            <div key={p.id} className={`narrative-row ${i % 2 === 1 ? "flip" : ""}`}>
              <div className="narrative-media">
                <button
                  type="button"
                  className="photo-card"
                  onClick={() => lb.openAt(photos, p.id, scopeKey)}
                  aria-label={`查看照片：${p.title}`}
                >
                  <span className="photo-frame">
                    <RatioImage photo={p} />
                  </span>
                </button>
              </div>
              <div className="narrative-text">
                <p className="eyebrow">Plate {String(i + 1).padStart(2, "0")}</p>
                <h3>{p.title}</h3>
                <p>{p.caption}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && <SeriesEditor series={view} onClose={() => setEditing(false)} />}
    </>
  );
}
