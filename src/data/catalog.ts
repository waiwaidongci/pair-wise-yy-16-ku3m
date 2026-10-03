import raw from "../../mock-data/photos.json";
import type { CatalogData, Category, Photo, Series } from "./types";

/**
 * 只读基础目录。冻结后在整个应用内共享，任何编辑都写入本地覆盖层
 * （src/sync/*），绝不回写 mock-data 下的原始资料。
 */
export const catalog: CatalogData = raw as CatalogData;

export const categories: readonly Category[] = catalog.categories;
export const seriesList: readonly Series[] = catalog.series;
export const photos: readonly Photo[] = catalog.photos;

const photoById = new Map(photos.map((p) => [p.id, p]));
const seriesById = new Map(seriesList.map((s) => [s.id, s]));
const categoryById = new Map(categories.map((c) => [c.id, c]));

export function getPhoto(id: string): Photo {
  const p = photoById.get(id);
  if (!p) throw new Error(`未知照片 id: ${id}`);
  return p;
}

export function getSeries(id: string): Series | undefined {
  return seriesById.get(id);
}

export function getCategory(id: string): Category | undefined {
  return categoryById.get(id);
}

export function categoryLabel(id: string): string {
  return categoryById.get(id)?.label ?? id;
}

/** 原始顺序（按 photo.order），覆盖层可在此之上重排。 */
export function basePhotoIdsForSeries(seriesId: string): string[] {
  const s = seriesById.get(seriesId);
  if (!s) return [];
  return [...s.photoIds].sort(
    (a, b) => getPhoto(a).order - getPhoto(b).order,
  );
}

export function photosByIds(ids: readonly string[]): Photo[] {
  return ids.map(getPhoto);
}
