import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { SiteFrame } from "../app/layouts/SiteFrame";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <SiteFrame>
      <Outlet />
    </SiteFrame>
  );
}

function NotFoundPage() {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>页面未找到</h1>
        <p>当前骨架只开放一期需要的公共页、后台页和参与者页。</p>
      </div>

      <Link className="button button--secondary" to="/">
        返回开始页
      </Link>
    </div>
  );
}
