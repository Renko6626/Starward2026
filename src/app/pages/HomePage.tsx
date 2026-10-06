import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { OrbitalArtwork } from '../components/OrbitalArtwork';
import { MissionCountdown } from '../components/MissionCountdown';
import { DesignReferences } from '../components/DesignReferences';
import { StationBackdrop } from '../components/station/StationBackdrop';
import { ScrollReveal } from '../components/ScrollReveal';
import { useApplicationIntake } from '../lib/use-application-intake';
import { getApplicationWindowLabel } from '../../shared/windows';
import './home.css';

const steps = [
  { number: '01', title: '提交创作计划', body: '建立账号，填写联系资料并提交创作计划。' },
  { number: '02', title: '准备作品', body: '整理预告与作品说明，根据审核反馈完善内容。' },
  { number: '03', title: '认领发布时段', body: '审核通过后，在开放窗口中认领时段，按日程发布作品。' },
];

export function HomePage() {
  const intake = useApplicationIntake();
  const isOpen = intake.status === 'ready' && intake.payload.isOpen;
  const status = intake.status === 'loading' ? '正在读取活动状态'
    : intake.status === 'error' ? '暂时无法读取状态'
    : getApplicationWindowLabel(intake.payload.window);
  return (
    <div className="station-home">
      <section className="orbital-hero" aria-labelledby="home-title">
        <StationBackdrop />
        <OrbitalArtwork />
        <div className="orbital-shade" aria-hidden="true" />
        <div className="orbital-copy">
          <p className="orbital-edition">Starward2026</p>
          <h1 id="home-title">逐星巡礼</h1>
          <p className="orbital-subtitle">秘封组同人创作接力</p>
          <div className="orbital-actions">
            <Link className="orbital-primary" to="/apply">参与指南 <ArrowUpRight size={17} /></Link>
            <Link className="orbital-secondary" to="/works" search={{ view: 'gallery', type: 'all', q: '' }}>浏览作品 <ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <div className="orbital-bottom">
          <div className="orbital-status" role="status">
            <span className={`orbital-status-light ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
            <span>报名状态</span><strong>{status}</strong>
            {intake.status === 'error' ? <span className="orbital-status-error">{intake.message}</span> : null}
          </div>
          <a className="orbital-scroll" href="#about-relay">活动介绍 <ArrowDown size={13} /></a>
        </div>
      </section>
      <MissionCountdown />
      <section id="about-relay" className="relay-intro" aria-labelledby="relay-title">
        <ScrollReveal className="relay-heading">
          <h2 id="relay-title">关于活动</h2>
        </ScrollReveal>
        <ScrollReveal className="relay-statement">
          <p>逐星巡礼是以秘封组为主题的同人创作接力。参与者按约定日程发布作品。</p>
        </ScrollReveal>
      </section>
      <section className="relay-route" aria-labelledby="route-title">
        <div className="relay-route-heading"><h2 id="route-title">参与方式</h2><Link to="/apply">参与指南 <ArrowUpRight size={15} /></Link></div>
        <div className="relay-steps">
          {steps.map(step => <ScrollReveal key={step.number}><article><span>{step.number}</span><h3>{step.title}</h3><p>{step.body}</p></article></ScrollReveal>)}
        </div>
        <div className="relay-return"><span>审核结果与发布日程可在创作者工作台查看。</span><Link to="/portal/login">创作者工作台 <ArrowUpRight size={16} /></Link></div>
      </section>
      <DesignReferences />
    </div>
  );
}
