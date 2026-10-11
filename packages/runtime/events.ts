import type { RegisteredAction } from './contracts/actions.js';

/**
 * Application callbacks (templates, context functions) must not break the data
 * lifecycle. Surface their failures the way an uncaught error would, then continue.
 */
export function reportFailure(error: unknown): void {
  if (typeof reportError === 'function') reportError(error);
  else console.error(error);
}

/** Document events let page behavior react without coupling requests to templates. */
export function emit(
  fn: RegisteredAction,
  event: string,
  detail: Record<string, unknown> = {},
): void {
  if (typeof document === 'undefined') return;
  const prefix = fn.options?.event || fn.actionName || fn.name;
  document.dispatchEvent(
    new CustomEvent(`${prefix}:${event}`, {
      detail: {
        action: fn.actionName || fn.name,
        method: fn.options?.method,
        event,
        ...detail,
      },
    }),
  );
}
