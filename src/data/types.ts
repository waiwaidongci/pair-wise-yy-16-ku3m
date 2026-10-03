/** 只读原始资料（mock-data/photos.json）的类型，应用永远不修改这份数据。 */

export interface Category {
  id: string;
  label: string;
}

export interface Series {
  id: string;
  title: string;
  category: string;
  summary: string;
  photoIds: string[];
}

export interface Photo {
  id: string;
  category: string;
  seriesId: string;
  file: string;
  title: string;
  altText: string;
  caption: string;
  width: number;
  height: number;
  order: number;
}

export interface CatalogData {
  categories: Category[];
  series: Series[];
  photos: Photo[];
}

/** 摄影师可临时修改的字段（系列标题 / 说明 / 封面 / 照片顺序）。 */
export type EditableField = "title" | "summary" | "coverId" | "order";
