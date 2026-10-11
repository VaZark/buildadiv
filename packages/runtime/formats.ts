import type { EncodedBody } from './contracts/http.js';
const isResponse = (value: unknown): value is Response =>
  typeof Response !== 'undefined' && value instanceof Response;
const isForm = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

/** JSON requests retain repeated form fields as arrays rather than losing entries. */
function objectFromForm(value: unknown): unknown {
  if (!isForm(value)) return value;
  const object: Record<string, unknown> = {};
  for (const [key, entry] of value) {
    if (!Object.hasOwn(object, key))
      Object.defineProperty(object, key, { value: entry, enumerable: true, writable: true });
    else object[key] = Array.isArray(object[key]) ? [...object[key], entry] : [object[key], entry];
  }
  return object;
}

/** One format function can decode a response or encode a supplied request body. */
export function json(value: Response): Promise<unknown>;
export function json(value: unknown): EncodedBody;
export function json(value: unknown): Promise<unknown> | EncodedBody {
  if (isResponse(value)) return value.json();
  return {
    body: JSON.stringify(objectFromForm(value)),
    headers: { 'Content-Type': 'application/json' },
  };
}

/** Plain-text actions keep strings intact and declare the request encoding. */
export function text(value: Response): Promise<string>;
export function text(value: unknown): EncodedBody;
export function text(value: unknown): Promise<string> | EncodedBody {
  if (isResponse(value)) return value.text();
  return { body: String(value), headers: { 'Content-Type': 'text/plain;charset=UTF-8' } };
}

/** Preserve uploaded files and let fetch choose the multipart boundary header. */
export function multipart(value: unknown): EncodedBody {
  if (isForm(value)) return { body: value, headers: {} };
  const body = new FormData();
  for (const [key, entry] of Object.entries(value || {})) {
    for (const item of Array.isArray(entry) ? entry : [entry])
      body.append(key, item instanceof Blob ? item : String(item));
  }
  return { body, headers: {} };
}

/** URL-encoded forms preserve repeated fields for conventional form endpoints. */
export function urlencoded(value: unknown): EncodedBody {
  const entries = isForm(value)
    ? Array.from(value, ([key, entry]) => [key, String(entry)] as [string, string])
    : Object.entries(value || {}).map(([key, entry]) => [key, String(entry)] as [string, string]);
  return {
    body: new URLSearchParams(entries),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  };
}
