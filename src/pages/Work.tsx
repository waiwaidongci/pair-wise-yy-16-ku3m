import { useMemo } from 'react';
import { PhotoImage } from '../components/PhotoImage';
import { useLightbox } from '../state/lightboxStore';
import { filterStore, setCategory } from '../state/filterStore';
import { useStore } from '../lib/store';
import { useOverlay } from '../overlay/OverlayProvider';
import { allEffectivePhotos } from '../overlay/overlayStore';
import { categories, categoryLabel } from '../data/base';

export function Work() {
  const { category } = useStore(filterStore, (s) => s);
  const { overlay } = useOverlay();
  const { openLightbox } = useLightbox();

  const photos = useMemo(() => {
    const all = allEffectivePhotos(overlay);
    return category === 'all' ? all : all.filter((p) => p.category === category);
  }, [overlay, category]);

  const pills = [{ id: 'all', label: '全部' }, ...categories];

  return (
    <div className="container">
      <div className="page-head">
        <p className="eyebrow">Work</p>
        <h1 className="section-title">作品集</h1>
      </div>

      <div className="filter-bar" role="tablist" aria-label="按分类筛选">
        {pills.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={category === p.id}
            className={`filter-pill ${category === p.id ? 'active' : ''}`}
            onClick={() => setCategory(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="masonry">
        {photos.map((photo) => (
          <figure
            key={photo.id}
            className="photo-card"
            onClick={() => openLightbox({ type: 'work', category }, photo.id)}
          >
            <PhotoImage photo={photo} />
            <div className="overlay">
              <h3>{photo.title}</h3>
              <span className="cat">{categoryLabel(photo.category)}</span>
              <span className="view">view</span>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
