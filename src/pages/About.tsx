import { PhotoImage } from '../components/PhotoImage';
import { ContactForm } from '../components/ContactForm';
import { photos } from '../data/base';

const timeline = [
  { year: '2018', desc: '开始独立摄影，以黑白人像特写起步，探索镜头前的坦露与防备。' },
  { year: '2021', desc: '首次进入高海拔地区驻地拍摄，开始自然风光与牧场生活记录。' },
  { year: '2023', desc: '《无人之境》系列在独立摄影空间展出，同期完成高原驻地计划。' },
  { year: '2024', desc: '《高原牧歌》系列完成，三个系列共同构成当前作品集。' },
];

export function About() {
  const portrait = photos.find((p) => p.id === 'portrait-02') ?? photos[0];

  return (
    <div className="container">
      <section className="section">
        <div className="about-grid">
          <div className="about-portrait">
            <PhotoImage photo={portrait} alt="摄影师肖像" />
          </div>
          <div className="about-bio">
            <p className="eyebrow">About Bio</p>
            <h1 className="section-title" style={{ marginBottom: 24 }}>
              关于林屿
            </h1>
            <p>
              独立摄影师，拍摄两类题材：黑白人像特写，以及高原地区的自然风光与牧场生活记录。
              她相信照片是光线与时间的切片，偏好留白、自然光与克制的后期。
            </p>
            <p>
              作品分为三个系列：《凝视》聚焦眼神与皮肤纹理，《无人之境》记录高海拔无人区的山脊与雾气，
              《高原牧歌》呈现牧场、牛群与人在高原上的共生关系。
            </p>

            <ul className="timeline">
              {timeline.map((t) => (
                <li key={t.year}>
                  <div className="year">{t.year}</div>
                  <div className="desc">{t.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <hr className="gold-rule" />

      <section className="section" style={{ paddingTop: 72 }}>
        <div style={{ maxWidth: 560 }}>
          <p className="eyebrow">Contact</p>
          <h2 className="section-title" style={{ marginBottom: 32 }}>
            联系
          </h2>
          <ContactForm compact />
        </div>
      </section>
    </div>
  );
}
