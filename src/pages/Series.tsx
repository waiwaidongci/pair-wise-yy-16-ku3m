import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PhotoImage } from '../components/PhotoImage';
import { useLightbox } from '../state/lightboxStore';
import { useOverlay } from '../overlay/OverlayProvider';
import { effectivePhotos, effectiveSeries } from '../overlay/overlayStore';
import { categoryLabel } from '../data/base';
import type { FieldKey } from '../data/types';

export function Series() {
  const { seriesId = '' } = useParams();
  const { overlay, createDraft, resetField, drafts, conflicts, remoteEditingSeries } = useOverlay();
  const { openLightbox } = useLightbox();
  const [editing, setEditing] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);

  const eff = effectiveSeries(seriesId, overlay);
  const photos = effectivePhotos(seriesId, overlay);
  const cover = photos.find((p) => p.id === eff.coverPhotoId) ?? photos[0];

  if (photos.length === 0) {
    return (
      <div className="container section">
        <h1 className="section-title">未找到该系列</h1>
        <Link to="/work" className="btn ghost" style={{ marginTop: 24 }}>
          返回作品集
        </Link>
      </div>
    );
  }

  const pendingForSeries = drafts.filter(
    (d) => d.seriesId === seriesId && d.status !== 'failed',
  );
  const failedForSeries = drafts.filter((d) => d.seriesId === seriesId && d.status === 'failed');
  const conflictsForSeries = conflicts.filter((c) => c.seriesId === seriesId);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...eff.photoOrder];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    createDraft(seriesId, { photoOrder: next });
  };

  const setCover = (photoId: string) => {
    if (photoId === eff.coverPhotoId) return;
    createDraft(seriesId, { coverPhotoId: photoId });
  };

  const saveSummary = () => {
    if (summaryDraft == null || summaryDraft === eff.summary) return;
    createDraft(seriesId, { summary: summaryDraft });
    setSummaryDraft(null);
  };

  const fieldStatus = (field: FieldKey) => {
    const d = drafts.find((x) => x.seriesId === seriesId && Object.keys(x.changes).includes(field));
    if (!d) return null;
    if (d.status === 'failed') return <span className="fail">提交失败，可在同步中心重试</span>;
    if (d.status === 'submitting') return <span className="pending">正在提交…</span>;
    return <span className="pending">已保存到本地，等待提交</span>;
  };

  return (
    <>
      <section className="series-hero">
        {cover && (
          <PhotoImage photo={cover} alt={cover.altText} loading="eager" />
        )}
        <div className="series-hero-title">
          <div className="container">
            <p className="eyebrow">{categoryLabel(eff.category)} · SERIES</p>
            <h1>{eff.title}</h1>
          </div>
        </div>
      </section>

      <section className="series-body">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/work" className="btn ghost" style={{ padding: '8px 20px' }}>
              ← 返回作品集
            </Link>
            <button className={`btn ${editing ? 'solid' : 'ghost'}`} onClick={() => setEditing((v) => !v)}>
              {editing ? '完成编辑' : '编辑系列'}
            </button>
          </div>

          {editing && (
            <div className="edit-toolbar" style={{ marginTop: 24, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="status" style={{ flex: 1, minWidth: 200 }}>
                  {pendingForSeries.length > 0 && (
                    <span className="pending">{pendingForSeries.length} 项改动待提交 · </span>
                  )}
                  {failedForSeries.length > 0 && (
                    <span className="fail">{failedForSeries.length} 项提交失败 · </span>
                  )}
                  {conflictsForSeries.length > 0 && (
                    <span className="pending">{conflictsForSeries.length} 项冲突待选择 · </span>
                  )}
                  编辑结果保存在本地覆盖层，不改动原始照片。
                  {remoteEditingSeries.includes(seriesId) && (
                    <span className="pending"> · 另一标签页正在编辑该系列</span>
                  )}
                </span>
              </div>

              <div>
                <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>
                  系列说明
                </label>
                <textarea
                  className="summary-editor"
                  defaultValue={eff.summary}
                  key={eff.summary}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  placeholder="系列说明…"
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn solid"
                    style={{ padding: '8px 22px' }}
                    onClick={saveSummary}
                    disabled={summaryDraft == null || summaryDraft === eff.summary}
                  >
                    保存说明
                  </button>
                  {eff.modifiedFields.includes('summary') && (
                    <button className="btn ghost" style={{ padding: '8px 18px' }} onClick={() => resetField(seriesId, 'summary')}>
                      恢复原始说明
                    </button>
                  )}
                  <span className="status">{fieldStatus('summary')}</span>
                </div>
              </div>

              <div>
                <label className="eyebrow" style={{ display: 'block', margin: '18px 0 0' }}>
                  照片顺序与封面
                </label>
                <div className="order-editor">
                  {photos.map((photo, i) => (
                    <div className="order-row" key={photo.id}>
                      <div className="thumb-sm">
                        <PhotoImage photo={photo} alt="" />
                      </div>
                      <div className="name">
                        {photo.title}
                        <small>
                          {categoryLabel(photo.category)} · {photo.width}×{photo.height}
                        </small>
                      </div>
                      <button
                        className={`cover-btn ${photo.id === eff.coverPhotoId ? 'active' : ''}`}
                        onClick={() => setCover(photo.id)}
                        title={photo.id === eff.coverPhotoId ? '当前封面' : '设为封面'}
                      >
                        {photo.id === eff.coverPhotoId ? '★' : '☆'}
                      </button>
                      <button
                        className="move-btn"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        title="前移"
                      >
                        ↑
                      </button>
                      <button
                        className="move-btn"
                        onClick={() => move(i, 1)}
                        disabled={i === photos.length - 1}
                        title="后移"
                      >
                        ↓
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {eff.modifiedFields.includes('photoOrder') && (
                    <button className="btn ghost" style={{ padding: '8px 18px' }} onClick={() => resetField(seriesId, 'photoOrder')}>
                      恢复原始顺序
                    </button>
                  )}
                  {eff.modifiedFields.includes('coverPhotoId') && (
                    <button className="btn ghost" style={{ padding: '8px 18px' }} onClick={() => resetField(seriesId, 'coverPhotoId')}>
                      恢复原始封面
                    </button>
                  )}
                  <span className="status">
                    {fieldStatus('photoOrder')}
                    {fieldStatus('coverPhotoId') && <> · {fieldStatus('coverPhotoId')}</>}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="series-summary">{eff.summary}</p>

          {photos.map((photo, i) => (
            <div key={photo.id}>
              <div className={`series-block ${i % 2 === 1 ? 'reverse' : ''}`}>
                <div
                  className="shot"
                  onClick={() => openLightbox({ type: 'series', seriesId }, photo.id)}
                >
                  <PhotoImage photo={photo} alt={photo.altText} />
                </div>
                <div className="text">
                  <div className="num">No. {String(i + 1).padStart(2, '0')}</div>
                  <h3>{photo.title}</h3>
                  <p>{photo.caption}</p>
                </div>
              </div>
              {i < photos.length - 1 && <hr className="series-divider" />}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
