import { useMemo, useState } from "react";

interface FormValues {
  name: string;
  email: string;
  message: string;
}

type Errors = Partial<Record<keyof FormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "mira.contact.draft";
const SUBMIT_FAIL_KEY = "mira.contact.forcefail";

function validate(v: FormValues): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "请填写姓名。";
  else if (v.name.trim().length < 2) errors.name = "姓名至少需要 2 个字符。";
  if (!v.email.trim()) errors.email = "请填写邮箱。";
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = "邮箱格式不正确，例如 name@example.com。";
  if (!v.message.trim()) errors.message = "请填写留言内容。";
  else if (v.message.trim().length < 10) errors.message = "留言至少需要 10 个字符。";
  return errors;
}

function loadDraft(): FormValues {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) return { name: "", email: "", message: "", ...(JSON.parse(raw) as Partial<FormValues>) };
  } catch {
    /* 忽略损坏草稿 */
  }
  return { name: "", email: "", message: "" };
}

export function Contact() {
  const [values, setValues] = useState<FormValues>(loadDraft);
  const [touched, setTouched] = useState<Record<keyof FormValues, boolean>>({
    name: false,
    email: false,
    message: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState<FormValues | null>(null);

  // 校验未通过时提交按钮禁用；未触碰过的字段不提前报错
  const errors = useMemo(() => validate(values), [values]);
  const isValid = Object.keys(errors).length === 0;
  const showError = (field: keyof FormValues) => (touched[field] ? errors[field] : undefined);

  const update = (field: keyof FormValues, raw: string) => {
    const next = { ...values, [field]: raw };
    setValues(next);
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    if (!isValid || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // 前端模拟提交；可通过 localStorage 的开关模拟“提交失败、保留草稿可重试”
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (localStorage.getItem(SUBMIT_FAIL_KEY) === "1") {
            reject(new Error("网络异常，服务器暂时无法响应"));
          } else {
            resolve();
          }
        }, 800);
      });
      sessionStorage.removeItem(DRAFT_KEY);
      setSent(values);
    } catch (err) {
      setSubmitError(
        `${err instanceof Error ? err.message : "提交失败"}。表单内容已保留为草稿，可直接重试。`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="contact-wrap">
        <div className="success-panel" data-testid="contact-success">
          <div className="checkmark" aria-hidden>✓</div>
          <h2>留言已送达</h2>
          <p>
            谢谢你，{sent.name.trim()}。我通常会在三个工作日内通过 {sent.email.trim()} 回复。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setValues({ name: "", email: "", message: "" });
              setTouched({ name: false, email: false, message: false });
              setSent(null);
            }}
          >
            再写一条
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-wrap">
      <p className="eyebrow">Contact</p>
      <h1>联系我</h1>
      <p>拍摄合作、作品购买或驻地计划邀请，都欢迎通过下面的表单留言。</p>

      <form onSubmit={submit} noValidate data-testid="contact-form">
        <div className="form-field">
          <label htmlFor="c-name">Name</label>
          <input
            id="c-name"
            className="underline-input"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            aria-invalid={Boolean(showError("name"))}
            autoComplete="name"
          />
          <p className="field-error" role="alert">{showError("name") ?? ""}</p>
        </div>

        <div className="form-field">
          <label htmlFor="c-email">Email</label>
          <input
            id="c-email"
            type="email"
            className="underline-input"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={Boolean(showError("email"))}
            autoComplete="email"
          />
          <p className="field-error" role="alert">{showError("email") ?? ""}</p>
        </div>

        <div className="form-field">
          <label htmlFor="c-message">Message</label>
          <textarea
            id="c-message"
            className="underline-input"
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, message: true }))}
            aria-invalid={Boolean(showError("message"))}
          />
          <p className="field-error" role="alert">{showError("message") ?? ""}</p>
        </div>

        <div className="submit-row">
          <button
            type="submit"
            className="btn btn-solid"
            disabled={!isValid || submitting}
            data-testid="contact-submit"
          >
            {submitting ? "发送中…" : "Send"}
          </button>
          {submitError && (
            <span className="form-status retry-hint" role="alert" data-testid="contact-error">
              {submitError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
