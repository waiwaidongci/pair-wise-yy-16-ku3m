import { useState } from "react";
import { overlayStore } from "../sync/store";
import { useOverlay } from "../state/OverlayContext";
import { getSeries } from "../data/catalog";
import type { EditableField } from "../data/types";

const FIELD_LABEL: Record<EditableField, string> = {
  title: "标题",
  summary: "系列说明",
  coverId: "封面",
  order: "照片顺序",
};

/** 左下角同步状态：在线/离线、待合并草稿、失败重试、冲突计数、模拟开关。 */
export function SyncDock() {
  const { snap } = useOverlay();
  const [expanded, setExpanded] = useState(false);

  const connected = snap.connected;
  const failed = snap.pending.filter((o) => o.lastError).length;
  const conflictCount = Object.values(snap.conflicts).reduce(
    (n, c) => n + Object.keys(c).length,
    0,
  );
  const dotClass = !connected ? "offline" : failed > 0 || conflictCount > 0 ? "error" : "online";
  const label = !connected
    ? `离线 · ${snap.pending.length} 条改动待同步`
    : failed > 0
      ? `${failed} 条提交失败，可重试`
      : conflictCount > 0
        ? `${conflictCount} 处冲突待选择`
        : snap.pending.length > 0
          ? `正在同步 · ${snap.pending.length} 条`
          : "已同步";

  return (
    <div className="sync-dock" data-testid="sync-dock">
      <button
        type="button"
        className="sync-pill"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={`sync-dot ${dotClass}`} />
        <span data-testid="sync-label">{label}</span>
        <span aria-hidden>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="sync-panel">
          <h4>同步队列</h4>
          {snap.pending.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", margin: "0 0 10px" }}>
              没有待同步的修改。
            </p>
          ) : (
            <ul>
              {snap.pending.map((op) => {
                const s = getSeries(op.seriesId);
                return (
                  <li key={op.id}>
                    《{s?.title ?? op.seriesId}》· {FIELD_LABEL[op.field]}
                    {op.lastError ? (
                      <span className="retry-hint"> — {op.lastError}</span>
                    ) : connected ? (
                      <span className="retry-hint"> — 等待提交</span>
                    ) : (
                      <span className="retry-hint"> — 离线保留中</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="sync-row">
            <label>
              <input
                type="checkbox"
                data-testid="toggle-offline"
                checked={snap.manualOffline}
                onChange={(e) => overlayStore.setManualOffline(e.target.checked)}
              />
              模拟外拍断网
            </label>
            {failed > 0 && (
              <button type="button" className="link-btn" onClick={() => overlayStore.retryFailed()}>
                重试失败草稿
              </button>
            )}
          </div>
          <div className="sync-row">
            <label>
              <input
                type="checkbox"
                data-testid="toggle-flaky"
                checked={snap.flaky}
                onChange={(e) => overlayStore.setFlaky(e.target.checked)}
              />
              模拟弱网（提交失败、保留草稿）
            </label>
            <button
              type="button"
              className="link-btn"
              onClick={() => void overlayStore.flush()}
              disabled={!connected}
            >
              立即同步
            </button>
          </div>
          <div className="sync-row">
            <label>
              <input
                type="checkbox"
                checked={snap.autoSync}
                onChange={(e) => overlayStore.setAutoSync(e.target.checked)}
              />
              联网后自动同步
            </label>
          </div>
          {snap.lastMessage && (
            <p style={{ color: "var(--ink-faint)", margin: "8px 0 0" }}>{snap.lastMessage}</p>
          )}
          <p style={{ color: "var(--ink-faint)", fontSize: 11, margin: "8px 0 0" }}>
            编辑端 {snap.clientId}
          </p>
        </div>
      )}
    </div>
  );
}
