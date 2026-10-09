import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { OrbitalArtwork } from '../components/OrbitalArtwork';
import { MissionCountdown } from '../components/MissionCountdown';
import { DesignReferences } from '../components/DesignReferences';
import { StationBackdrop } from '../components/station/StationBackdrop';
import { ScrollReveal } from '../components/ScrollReveal';
import { useApplicationIntake } from '../lib/use-application-intake';
import { getApplicationWindowLabel } from '../../shared/windows';
import './home.css';

const steps = [
  { number: '01', title: '注册账号', body: '使用邮箱注册，已有账号直接登录。' },
  { number: '02', title: '选择时段', body: '在时间表选择意向发布时间。' },
  { number: '03', title: '填写资料', body: '在工作台填写联系方式和创作计划，确认时间后提交报名。' },
];

export function HomePage() {
  const intake = useApplicationIntake(30_000);
  const statistics = intake.status === 'ready' ? intake.payload.statistics : null;
  const isOpen = intake.status === 'ready' && intake.payload.isOpen;
  const status = intake.status === 'loading' ? '正在读取活动状态'
    : intake.status === 'error' ? '暂时无法读取状态'
    : getApplicationWindowLabel(intake.payload.window);
  return (
    <div className="station-home">
      <StationBackdrop />
      <section className="orbital-hero" aria-labelledby="home-title">
        <OrbitalArtwork />
        <div className="orbital-copy">
          <div className="orbital-title">
            <h1 id="home-title">逐星巡礼</h1>
            <p className="orbital-edition">Starward Pilgrimage</p>
          </div>
          <p className="orbital-subtitle">2026年秘封俱乐部之日创作接力</p>
          <div className="orbital-actions">
            <Link className="orbital-primary" to="/apply">参与活动 <ArrowUpRight size={18} /></Link>
            <Link className="orbital-secondary" to="/works" search={{ view: 'gallery', type: 'all', q: '' }}>浏览作品 <ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <div className="orbital-bottom">
          <div className="orbital-status" role="status">
            <span className={`orbital-status-light ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
            <span>报名状态</span><strong>{status}</strong>
            {intake.status === 'error' ? <span className="orbital-status-error">{intake.message}</span> : null}
          </div>
          <a className="orbital-scroll" href="#participate-relay">参与方式 <ArrowDown size={13} /></a>
        </div>
      </section>
      <MissionCountdown />
      <section id="participate-relay" className="relay-route" aria-labelledby="route-title">
        <div className="relay-route-heading"><h2 id="route-title">参与活动</h2></div>
        <ol className="relay-steps">
          {steps.map((step, index) => <li key={step.number}>
            <ScrollReveal className="relay-step">
              <span className="relay-step-number" aria-hidden="true">{step.number}</span>
              <h3>{step.title}</h3><p>{step.body}</p>
            </ScrollReveal>
            {index < steps.length - 1 ? <ArrowRight className="relay-step-arrow" size={18} aria-hidden="true" /> : null}
          </li>)}
        </ol>
        <div className="relay-actions">
          <Link className="relay-start" to="/portal/login">开始报名 <ArrowUpRight size={18} /></Link>
          <Link to="/apply">查看参与指南 <ArrowUpRight size={15} /></Link>
        </div>
        <p className="relay-enrollment-note">提交后预留时段，审核通过后确认。</p>
        <div className="relay-statistics" aria-live="polite">
          {statistics ? <dl>
            <div><dt>已注册创作者</dt><dd><strong>{statistics.registeredCreators}</strong><span>人</span></dd></div>
            <div><dt>接力时段已占用</dt><dd>{statistics.schedule && statistics.schedule.total > 0
              ? <><strong>{statistics.schedule.occupied}</strong><span className="relay-statistics-divider">/</span><strong>{statistics.schedule.total}</strong></>
              : <span className="relay-statistics-note">时间表准备中</span>}</dd></div>
          </dl> : <p className="relay-statistics-note">{intake.status === 'loading' ? '正在读取参与情况' : '暂时无法读取参与情况'}</p>}
        </div>
      </section>
      <section id="about-relay" className="relay-intro" aria-labelledby="relay-title">
        <ScrollReveal className="relay-heading">
          <h2 id="relay-title">关于活动</h2>
        </ScrollReveal>
        <ScrollReveal className="relay-statement">
          <p>逐星巡礼是以秘封组为主题的同人创作接力。参与者按约定日程发布作品。</p>
        </ScrollReveal>
      </section>
      <DesignReferences />
    </div>
  );
}
