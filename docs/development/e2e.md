# Browser E2E

Use Node.js 24. Install the locked dependencies and Chromium once:

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

The suite starts the real Vite frontend and Cloudflare Worker at `http://127.0.0.1:21262`, migrates a temporary local D1 database, and resets business fixtures before every test. It runs serially with one Chromium worker and the browser’s reduced-motion preference, so these functional checks do not benchmark animation performance. The mobile project uses Chromium with an iPhone 13 viewport/touch profile; it does not test Safari.

The launcher generates an isolated Wrangler configuration and empty `.dev.vars` in a temporary directory. Fixture SQL runs through the same D1 binding via a wrapper generated only in the temporary Worker entry. The production Worker has no fixture route. This avoids file-level SQLite lock contention. The test service does not load daily `.dev.vars`, frontend `.env` files, or `.wrangler/state`. The temporary directory is removed when the run ends. Port 21262 must be free; an existing service is never reused.

Business tests use signed sessions for two fixture authors, and the existing localhost admin bypass. The registration test creates a real account, submits a real application, signs out, signs out, and signs in again. Password rejection remains covered by the auth unit tests because the local Vite proxy can turn an upstream 401 response into a development overlay. Turnstile and email delivery are not enabled in this environment. Existing auth unit tests cover captcha contracts; this suite makes no claim about Cloudflare's external challenge service.

Run a subset or open a browser:

```sh
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-chromium
npm run test:e2e -- -g '满额|24 个'
npm run test:e2e:headed
```

Use the npm launcher rather than invoking `playwright test` directly: it owns the isolated configuration and database lifecycle. Tests can be selected and rerun independently. The suite does not mock business API responses, use a production test endpoint, or need Docker/Testcontainers.

Coverage includes registration/required fields, unassigned applications after all 24 seats are occupied, reservation/withdrawal, admin approval and assignment from both admin screens, inserted ordinary/special seats, chronological neighbors, special seat visibility, author swaps, release/reclaim, and locked/completed assignments. Mobile tests repeat registration/login and a two-author swap.

Publication currently has a deliberate coverage boundary: `RelayPublicationNotice` is not mounted by a route, and `/portal/project` redirects to the author overview. The publication test calls the existing authenticated Worker endpoint, then checks the public work page and updated link in Chromium. It does **not** establish that an author can find and submit a release confirmation through the current UI.

Pull requests run `.github/workflows/e2e.yml`. The workflow checks E2E TypeScript, runs the suite, and uploads diagnostics. Local runs retain failure traces, screenshots and videos in `test-results/`, and Worker/Vite logs in `playwright-logs/server.log`. CI also produces `playwright-report/`. These paths are ignored by Git.

```sh
npx playwright show-trace test-results/<failed-test>/trace.zip
npx playwright show-report
```

`npm run check` includes the E2E configuration and tests. `npm test` remains the fast unit/integration suite. Browser checks live only in the E2E workflow and do not duplicate deployment validation.
