import { createStore } from '../lib/store';

export type FilterState = {
  /** 分类 id，'all' 表示全部 */
  category: string;
};

const STORAGE_KEY = 'portfolio-work-filter';

function loadInitial(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FilterState>;
      if (typeof parsed.category === 'string') return { category: parsed.category };
    }
  } catch {
    /* ignore */
  }
  return { category: 'all' };
}

export const filterStore = createStore<FilterState>(loadInitial(), STORAGE_KEY);

export function setCategory(category: string) {
  filterStore.setState((s) => ({ ...s, category }));
}
