import { useState } from 'react';
import type { FormEvent } from 'react';

type FormState = {
  name: string;
  email: string;
  message: string;
};
type Errors = Partial<Record<keyof FormState, string>>;

const initial: FormState = { name: '', email: '', message: '' };

function validate(values: FormState): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) {
    errors.name = '请填写姓名（至少 2 个字符）';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = '请填写有效的邮箱地址';
  }
  if (values.message.trim().length < 10) {
    errors.message = '留言至少 10 个字符';
  }
  return errors;
}

/** 联系表单：完整行内校验，未通过禁用提交，成功后明确反馈 */
export function ContactForm({ compact = false }: { compact?: boolean }) {
  const [values, setValues] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const currentErrors = validate(values);
  const isValid = Object.keys(currentErrors).length === 0;

  const setField = (key: keyof FormState, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    if (!isValid) return;
    setStatus('submitting');
    // 前端模拟提交（无真实后端）
    window.setTimeout(() => setStatus('success'), 900);
  };

  if (status === 'success') {
    return (
      <div className="form-success" role="status">
        <div className="check">✓</div>
        <h3>消息已发送</h3>
        <p>感谢您的来信，我会尽快回复。</p>
        <button
          className="btn ghost"
          onClick={() => {
            setValues(initial);
            setErrors({});
            setTouched({});
            setStatus('idle');
          }}
        >
          再发一条
        </button>
      </div>
    );
  }

  const show = (key: keyof FormState) => (touched[key] ? currentErrors[key] : undefined);

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className={`field ${show('name') ? 'invalid' : ''}`}>
        <label htmlFor={`${compact ? 'c-' : ''}name`}>Name</label>
        <input
          id={`${compact ? 'c-' : ''}name`}
          type="text"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="您的姓名"
          autoComplete="name"
        />
        {show('name') && <span className="field-error">{show('name')}</span>}
      </div>

      <div className={`field ${show('email') ? 'invalid' : ''}`}>
        <label htmlFor={`${compact ? 'c-' : ''}email`}>Email</label>
        <input
          id={`${compact ? 'c-' : ''}email`}
          type="email"
          value={values.email}
          onChange={(e) => setField('email', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="you@example.com"
          autoComplete="email"
        />
        {show('email') && <span className="field-error">{show('email')}</span>}
      </div>

      <div className={`field ${show('message') ? 'invalid' : ''}`}>
        <label htmlFor={`${compact ? 'c-' : ''}message`}>Message</label>
        <textarea
          id={`${compact ? 'c-' : ''}message`}
          value={values.message}
          onChange={(e) => setField('message', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, message: true }))}
          placeholder="想聊些什么…"
        />
        {show('message') && <span className="field-error">{show('message')}</span>}
      </div>

      <div>
        <button
          type="submit"
          className="btn solid"
          disabled={!isValid || status === 'submitting'}
        >
          {status === 'submitting' ? '发送中…' : 'Send'}
        </button>
        {!isValid && (
          <p className="field-error" style={{ marginTop: 10 }}>
            请补全以上字段后再提交。
          </p>
        )}
      </div>
    </form>
  );
}
