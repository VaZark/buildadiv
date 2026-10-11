export type ActionState = 'pending' | 'success' | 'no-content' | 'error';
export interface ActionContext {
  pending: boolean;
  success: boolean;
  noContent: boolean;
  error: boolean;
  statusCode: number | undefined;
  nextPage: unknown;
  [key: string]: unknown;
}
export interface ActionResult<Data = unknown> {
  response: Data | null;
  context: ActionContext;
}
