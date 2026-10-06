import { ArrowUpRight } from 'lucide-react';

const references = [
  {
    topic: '地月转移', source: 'Ren et al., 2022',
    title: 'Transfers from the Earth to the Earth–Moon triangular L₄ point',
    description: '月球动力辅助转移的研究依据，主页航路按简化地月模型独立计算。',
    href: 'https://doi.org/10.1016/j.asr.2021.10.025',
  },
  {
    topic: '在轨科研站', source: 'NASA / ISS',
    title: 'International Space Station: Facts and Figures',
    description: '舱段、桁架、太阳翼与机械臂的实际在轨工程参照。',
    href: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
  },
  {
    topic: '旋转与配平', source: 'NASA-CR-181795, 1990',
    title: 'Advanced-Technology Space Station Study',
    description: '旋转人造重力与反向转子的角动量配平研究；鸟船双环布局据此独立设计。',
    href: 'https://ntrs.nasa.gov/citations/19910002472',
  },
  {
    topic: '人员转接', source: 'NASA-CR-184731, 1988',
    title: 'CAMELOT 2',
    description: '固定核心与旋转居住区之间的气密运输舱、对接与人员通路概念。',
    href: 'https://ntrs.nasa.gov/citations/19890009140',
  },
  {
    topic: '旋转接口', source: 'NASA NTRS, 1991',
    title: 'A Rotary Joint Fluid Coupling for Space Station Freedom',
    description: '固定侧与旋转侧之间的热控流体传输，为站内服务接口提供参照。',
    href: 'https://ntrs.nasa.gov/citations/19920013446',
  },
];

export function DesignReferences() {
  return (
    <section className="design-references" aria-labelledby="design-references-title">
      <h2 id="design-references-title">设计参考</h2>
      <ol className="design-reference-list">
        {references.map(reference => (
          <li key={reference.href}>
            <a href={reference.href} target="_blank" rel="noopener noreferrer">
              <div className="design-reference-source"><span>{reference.topic}</span><small>{reference.source}</small></div>
              <div className="design-reference-content"><h3>{reference.title}</h3><p>{reference.description}</p></div>
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
