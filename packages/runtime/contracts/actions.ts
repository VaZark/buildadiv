import type { HttpMethod } from './http.js';
import type { Encoder, Decoder, MutationMethod } from './http.js';
import type { CacheLifetime, Tag, Pagination, Invalidation } from './queries.js';
import type { Store } from './storage.js';
import type { ActionResult } from './results.js';

type ItemOf<Data> = Data extends readonly (infer Item)[] ? Item : unknown;

/** Every HTTP action can supply request/response behavior and template context. */
export interface RequestOptions<Args = unknown, Data = unknown> {
  url: string | ((args: Args) => string);
  context?: (
    response: Data | null,
    status: number | undefined,
    args: Args,
  ) => Record<string, unknown>;
  send?: Encoder;
  accepts?: Decoder<Data>;
  timeout?: number;
  event?: string;
}

/** Read actions alone own query caching, tag provision and pagination. */
export interface QueryOptions<Args = unknown, Data = unknown> {
  provides?: Tag;
  items?: (response: Data) => unknown[];
  sort?: (a: ItemOf<Data>, b: ItemOf<Data>) => number;
  paginated?: Pagination<Args, Data>;
  merge?: (cached: Data, page: Data) => Data;
  refetchAfter?: CacheLifetime;
  keepUnusedFor?: CacheLifetime;
  persist?: Store | false;
  onRefetchFailure?: 'keep' | 'throw';
  onInvalidate?: 'pending';
}

/** Write actions alone describe effects on queries after a successful response. */
export interface WriteOptions<Args = unknown> {
  invalidates?: Invalidation<Args>;
  reconciles?: Tag;
}

// Forbidden keys reject incompatible variables as well as fresh object literals.
// Deriving them from interfaces keeps role contracts in sync when options change.
type NoQueryOptions = { [Key in keyof QueryOptions]?: never };
type NoWriteOptions = { [Key in keyof WriteOptions]?: never };

/** The baseline helper remains extensible to custom HTTP methods and behavior. */
export interface ActionOptions<Args = unknown, Data = unknown>
  extends RequestOptions<Args, Data>, QueryOptions<Args, Data>, WriteOptions<Args> {
  method: string;
}

/** GET reads have no request body; the missing method defaults to GET. */
export interface GetProviderOptions<Args = unknown, Data = unknown>
  extends RequestOptions<Args, Data>, QueryOptions<Args, Data>, NoWriteOptions {
  method?: `${HttpMethod.GET}`;
  send?: never;
}

/** QUERY reads carry a body without acquiring mutation effects. */
export interface QueryProviderOptions<Args = unknown, Data = unknown>
  extends RequestOptions<Args, Data>, QueryOptions<Args, Data>, NoWriteOptions {
  method: `${HttpMethod.QUERY}`;
}
export type ProviderOptions<Args = unknown, Data = unknown> =
  GetProviderOptions<Args, Data> | QueryProviderOptions<Args, Data>;

/** Mutation methods and forbidden query keys make read/write roles disjoint. */
export interface MutationOptions<Args = unknown, Data = unknown>
  extends RequestOptions<Args, Data>, WriteOptions<Args>, NoQueryOptions {
  method?: MutationMethod;
}

/** Providers retain GET/QUERY body rules even after defaults are applied. */
export type NormalizedProviderOptions<Args = unknown, Data = unknown> =
  | (GetProviderOptions<Args, Data> & { kind: 'provider'; method: `${HttpMethod.GET}` })
  | (QueryProviderOptions<Args, Data> & { kind: 'provider' });
export type NormalizedMutationOptions<Args = unknown, Data = unknown> = MutationOptions<
  Args,
  Data
> & { kind: 'mutation'; method: MutationMethod };
export type NormalizedGenericOptions<Args = unknown, Data = unknown> = ActionOptions<Args, Data> & {
  kind: 'action';
};

/** The discriminator selects execution behavior and narrows legal options. */
export type NormalizedActionOptions<Args = unknown, Data = unknown> =
  | NormalizedGenericOptions<Args, Data>
  | NormalizedProviderOptions<Args, Data>
  | NormalizedMutationOptions<Args, Data>;

export interface Action<
  Args = unknown,
  Data = unknown,
  Options extends NormalizedActionOptions<Args, Data> = NormalizedActionOptions<Args, Data>,
> {
  (args?: Args): Promise<ActionResult<Data>>;
  readonly options: Options;
  actionName?: string;
}
export type ProviderAction<Args = unknown, Data = unknown> = Action<
  Args,
  Data,
  NormalizedProviderOptions<Args, Data>
>;
export type MutationAction<Args = unknown, Data = unknown> = Action<
  Args,
  Data,
  NormalizedMutationOptions<Args, Data>
>;
export type GenericAction<Args = unknown, Data = unknown> = Action<
  Args,
  Data,
  NormalizedGenericOptions<Args, Data>
>;
/** Registered handwritten functions may omit helper metadata and reject normally. */
export type RegistrableAction = (...args: never[]) => Promise<unknown>;
export interface RegisteredAction {
  (args?: unknown): Promise<ActionResult | void>;
  options?: NormalizedActionOptions;
  actionName?: string;
}
