import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { getBrowserLanguage } from '../../i18n';

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    onRequest: (context) => {
      context.headers.set('Accept-Language', getBrowserLanguage());
      return context;
    },
  },
});
