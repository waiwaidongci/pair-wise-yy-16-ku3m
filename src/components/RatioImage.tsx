import { useState } from "react";
import type { Photo } from "../data/types";

interface Props {
  photo: Photo;
  eager?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * 比例占位图片：aspect-ratio 直接来自 mock-data 中该照片的真实像素尺寸，
 * 图片在占位框内加载，完成前布局已经稳定，加载后淡入。
 */
export function RatioImage({ photo, eager = false, className, imgClassName }: Props) {
  const [loaded, setLoaded] = useState(false);
  const src = `/${photo.file}`;
  return (
    <div
      className={`ratio ${loaded ? "is-photo" : ""}${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <img
        src={src}
        alt={photo.altText}
        width={photo.width}
        height={photo.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.complete) setLoaded(true);
        }}
        className={`${loaded ? "loaded" : ""}${imgClassName ? ` ${imgClassName}` : ""}`}
      />
    </div>
  );
}
