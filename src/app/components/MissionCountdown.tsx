import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useState } from 'react';

import { RELAY_START } from "../lib/mission-time";
import { WORK_SUBMISSION_DEADLINE } from "../../shared/activity-rules";
import './mission-countdown.css';
export { RELAY_START } from "../lib/mission-time";
const startTime = Date.parse(RELAY_START);

export function countdownAt(now: number, targetTime = startTime) {
  const seconds = Math.max(0, Math.ceil((targetTime - now) / 1000));
  return {
    started: now >= targetTime,
    values: [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
      Math.floor(seconds / 60) % 60, seconds % 60],
  };
}

const units = ["public.countdown.days", "public.countdown.hours", "public.countdown.minutes", "public.countdown.seconds"];

export function MissionCountdown({ target = 'relay' }: { target?: 'relay' | 'submission' }) {
  const { t, language } = useSiteTranslation();
  const submission = target === 'submission';
  const targetDate = submission ? WORK_SUBMISSION_DEADLINE : RELAY_START;
  const label = submission ? t("public.countdown.submission") : t("public.countdown.relay");
  const ended = submission ? t("public.countdown.submissionEnded") : t("public.countdown.started");
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
  const countdown = countdownAt(now, Date.parse(targetDate));
  return (
    <section className="mission-countdown" aria-labelledby="countdown-title">
      <div className="mission-countdown-heading">
        <h2 id="countdown-title">{countdown.started ? submission ? ended : t("public.schedule.active") : t("public.countdown.until", { event: label })}</h2>
        <span>PROJECT STARWARD</span>
      </div>
      <div className="mission-countdown-body">
        <div className="mission-clock" role="timer" aria-live="off" aria-label={countdown.started ? ended : t("public.countdown.announcement", { event: label, days: countdown.values[0], hours: countdown.values[1], minutes: countdown.values[2], seconds: countdown.values[3] })}>
          {countdown.started ? <span className="mission-clock-started">{ended}</span> : <>
          <span className="mission-clock-prefix" aria-hidden="true">T−</span>
          {countdown.values.map((value, index) => (
            <div className="mission-clock-unit" key={units[index]} aria-hidden="true">
              <span className="mission-clock-value">{String(value).padStart(index === 0 ? 3 : 2, '0')}</span>
              <span className="mission-clock-label">{t(units[index]!)}</span>
            </div>
          ))}
          </>}
        </div>
        <div className="mission-start">
          <span>{label}</span>
          <time dateTime={targetDate}>{new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(targetDate))}</time>
          <span>{submission ? '23:00' : '00:00'} {t("public.countdown.beijing")}</span>
        </div>
      </div>
    </section>
  );
}
