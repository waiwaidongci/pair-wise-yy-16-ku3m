import { useEffect, useState } from 'react';
import { useLightbox } from '../state/lightboxStore';
import { categoryLabel } from '../data/base';

/**
 * 全局共享灯箱：任意页面点击照片打开。
 * 导航范围由 scope 派生，系列内容/顺序变化后自动重算，
 * 始终按照片 id 定位——旧索引不会被带到别的照片上。
 */
export function Lightbox() {
  const { isOpen, photoId, photos, closeLightbox, showNext, showPrev } = useLightbox();
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false,
  );

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isOpen || !photoId) return null;

  const idx = photos.findIndex((p) => p.id === photoId);
  const photo = idx >= 0 ? photos[idx] : undefined;
  if (!photo) return null;

  return (
    <div className="lightbox-backdrop" onClick={closeLightbox} role="dialog" aria-modal="true">
      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <button className="lb-close" onClick={closeLightbox} aria-label="关闭">
          ✕
        </button>
        <button className="lb-arrow prev" onClick={showPrev} aria-label="上一张">
          ‹
        </button>

        <figure className="lightbox-photo">
          <img
            src={`/photos/${photo.file}`}
            alt={photo.altText}
            width={photo.width}
            height={photo.height}
          />
        </figure>

        {!mobile && (
          <aside className="lightbox-info">
            <span className="cat">{categoryLabel(photo.category)}</span>
            <h3>{photo.title}</h3>
            <p>{photo.caption}</p>
            <div className="count">
              {idx + 1} / {photos.length}
            </div>
          </aside>
        )}

        <button className="lb-arrow next" onClick={showNext} aria-label="下一张">
          ›
        </button>
      </div>

      {mobile && (
        <div className="lb-mobile-info" onClick={(e) => e.stopPropagation()}>
          <span className="cat">{categoryLabel(photo.category)}</span>
          <h3>{photo.title}</h3>
          <p>{photo.caption}</p>
        </div>
      )}
    </div>
  );
}
