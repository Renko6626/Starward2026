export interface StationScene {
  setPaused(paused: boolean): void;
  setScrollProgress(progress: number): void;
  dispose(): void;
}
export function mountStationScene(
  container: HTMLElement,
  options?: { staticFrame?: boolean; paused?: boolean; onReady?: () => void; onUnavailable?: () => void },
): StationScene;
