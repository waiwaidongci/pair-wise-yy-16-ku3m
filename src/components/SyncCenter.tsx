import { useState } from 'react';
import { useOverlay } from '../overlay/OverlayProvider';
import { FIELD_LABELS, formatFieldValue, seriesTitle } from '../lib/fieldLabels';
import { setForceFail, isForceFailEnabled } from '../overlay/submit';

/**
 * 同步中心：在线状态、待提交/失败草稿、字段冲突选择。
 * 编排结果只存本地覆盖层，提交失败保留草稿可重试。
 */
export function SyncCenter() {
  const { online, forceOffline, setForceOffline, drafts, conflicts, retryDraft, resolveConflict } =
    useOverlay();
  const [open, setOpen] = useState(false);
  const [forceFail, setForceFailState] = useState(isForceFailEnabled);

  const pending = drafts.filter((d) => d.status === 'pending' || d.status === 'submitting');
  const failed = drafts.filter((d) => d.status === 'failed');
  const total = pending.length + failed.length + conflicts.length;

  const toggleForceFail = (v: boolean) => {
    setForceFail(v);
    setForceFailState(v);
  };

  return (
    <>
      <button
        className="sync-badge"
        onClick={() => setOpen((v) => !v)}
        aria-label="同步中心"
        title="同步中心"
      >
        {online ? <span className="sync-dot-online" /> : <span className="sync-dot-offline" />}
        {total > 0 && (
          <span className={`dot ${failed.length > 0 ? 'fail' : conflicts.length > 0 ? 'conflict' : ''}`}>
            {total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="sync-panel-backdrop" onClick={() => setOpen(false)} />
          <aside className="sync-panel">
            <h2>同步中心</h2>
            <p className="sub">
              编排结果保存在本地覆盖层，不会改动原始照片资料。
              {online ? ' 当前在线，改动将逐条合并。' : ' 当前离线，改动先保存在本地。'}
            </p>

            <label className="offline-toggle">
              <span>
                模拟离线（断网修改）
                <br />
                <small style={{ color: 'var(--text-mute)' }}>
                  开启后所有修改留在本地，关闭后自动逐条提交
                </small>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={forceOffline}
                  onChange={(e) => setForceOffline(e.target.checked)}
                />
                <span className="slider" />
              </span>
            </label>

            <label className="offline-toggle">
              <span>
                模拟提交失败
                <br />
                <small style={{ color: 'var(--text-mute)' }}>用于验证失败草稿可重试</small>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={forceFail}
                  onChange={(e) => toggleForceFail(e.target.checked)}
                />
                <span className="slider" />
              </span>
            </label>

            {/* 待提交草稿 */}
            <div className="sync-section">
              <h4>待提交（{pending.length}）</h4>
              {pending.length === 0 && <p className="sync-empty">没有待提交的改动。</p>}
              {pending.map((d) => (
                <div className="sync-item" key={d.id}>
                  <div className="meta">
                    <strong>{seriesTitle(d.seriesId)}</strong> ·{' '}
                    {Object.keys(d.changes)
                      .map((f) => FIELD_LABELS[f as keyof typeof FIELD_LABELS])
                      .join('、')}
                  </div>
                  <div className="meta">
                    {d.status === 'submitting' ? (
                      <span className="pending">正在提交…</span>
                    ) : (
                      <span className="pending">等待提交（离线队列）</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 失败草稿 */}
            <div className="sync-section">
              <h4>提交失败（{failed.length}）</h4>
              {failed.length === 0 && <p className="sync-empty">没有失败的草稿。</p>}
              {failed.map((d) => (
                <div className="sync-item" key={d.id}>
                  <div className="meta">
                    <strong>{seriesTitle(d.seriesId)}</strong> ·{' '}
                    {Object.keys(d.changes)
                      .map((f) => FIELD_LABELS[f as keyof typeof FIELD_LABELS])
                      .join('、')}
                  </div>
                  {d.error && <div className="error">{d.error}</div>}
                  <div className="actions">
                    <button className="btn solid" style={{ padding: '7px 18px' }} onClick={() => retryDraft(d.id)}>
                      重试
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 冲突 */}
            <div className="sync-section">
              <h4>字段冲突（{conflicts.length}）</h4>
              {conflicts.length === 0 && <p className="sync-empty">没有冲突。</p>}
              {conflicts.map((c) => (
                <div className="sync-item" key={c.id}>
                  <div className="meta">
                    <strong>{seriesTitle(c.seriesId)}</strong> · {FIELD_LABELS[c.field]}
                  </div>
                  <div className="conflict-options">
                    <button
                      className="conflict-option local"
                      onClick={() => resolveConflict(c.id, 'local')}
                    >
                      <span className="tag">保留本地</span>
                      <span className="val">{formatFieldValue(c.field, c.local)}</span>
                    </button>
                    <button
                      className="conflict-option remote"
                      onClick={() => resolveConflict(c.id, 'remote')}
                    >
                      <span className="tag">采用对方</span>
                      <span className="val">{formatFieldValue(c.field, c.remote)}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
