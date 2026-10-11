import { Link, Outlet, createRootRoute, useLocation } from "@tanstack/react-router";
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { adminI18n } from '../i18n';
import { isChineseAdminSurface } from '../shared/i18n';
import { useSiteTranslation } from '../i18n/use-site-translation';
import { SiteLayout } from "../app/layouts/SiteLayout";
import { NavigationFeedback } from "../app/components/NavigationFeedback";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  const { pathname } = useLocation();
  const children = <><NavigationFeedback /><SiteLayout><Outlet /></SiteLayout></>;
  return isChineseAdminSurface(pathname)
    ? <I18nextProvider i18n={adminI18n}><LanguageMetadata />{children}</I18nextProvider>
    : <><LanguageMetadata />{children}</>;
}

function LanguageMetadata() {
  const { language, t } = useSiteTranslation();
  useEffect(() => {
    document.documentElement.lang = language;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('common.siteDescription'));
    if (['逐星巡礼', 'Starward Pilgrimage'].includes(document.title)) document.title = t('common.siteTitle');
  }, [language, t]);
  return (
    null
  );
}

function NotFoundPage() {
  const { t } = useSiteTranslation();
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="panel w-full text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.32em] text-on-surface-variant">
          404 / Not Found
        </p>
        <h1 className="mb-4 font-headline text-3xl tracking-tight text-on-surface">
          {t('common.notFoundTitle')}
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base leading-7 text-on-surface-variant">
          {t('common.notFoundBody')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-base font-medium text-on-primary transition-colors hover:bg-primary/90"
            to="/"
          >
            {t('common.home')}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-variant px-5 py-2.5 text-base font-medium text-on-surface transition-colors hover:bg-surface-bright"
            to="/portal/login"
          >
            {t('common.portal')}
          </Link>
        </div>
      </div>
    </div>
  );
}
