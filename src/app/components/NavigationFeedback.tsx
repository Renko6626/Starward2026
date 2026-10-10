import { useRouterState } from '@tanstack/react-router';

export function NavigationFeedback() {
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  return pending ? <div className="navigation-progress navigation-progress--router" role="status" aria-label="正在切换页面">
    <span />
  </div> : null;
}

// A lazy component can suspend after the router has resolved its match. Keep
// feedback visible for that separate stage, not just isLoading.
export function RoutePending() {
  return <div className="route-pending" aria-busy="true">
    <div className="navigation-progress" role="status" aria-label="正在加载页面"><span /></div>
    <PageSkeleton />
  </div>;
}

export function PageSkeleton({ label = '正在加载页面', schedule = false }: { label?: string; schedule?: boolean }) {
  return <div className={`page-skeleton${schedule ? ' page-skeleton--schedule' : ''}`} role="status" aria-label={label} aria-busy="true">
    <div className="page-skeleton-heading" aria-hidden="true" />
    <div className="page-skeleton-lines" aria-hidden="true">
      <span /><span /><span />
    </div>
  </div>;
}
