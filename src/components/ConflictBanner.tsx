import { getPhoto } from "../data/catalog";
import { overlayStore } from "../sync/store";
import { useOverlay } from "../state/OverlayContext";
import type { EditableField } from "../data/types";
import type { FieldValue } from "../sync/types";

const FIELD_LABEL: Record<EditableField, string> = {
  title: "标题",
  summary: "系列说明",
  coverId: "封面",
  order: "照片顺序",
};

function renderValue(field: EditableField, value: FieldValue): string {
  if (field === "order") {
    return (value as string[]).map((id) => getPhoto(id).title).join(" → ");
  }
  return String(value);
}

/**
 * 系列页冲突横幅：同一字段两边都改过、自动合并无法决断时出现，
 * 两个版本都保留，直到摄影师二选一。未冲突字段此时已经自动合并。
 */
export function ConflictBanner({ seriesId }: { seriesId: string }) {
  const { snap } = useOverlay();
  const conflicts = snap.conflicts[seriesId];
  if (!conflicts || Object.keys(conflicts).length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }} data-testid="conflict-banner">
      {(Object.keys(conflicts) as EditableField[]).map((field) => {
        const cf = conflicts[field];
        if (!cf) return null;
        return (
          <div className="conflict-box" key={field} data-testid={`conflict-${field}`}>
            <h4>「{FIELD_LABEL[field]}」存在两个版本，等待选择</h4>
            <p>另一处编辑与你修改了同一个字段；其余未冲突的修改已经自动合并。</p>
            <button
              type="button"
              className="conflict-choice"
              onClick={() => overlayStore.resolveConflict(seriesId, field, "remote")}
            >
              <b>采用另一处版本</b>
              {renderValue(field, cf.remote)}
            </button>
            <button
              type="button"
              className="conflict-choice"
              onClick={() => overlayStore.resolveConflict(seriesId, field, "local")}
            >
              <b>保留我的版本</b>
              {renderValue(field, cf.local)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
