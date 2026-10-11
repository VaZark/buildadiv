import type {
  Action,
  ActionOptions,
  QueryOptions,
  MutationOptions,
  QueryAction,
  MutationAction,
  GenericAction,
  NormalizedQueryOptions,
  NormalizedMutationOptions,
  NormalizedGenericOptions,
  NormalizedActionOptions,
} from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import { HttpMethod } from '../contracts/http.js';
import { isReadMethod, isMutationMethod } from './methods.js';
import { executeRequest } from './request.js';
import { getEntry } from '../data/entries.js';
import { load, refresh } from '../data/queries.js';

/**
 * Keep dynamic JavaScript values out of the request pipeline. TypeScript callers
 * cannot supply non-functions; native JavaScript consumers still receive a clear
 * boundary error instead of a failure partway through a request.
 */
function assertBehavior(name: string, behavior: unknown): void {
  if (behavior != null && typeof behavior !== 'function')
    throw new TypeError(`${name} must be a function`);
}

/** Build an HTTP function from a discriminated role; erase API generics only at the shared cache boundary. */
function createAction<Args, Data, Options extends NormalizedActionOptions<Args, Data>>(
  options: Options,
): Action<Args, Data, Options> {
  if (!options?.method || !options.url) throw new TypeError('Actions require method and url');
  if (
    options.paginated &&
    ((options.paginated.mode !== 'pages' && options.paginated.mode !== 'infinite') ||
      typeof options.paginated.nextPage !== 'function')
  ) {
    throw new TypeError('Pagination requires mode and nextPage');
  }
  assertBehavior('send', options.send);
  assertBehavior('accepts', options.accepts);
  assertBehavior('context', options.context);
  assertBehavior('items', options.items);
  assertBehavior('merge', options.merge);
  assertBehavior('sort', options.sort);

  // Each typed action retains its own callbacks. Only the heterogeneous cache
  // erases arguments/responses, passing values back to those same callbacks.
  const normalized = options as unknown as NormalizedActionOptions;
  const execute = async (args?: unknown): Promise<ActionResult> => {
    switch (normalized.kind) {
      case 'query':
        return load(getEntry(fn, args), args);
      case 'mutation':
        return executeRequest(fn, args, args, { refetch: refresh });
      case 'action':
        return isReadMethod(normalized.method)
          ? load(getEntry(fn, args), args)
          : executeRequest(fn, args, args, { refetch: refresh });
    }
  };
  const fn: Action = Object.assign(execute, { options: normalized });
  return fn as unknown as Action<Args, Data, Options>;
}

/** Create an extensible baseline action; its method is required and may be a custom HTTP token. */
export function action<Args = unknown, Data = unknown>(
  options: ActionOptions<Args, Data>,
): GenericAction<Args, Data> {
  return createAction<Args, Data, NormalizedGenericOptions<Args, Data>>({
    ...options,
    method: options.method?.toUpperCase(),
    kind: 'action',
  });
}

/** GET/QUERY interfaces forbid mutation effects and GET bodies before code can run. */
export function query<Args = unknown, Data = unknown>(
  options: QueryOptions<Args, Data>,
): QueryAction<Args, Data> {
  const method = (options.method || HttpMethod.GET).toUpperCase();
  // These guards serve untyped JavaScript imports; never fields enforce the role
  // for TypeScript callers, including options passed through intermediate variables.
  if (
    !isReadMethod(method) ||
    options.invalidates !== undefined ||
    options.reconciles !== undefined
  ) {
    throw new TypeError('Queries only read; invalidation and reconciliation belong to mutations');
  }
  if (method === HttpMethod.GET) {
    if (options.send) throw new TypeError('GET queries cannot send a body');
    return createAction<Args, Data, NormalizedQueryOptions<Args, Data>>({
      ...options,
      send: undefined,
      method,
      kind: 'query',
    });
  }
  return createAction<Args, Data, NormalizedQueryOptions<Args, Data>>({
    ...options,
    method,
    kind: 'query',
  });
}

/** Mutation interfaces forbid query options and read methods before code can run. */
export function mutation<Args = unknown, Data = unknown>(
  options: MutationOptions<Args, Data>,
): MutationAction<Args, Data> {
  const method = (options.method || HttpMethod.POST).toUpperCase();
  if (
    !isMutationMethod(method) ||
    options.provides !== undefined ||
    options.items !== undefined ||
    options.sort !== undefined ||
    options.paginated !== undefined ||
    options.merge !== undefined ||
    options.refetchAfter !== undefined ||
    options.keepUnusedFor !== undefined ||
    options.persist !== undefined ||
    options.onRefetchFailure !== undefined ||
    options.onInvalidate !== undefined
  ) {
    throw new TypeError('Mutations cannot provide or cache queries');
  }
  return createAction<Args, Data, NormalizedMutationOptions<Args, Data>>({
    ...options,
    method,
    kind: 'mutation',
  });
}
