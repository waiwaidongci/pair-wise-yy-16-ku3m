import { useState } from 'react';
import type { Photo } from '../data/types';

/**
 * 按 mock-data 提供的真实宽高比预先撑开占位空间，
 * 图片加载前布局就不会抖动（CLS）。
 */
export function PhotoImage({
  photo,
  alt,
  className,
  sizes,
  loading = 'lazy',
}: {
  photo: Photo;
  alt?: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`photo-frame ${className ?? ''}`}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {!loaded && <div className="img-ph" aria-hidden />}
      <img
        src={`/photos/${photo.file}`}
        alt={alt ?? photo.altText}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        loading={loading}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />
    </div>
  );
}
