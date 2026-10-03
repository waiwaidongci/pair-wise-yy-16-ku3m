import { getPhoto } from "../data/catalog";
import { RatioImage } from "../components/RatioImage";

const TIMELINE: Array<{ year: string; text: string }> = [
  {
    year: "2015",
    text: "开始系统学习黑白暗房，第一组人像特写《低垂》在校园影展展出。",
  },
  {
    year: "2018",
    text: "首次进入高原无人区拍摄，用三个月记录山脊与雾谷在不同光线下的变化。",
  },
  {
    year: "2020",
    text: "完成系列《凝视》，专注眼神与皮肤纹理在侧光下的质感表达。",
  },
  {
    year: "2023",
    text: "跟随牧场转场路线生活半年，完成《高原牧歌》，开始独立接单与驻地创作。",
  },
];

export function About() {
  const portrait = getPhoto("portrait-01");

  return (
    <div className="container">
      <div className="about-grid">
        <div className="about-portrait">
          <RatioImage photo={portrait} eager />
        </div>
        <div className="about-text">
          <p className="eyebrow">About the artist</p>
          <h1>关于 Mira Lin</h1>
          <p>
            Mira Lin 是一名独立摄影师，长期在城市暗房与高海拔牧场之间往返。
            她相信最好的光线总是出现在愿意等待的人面前，因此习惯用大量时间
            陪在被摄者身边，直到防备松懈、真实浮现。
          </p>
          <p>
            她的作品分为两条线索：以黑白特写呈现人的《凝视》，以及记录高原
            无人区地貌与游牧日常的《无人之境》《高原牧歌》。照片只做极少的
            后期，保留光线最初落在皮肤、草甸与山脊上的样子。
          </p>

          <ul className="timeline">
            {TIMELINE.map((t) => (
              <li key={t.year}>
                <span className="year">{t.year}</span>
                <p>{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
