export interface EncodedBody {
  body?: BodyInit;
  headers?: HeadersInit;
}
export type Encoder = (body: unknown) => EncodedBody;
export type Decoder<Data = unknown> = (response: Response) => Promise<Data>;
/** One HTTP method vocabulary supplies literal unions and JavaScript boundary checks. */
export enum HttpMethod {
  GET = 'GET',
  QUERY = 'QUERY',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  CONNECT = 'CONNECT',
  TRACE = 'TRACE',
}
export type Method = `${HttpMethod}`;
export type ProviderMethod = `${HttpMethod.GET | HttpMethod.QUERY}`;
export type MutationMethod = Exclude<Method, ProviderMethod>;
