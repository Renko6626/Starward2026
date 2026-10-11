import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useRouterState } from '@tanstack/react-router';

export function NavigationFeedback() {
  const { t } = useSiteTranslation();
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  return pending ? <div className="navigation-progress navigation-progress--router" role="status" aria-label={t("public.loading.switch")}>
    <span />
  </div> : null;
}

// A lazy component can suspend after the router has resolved its match. Keep
// feedback visible for that separate stage, not just isLoading.
export function RoutePending() {
  const { t } = useSiteTranslation();
  return <div className="route-pending" aria-busy="true">
    <div className="navigation-progress" role="status" aria-label={t("public.loading.page")}><span /></div>
    <PageSkeleton />
  </div>;
}

export function PageSkeleton({ label, schedule = false }: { label?: string; schedule?: boolean }) {
  const { t } = useSiteTranslation();
  return <div className={`page-skeleton${schedule ? ' page-skeleton--schedule' : ''}`} role="status" aria-label={label ?? t("public.loading.page")} aria-busy="true">
    <div className="page-skeleton-heading" aria-hidden="true" />
    <div className="page-skeleton-lines" aria-hidden="true">
      <span /><span /><span />
    </div>
  </div>;
}
