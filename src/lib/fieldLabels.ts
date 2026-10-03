import { photoMap, seriesMap } from '../data/base';
import type { FieldKey } from '../data/types';

export const FIELD_LABELS: Record<FieldKey, string> = {
  summary: '系列说明',
  coverPhotoId: '封面照片',
  photoOrder: '照片顺序',
};

export function seriesTitle(seriesId: string): string {
  return seriesMap.get(seriesId)?.title ?? seriesId;
}

/** 把字段值渲染成可读文本（用于冲突对比） */
export function formatFieldValue(field: FieldKey, value: unknown): string {
  if (value == null) return '（空）';
  if (field === 'summary') return String(value);
  if (field === 'coverPhotoId') {
    const photo = photoMap.get(String(value));
    return photo ? `《${photo.title}》` : String(value);
  }
  if (field === 'photoOrder') {
    const ids = value as string[];
    return ids
      .map((id, i) => {
        const p = photoMap.get(id);
        return p ? `${i + 1}. ${p.title}` : `${i + 1}. ${id}`;
      })
      .join('，');
  }
  return String(value);
}
