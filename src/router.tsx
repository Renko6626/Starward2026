import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from './app/components/NavigationFeedback';
import { animateView, getViewAnimations, type ViewTransitionBuilder } from 'motion';
import { flushSync } from 'react-dom';

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 150,
  defaultPendingMinMs: 0,
});

// Animate snapshots at the router's commit boundary, not a keyed Outlet.
// Each page keeps its own layout; only one live page (and WebGL scene) exists.
let pageTransition: ViewTransitionBuilder | undefined;
router.startViewTransition = (commit) => {
  // Finish the previous visual transition so rapid navigation never queues
  // behind its remaining animation. The commit callback still runs once.
  pageTransition?.then(() => {
    getViewAnimations().forEach(animation => animation.finish());
  });
  const previous = router.state.resolvedLocation;
  if (!previous || previous.pathname === router.latestLocation.pathname
    || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    void commit();
    return;
  }
  pageTransition = animateView(async () => {
    let committed: Promise<void>;
    flushSync(() => { committed = commit(); });
    await committed!;
  }, { duration: 0.2, ease: 'easeOut' })
    .old({ opacity: [1, 0] })
    .new({ opacity: [0, 1] });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
