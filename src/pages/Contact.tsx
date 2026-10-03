import { ContactForm } from '../components/ContactForm';

export function Contact() {
  return (
    <div className="container">
      <section className="section" style={{ maxWidth: 640 }}>
        <p className="eyebrow">Contact</p>
        <h1 className="section-title" style={{ marginBottom: 16 }}>
          联系我
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: 36 }}>
          约拍、展览或作品授权，欢迎留言。通常会在 48 小时内回复。
        </p>
        <ContactForm />
      </section>
    </div>
  );
}
