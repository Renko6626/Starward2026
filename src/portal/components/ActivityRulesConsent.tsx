import { Link } from "@tanstack/react-router";
import { ACTIVITY_RULES_CONSENT_TEXT, ACTIVITY_RULES_CONSENT_NOTICE } from "../../shared/activity-rules";

export function ActivityRulesConsent({ accepted, onChange, disabled = false, otp = false }: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  otp?: boolean;
}) {
  return <div className="activity-rules-consent">
    {otp ? <p className="auth-note">首次使用此邮箱会建立账号，需要同意活动规则；已有账号可直接登录。</p> : null}
    <label className="checkbox-field"><input type="checkbox" aria-label={ACTIVITY_RULES_CONSENT_TEXT} checked={accepted} disabled={disabled}
      onChange={event => onChange(event.target.checked)} />
      <span>我已阅读并同意<Link to="/rules" target="_blank" rel="noopener noreferrer">《逐星巡礼活动规则》</Link>，{ACTIVITY_RULES_CONSENT_NOTICE}</span>
    </label>
    <p className="auth-note">账号与活动资料的处理方式见<a href="/privacy" target="_blank" rel="noopener noreferrer">《隐私政策》</a>。</p>
  </div>;
}
