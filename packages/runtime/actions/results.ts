import type { ActionOptions } from '../contracts/actions.js';
import type { ActionState, ActionResult } from '../contracts/results.js';
import { reportFailure } from '../events.js';

/**
 * Give every state the same template shape while keeping built-in fields reserved.
 * The action's context function runs in every state with a possibly null response;
 * its shape is the application's. A throwing context function is reported and adds
 * no fields, so it can never block a request or leave an unhandled rejection.
 */
export function resultFor(
  fn: { options: Pick<ActionOptions, 'context'> },
  state: ActionState,
  response: unknown,
  statusCode?: number,
  args?: unknown,
  nextPage: unknown = null,
): ActionResult {
  let extra: Record<string, unknown> = {};
  try {
    extra = fn.options.context?.(response, statusCode, args) || {};
  } catch (error) {
    reportFailure(error);
  }
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
