import data from '../../mock-data/photos.json';
import type { Category, PortfolioData, Photo, Series } from './types';

// 原始数据只读：任何编辑都进入本地覆盖层（overlay），不修改这里。
const portfolio = data as PortfolioData;

export const categories: Category[] = portfolio.categories;
export const seriesList: Series[] = portfolio.series;
export const photos: Photo[] = portfolio.photos;

export const photoMap: Map<string, Photo> = new Map(photos.map((p) => [p.id, p]));
export const seriesMap: Map<string, Series> = new Map(seriesList.map((s) => [s.id, s]));

export function categoryLabel(id: string): string {
  return categories.find((c) => c.id === id)?.label ?? id;
}

/** 原始顺序（以 series.photoIds 为准） */
export function basePhotoIds(seriesId: string): string[] {
  return seriesMap.get(seriesId)?.photoIds ?? [];
}
