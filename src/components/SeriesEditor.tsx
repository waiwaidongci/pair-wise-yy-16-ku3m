import { useEffect, useState } from "react";
import { getPhoto } from "../data/catalog";
import { overlayStore } from "../sync/store";
import { useOverlay } from "../state/OverlayContext";
import type { EditableField } from "../data/types";
import type { SeriesView } from "../sync/types";

function moveId(ids: string[], id: string, delta: number): string[] {
  const next = [...ids];
  const at = next.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= next.length) return ids;
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

interface Props {
  series: SeriesView;
  onClose: () => void;
}

/**
 * “临时便签”编辑抽屉：改系列说明、封面与照片顺序。
 * 保存只写本地覆盖层，原始 mock-data 永不变；联网后逐条与另一端合并。
 */
export function SeriesEditor({ series, onClose }: Props) {
  const { snap } = useOverlay();
  const [title, setTitle] = useState(series.title);
  const [summary, setSummary] = useState(series.summary);
  const [coverId, setCoverId] = useState(series.coverId);
  const [orderIds, setOrderIds] = useState<string[]>(series.photoIds);

  // 抽屉保持打开时，外部（同步/冲突解决）若改了当前视图，表单跟随最新数据
  useEffect(() => {
    setTitle(series.title);
    setSummary(series.summary);
    setCoverId(series.coverId);
    setOrderIds(series.photoIds);
  }, [series]);

  const pendingFields = new Set(
    snap.pending.filter((o) => o.seriesId === series.id).map((o) => o.field),
  );

  const save = () => {
    const changes: Partial<Record<EditableField, string | string[]>> = {};
    if (title !== series.title) changes.title = title;
    if (summary !== series.summary) changes.summary = summary;
    if (coverId !== series.coverId) changes.coverId = coverId;
    if (JSON.stringify(orderIds) !== JSON.stringify(series.photoIds)) changes.order = orderIds;
    overlayStore.recordBatch(series.id, changes);
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="editor-drawer" role="dialog" aria-label={`编辑系列 ${series.title}`}>
        <p className="eyebrow">Temporary notes</p>
        <h2>编辑《{series.title}》</h2>
        <p className="hint">
          修改先保存在本地覆盖层，不会改动原始照片资料；联网后逐条与另一端合并，
          未冲突字段自动合并，同一字段两边都改时页面会出现两份版本供你选择。
        </p>

        <div className="field">
          <label htmlFor="edit-title">系列标题</label>
          <input
            id="edit-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {pendingFields.has("title") && <p className="retry-hint">该字段有等待同步的本地修改</p>}
        </div>

        <div className="field">
          <label htmlFor="edit-summary">系列说明</label>
          <textarea
            id="edit-summary"
            className="textarea"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          {pendingFields.has("summary") && <p className="retry-hint">该字段有等待同步的本地修改</p>}
        </div>

        <div className="field">
          <label htmlFor="edit-cover">封面照片</label>
          <select
            id="edit-cover"
            className="select"
            value={coverId}
            onChange={(e) => setCoverId(e.target.value)}
          >
            {orderIds.map((id) => (
              <option key={id} value={id}>
                {getPhoto(id).title}
              </option>
            ))}
          </select>
          {pendingFields.has("coverId") && <p className="retry-hint">该字段有等待同步的本地修改</p>}
        </div>

        <div className="field">
          <label>照片顺序</label>
          <ul className="order-list" data-testid="order-list">
            {orderIds.map((id, i) => {
              const p = getPhoto(id);
              return (
                <li key={id} className="order-item">
                  <img src={`/${p.file}`} alt="" loading="lazy" />
                  <span>
                    {i + 1}. {p.title}
                  </span>
                  <span className="order-controls">
                    <button
                      type="button"
                      aria-label={`上移 ${p.title}`}
                      disabled={i === 0}
                      onClick={() => setOrderIds((ids) => moveId(ids, id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`下移 ${p.title}`}
                      disabled={i === orderIds.length - 1}
                      onClick={() => setOrderIds((ids) => moveId(ids, id, 1))}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {pendingFields.has("order") && <p className="retry-hint">顺序修改等待同步中</p>}
        </div>

        <div className="drawer-actions">
          <button type="button" className="btn btn-solid" onClick={save}>
            保存到本地
          </button>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </aside>
    </>
  );
}
