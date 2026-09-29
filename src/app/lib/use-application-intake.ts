import { useEffect, useState } from "react";
import type { ApplicationIntakeResponse } from "../../shared/applications";
import { requestJson } from "./api";

type IntakeState =
  | { status: "loading" }
  | { status: "ready"; payload: ApplicationIntakeResponse }
  | { status: "error"; message: string };

export function useApplicationIntake() {
  const [state, setState] = useState<IntakeState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<ApplicationIntakeResponse>("/api/applications/intake", {
      signal: controller.signal,
    })
      .then((payload) => {
        if (!controller.signal.aborted) setState({ status: "ready", payload });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "无法读取报名状态。",
          });
      });
    return () => controller.abort();
  }, []);
  return state;
}
