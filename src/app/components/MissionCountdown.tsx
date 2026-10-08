import { useEffect, useState } from 'react';

import { RELAY_START } from "../lib/mission-time";
export { RELAY_START } from "../lib/mission-time";
const startTime = Date.parse(RELAY_START);

export function countdownAt(now: number) {
  const seconds = Math.max(0, Math.ceil((startTime - now) / 1000));
  return {
    started: now >= startTime,
    values: [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
      Math.floor(seconds / 60) % 60, seconds % 60],
  };
}

const units = ['天 / DAYS', '时 / HOURS', '分 / MINUTES', '秒 / SECONDS'];

export function MissionCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const countdown = countdownAt(now);
  return (
    <section className="mission-countdown" aria-labelledby="countdown-title">
      <div className="mission-countdown-heading">
        <h2 id="countdown-title">{countdown.started ? '接力进行中' : '距接力开始'}</h2>
        <span>PROJECT STARWARD</span>
      </div>
      <div className="mission-countdown-body">
        <div className="mission-clock" role="timer" aria-live="off" aria-label={countdown.started ? '接力已开始' : `距离接力开始 ${countdown.values[0]} 天 ${countdown.values[1]} 时 ${countdown.values[2]} 分 ${countdown.values[3]} 秒`}>
          {countdown.started ? <span className="mission-clock-started">接力已开始</span> : <>
          <span className="mission-clock-prefix" aria-hidden="true">T−</span>
          {countdown.values.map((value, index) => (
            <div className="mission-clock-unit" key={units[index]} aria-hidden="true">
              <span className="mission-clock-value">{String(value).padStart(index === 0 ? 3 : 2, '0')}</span>
              <span className="mission-clock-label">{units[index]}</span>
            </div>
          ))}
          </>}
        </div>
        <div className="mission-start">
          <span>接力开始</span>
          <time dateTime={RELAY_START}>2026.11.12</time>
          <span>00:00 北京时间 / UTC+08:00</span>
        </div>
      </div>
    </section>
  );
}
