import type { ActionOptions } from '../contracts/actions.js';
import type { ActionState, ActionResult } from '../contracts/results.js';

/** Give every state the same template shape while keeping built-in fields reserved. */
export function resultFor(
  fn: { options: Pick<ActionOptions, 'context'> },
  state: ActionState,
  response: unknown,
  statusCode?: number,
  args?: unknown,
  nextPage: unknown = null,
): ActionResult {
  const extra = fn.options.context?.(response, statusCode, args) || {};
  return {
    response,
    context: {
      ...extra,
      pending: state === 'pending',
      success: state === 'success',
      noContent: state === 'no-content',
      error: state === 'error',
      statusCode,
      nextPage,
    },
  };
}
/** Translate context flags to the state-template and event naming convention. */
export function stateOf(result: ActionResult): ActionState {
  return result.context.pending
    ? 'pending'
    : result.context.noContent
      ? 'no-content'
      : result.context.error
        ? 'error'
        : 'success';
}
