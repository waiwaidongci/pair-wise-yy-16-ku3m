import { Link } from 'react-router-dom';
import { PhotoImage } from '../components/PhotoImage';
import { useLightbox } from '../state/lightboxStore';
import { useOverlay } from '../overlay/OverlayProvider';
import { effectivePhotos, effectiveSeries } from '../overlay/overlayStore';
import { categoryLabel, seriesList } from '../data/base';

export function Home() {
  const { overlay } = useOverlay();
  const { openLightbox } = useLightbox();

  const heroPhoto = effectivePhotos('gaze', overlay)[0];

  return (
    <>
      <section className="hero">
        <div className="hero-bg">
          <PhotoImage photo={heroPhoto} alt="摄影师肖像" loading="eager" />
        </div>
        <div className="container hero-inner">
          <p className="eyebrow">独立摄影师 · PORTFOLIO</p>
          <h1 className="hero-name">
            林屿<em>。</em>
          </h1>
          <p className="hero-tagline">
            以黑白人像特写与高原风光为题材，记录眼神、地貌与牧歌生活的日常节奏。
          </p>
          <div className="hero-actions">
            <Link to="/work" className="btn solid">
              查看作品
            </Link>
            <Link to="/contact" className="btn ghost">
              联系我
            </Link>
          </div>
        </div>
      </section>

      <hr className="gold-rule" />

      <section className="section">
        <div className="container">
          <p className="eyebrow">Featured Works</p>
          <h2 className="section-title">精选系列</h2>
          <div className="featured-grid">
            {seriesList.map((s) => {
              const eff = effectiveSeries(s.id, overlay);
              const photos = effectivePhotos(s.id, overlay);
              const cover = photos.find((p) => p.id === eff.coverPhotoId) ?? photos[0];
              return (
                <article key={s.id} className="featured-card">
                  <div
                    className="thumb"
                    onClick={() => openLightbox({ type: 'series', seriesId: s.id }, cover.id)}
                  >
                    <PhotoImage photo={cover} alt={cover.altText} />
                  </div>
                  <div className="featured-meta">
                    <h3>
                      <Link to={`/work/${s.id}`}>{eff.title}</Link>
                    </h3>
                    <span className="cat">{categoryLabel(s.category)}</span>
                  </div>
                  <p className="featured-summary">{eff.summary}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
