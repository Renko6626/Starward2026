import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { PrototypeShell } from "../app/layouts/PrototypeShell";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <PrototypeShell>
      <Outlet />
    </PrototypeShell>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-outline-variant bg-surface-container-low/80 p-10 text-center shadow-2xl backdrop-blur-md">
        <p className="mb-3 text-xs uppercase tracking-[0.32em] text-on-surface-variant">404 / Not Found</p>
        <h1 className="mb-4 font-headline text-3xl tracking-tight text-on-surface">页面未找到</h1>
        <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-on-surface-variant">
          当前站点只开放一期需要的公共页、参与者页和后台页。你访问的路径不在本次实现范围内。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            to="/"
          >
            返回开始页
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-variant px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright"
            to="/portal/login"
          >
            参与者入口
          </Link>
        </div>
      </div>
    </div>
  );
}
