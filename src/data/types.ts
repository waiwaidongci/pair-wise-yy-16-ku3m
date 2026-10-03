export type Category = { id: string; label: string };

export type Photo = {
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
};

export type Series = {
  id: string;
  title: string;
  category: string;
  summary: string;
  photoIds: string[];
};

export type PortfolioData = {
  categories: Category[];
  series: Series[];
  photos: Photo[];
};

/** 可编辑字段：系列说明、封面、照片顺序 */
export type FieldKey = 'summary' | 'coverPhotoId' | 'photoOrder';
