const references = [
  {
    author: 'Ren J, Wang Y, Li M, Zheng J.',
    title: 'A trajectory design and optimization framework for transfers from the Earth to the Earth–Moon triangular L₄ point',
    publication: 'Advances in Space Research, 2022, 69(2): 1012–1026.',
    href: 'https://doi.org/10.1016/j.asr.2021.10.025',
  },
  {
    author: 'NASA.',
    title: 'International Space Station: Facts and Figures',
    publication: '',
    href: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
  },
  {
    author: 'Butterfield A J, et al.',
    title: 'Advanced-Technology Space Station Study: Summary of Systems and Pacing Technologies',
    publication: 'NASA-CR-181795, 1990.',
    href: 'https://ntrs.nasa.gov/citations/19910002472',
  },
  {
    author: 'University of Michigan.',
    title: 'CAMELOT 2',
    publication: 'NASA-CR-184731, 1988.',
    href: 'https://ntrs.nasa.gov/citations/19890009140',
  },
  {
    author: 'Costulis J A.',
    title: 'Development of a Rotary Joint Fluid Coupling for Space Station Freedom',
    publication: 'NASA NTRS 19920013446, 1991.',
    href: 'https://ntrs.nasa.gov/citations/19920013446',
  },
];

export function DesignReferences() {
  return (
    <section className="design-references" aria-labelledby="design-references-title">
      <h2 id="design-references-title">设计参考</h2>
      <ol className="design-reference-list">
        {references.map((reference, index) => (
          <li key={reference.href}>
            <span className="design-reference-number" aria-hidden="true">[{index + 1}]</span>
            <p>{reference.author}{' '}<a href={reference.href} target="_blank" rel="noopener noreferrer">{reference.title}</a>.{reference.publication ? ` ${reference.publication}` : ''}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
