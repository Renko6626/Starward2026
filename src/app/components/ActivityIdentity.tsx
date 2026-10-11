import { useSiteTranslation } from "../../i18n/use-site-translation";
export function ActivityIdentity() {
  const { t } = useSiteTranslation();
  return <p className="page-title-meta">{t("public.brand")} <span className="page-title-year">2026</span></p>;
}
