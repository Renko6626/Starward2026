import { useEffect, useState } from "react";
import type { ApplicationIntakeResponse } from "../../shared/applications";
import { requestJson } from "./api";
import { useSiteTranslation } from '../../i18n/use-site-translation';

type IntakeState =
  | { status: "loading" }
  | { status: "ready"; payload: ApplicationIntakeResponse }
  | { status: "error"; message: string };

export function useApplicationIntake(refreshInterval = 0) {
  const { language } = useSiteTranslation();
  const [state, setState] = useState<IntakeState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const payload = await requestJson<ApplicationIntakeResponse>("/api/applications/intake", {
          signal: controller.signal, cache: "no-store",
        });
        if (!controller.signal.aborted) setState({ status: "ready", payload });
      } catch (error: unknown) {
        if (!controller.signal.aborted) setState({
          status: "error",
          message: error instanceof Error ? error.message : language === 'en' ? 'Unable to load registration status.' : "无法读取报名状态。",
        });
      } finally {
        inFlight = false;
      }
    };
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    const timer = refreshInterval > 0 ? window.setInterval(refreshVisible, refreshInterval) : null;
    if (refreshInterval > 0) document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      controller.abort();
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refreshInterval, language]);
  return state;
}
