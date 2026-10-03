import { Link } from "react-router-dom";
import { getPhoto, categoryLabel } from "../data/catalog";
import { useOverlay } from "../state/OverlayContext";
import { RatioImage } from "../components/RatioImage";

export function Home() {
  const { views } = useOverlay();
  const heroPhoto = getPhoto("portrait-05");

  return (
    <>
      <section className="hero">
        <div className="hero-img">
          <img
            src={`/${heroPhoto.file}`}
            alt={heroPhoto.altText}
            width={heroPhoto.width}
            height={heroPhoto.height}
            fetchPriority="high"
          />
        </div>
        <div className="hero-scrim" />
        <div className="hero-inner">
          <div className="hero-text">
            <h1>
              <span className="latin">Mira Lin · Photographer</span>
              用光线等待
              <br />
              真实落下的瞬间
            </h1>
            <p>
              独立摄影师，拍摄黑白人像特写，以及高原地区的自然风光与牧场生活。
              作品收录于《凝视》《无人之境》《高原牧歌》三个系列。
            </p>
          </div>
        </div>
      </section>

      <section className="featured">
        <div className="container">
          <hr className="gold-rule" style={{ marginBottom: 40 }} />
          <div className="featured-head">
            <h2>Featured works</h2>
            <Link to="/work" className="tag">全部作品 →</Link>
          </div>
          <div className="feature-grid">
            {views.map((s) => {
              const cover = getPhoto(s.coverId);
              return (
                <Link key={s.id} to={`/work/${s.id}`} className="feature-card">
                  <div className="thumb">
                    <RatioImage
                      photo={{ ...cover, width: 3, height: 2 }}
                      eager
                    />
                  </div>
                  <div className="feature-meta">
                    <h3>《{s.title}》</h3>
                    <span className="tag">{categoryLabel(s.category)}</span>
                  </div>
                  <p className="feature-note">{s.summary}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
