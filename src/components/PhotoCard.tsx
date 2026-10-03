import type { Photo } from "../data/types";
import { categoryLabel } from "../data/catalog";
import { RatioImage } from "./RatioImage";

interface Props {
  photo: Photo;
  onOpen: (photo: Photo) => void;
}

/**
 * 照片卡片：桌面悬停出现覆盖标题层；移动端覆盖层由 CSS 关闭，
 * 标题显示在图片下方的 .photo-meta-mobile。
 */
export function PhotoCard({ photo, onOpen }: Props) {
  return (
    <button
      type="button"
      className="photo-card"
      onClick={() => onOpen(photo)}
      aria-label={`查看照片：${photo.title}`}
    >
      <span className="photo-frame">
        <RatioImage photo={photo} />
        <span className="photo-overlay">
          <span className="tag">{categoryLabel(photo.category)}</span>
          <h3>{photo.title}</h3>
          <span className="view-hint">View</span>
        </span>
      </span>
      <span className="photo-meta-mobile">
        <span className="tag">{categoryLabel(photo.category)}</span>
        <h3>{photo.title}</h3>
      </span>
    </button>
  );
}
