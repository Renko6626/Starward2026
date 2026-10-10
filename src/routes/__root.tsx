import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { SiteLayout } from "../app/layouts/SiteLayout";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="panel w-full text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.32em] text-on-surface-variant">
          404 / Not Found
        </p>
        <h1 className="mb-4 font-headline text-3xl tracking-tight text-on-surface">
          页面未找到
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base leading-7 text-on-surface-variant">
          这个地址没有对应的页面。你可以返回活动首页，或进入作者页面。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-base font-medium text-on-primary transition-colors hover:bg-primary/90"
            to="/"
          >
            返回活动首页
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-variant px-5 py-2.5 text-base font-medium text-on-surface transition-colors hover:bg-surface-bright"
            to="/portal/login"
          >
            作者页面
          </Link>
        </div>
      </div>
    </div>
  );
}
