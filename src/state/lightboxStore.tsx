import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Photo } from '../data/types';
import { allEffectivePhotos, effectivePhotos } from '../overlay/overlayStore';
import { useOverlay } from '../overlay/OverlayProvider';

/**
 * 灯箱范围描述：
 * - work: 作品集页当前筛选结果
 * - series: 某系列（按覆盖后顺序）
 * - custom: 显式给定照片 id 列表（首页精选等）
 *
 * 灯箱始终按 photoId 定位，绝不使用位置索引——
 * 数据顺序/内容变化后重算范围，当前照片不在范围内则关闭，
 * 旧索引永远不会被带到另一张照片上。
 */
export type LightboxScope =
  | { type: 'work'; category: string }
  | { type: 'series'; seriesId: string }
  | { type: 'custom'; photoIds: string[] };

type LightboxApi = {
  isOpen: boolean;
  scope: LightboxScope | null;
  photoId: string | null;
  /** 当前范围内的照片（随筛选 / 系列内容顺序重算） */
  photos: Photo[];
  openLightbox: (scope: LightboxScope, photoId: string) => void;
  closeLightbox: () => void;
  showNext: () => void;
  showPrev: () => void;
};

const Ctx = createContext<LightboxApi | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<LightboxScope | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  // 订阅 overlay 变化：系列内容/顺序一改，灯箱范围立即重算
  const { overlay } = useOverlay();

  const isOpen = scope !== null && photoId !== null;

  // 当前范围内的照片列表（随 overlay / 筛选重算）
  const photos: Photo[] = useMemo(() => {
    if (!scope) return [];
    if (scope.type === 'work') {
      const all = allEffectivePhotos(overlay);
      return scope.category === 'all' ? all : all.filter((p) => p.category === scope.category);
    }
    if (scope.type === 'series') {
      return effectivePhotos(scope.seriesId, overlay);
    }
    // custom：保持调用方给定顺序，但仍校验照片存在
    return scope.photoIds
      .map((id) => allEffectivePhotos(overlay).find((p) => p.id === id))
      .filter((p): p is Photo => !!p);
  }, [scope, overlay]);

  const currentIndex = useMemo(() => photos.findIndex((p) => p.id === photoId), [photos, photoId]);

  // 范围重算后：当前照片不在新范围内 → 关闭灯箱（绝不把旧索引带到别的照片）
  useEffect(() => {
    if (!isOpen) return;
    if (currentIndex === -1) {
      setScope(null);
      setPhotoId(null);
    }
  }, [isOpen, currentIndex]);

  const openLightbox = useCallback((nextScope: LightboxScope, id: string) => {
    setScope(nextScope);
    setPhotoId(id);
  }, []);

  const closeLightbox = useCallback(() => {
    setScope(null);
    setPhotoId(null);
  }, []);

  const showNext = useCallback(() => {
    setPhotoId((cur) => {
      if (!cur) return cur;
      const idx = photos.findIndex((p) => p.id === cur);
      if (idx === -1) return cur;
      return photos[(idx + 1) % photos.length].id;
    });
  }, [photos]);

  const showPrev = useCallback(() => {
    setPhotoId((cur) => {
      if (!cur) return cur;
      const idx = photos.findIndex((p) => p.id === cur);
      if (idx === -1) return cur;
      return photos[(idx - 1 + photos.length) % photos.length].id;
    });
  }, [photos]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') showNext();
      else if (e.key === 'ArrowLeft') showPrev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeLightbox, showNext, showPrev]);

  return (
    <Ctx.Provider
      value={{
        isOpen,
        scope,
        photoId,
        photos,
        openLightbox,
        closeLightbox,
        showNext,
        showPrev,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLightbox(): LightboxApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLightbox must be used within LightboxProvider');
  return ctx;
}

/** 当前灯箱照片（由范围派生） */
export function useLightboxPhoto(): Photo | null {
  const { photoId } = useLightbox();
  const { overlay } = useOverlay();
  return useMemo(() => {
    if (!photoId) return null;
    return allEffectivePhotos(overlay).find((p) => p.id === photoId) ?? null;
  }, [photoId, overlay]);
}
