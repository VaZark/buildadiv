import type { Action } from '../../packages/runtime/contracts/actions.js';
import type { RenderTemplate } from '../../packages/runtime/dom/element.js';

declare global {
  interface Window {
    firstRow: HTMLLIElement;
    secondRow: HTMLLIElement;
    clicks: number;
    events: string[];
    timeoutEvents: string[];
    formResult: { type: string; body: string; method: string } | null;
    customArgs: unknown;
    detached: RenderTemplate;
    viewportTest: Action<number>;
    invalidateViewport: Action;
    greetingBehaviorLoads?: number;
    unusedBannerLoaded?: boolean;
  }
}
