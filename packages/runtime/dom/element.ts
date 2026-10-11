import type { Action, RegisteredAction } from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import type { CacheEntry } from '../contracts/queries.js';

import { settings } from '../configuration/settings.js';
import { TemplateRenderer } from './bindings.js';
import { subscribe, refreshPage } from '../data/queries.js';
import { stateOf, resultFor } from '../actions/results.js';
import { emit } from '../events.js';

/** A light-DOM host connects action states to templates without owning requests. */
export class RenderTemplate extends HTMLElement {
  private slotChildren?: Node[];
  private input: unknown;
  private hasData = false;
  private unsubscribe: (() => void) | null = null;
  private observer?: IntersectionObserver;
  private started = false;
  private generation = 0;
  private action?: RegisteredAction;
  private renderer?: TemplateRenderer;
  static observedAttributes = [
    'template',
    'load-from-action',
    'subscribe-to-action',
    'on-pending',
    'on-success',
    'on-no-content',
    'on-error',
  ];
  /** Capture author slot markup once; defer startup until page modules can register actions. */
  connectedCallback() {
    if (!this.slotChildren)
      this.slotChildren = Array.from(this.childNodes).map((node) => node.cloneNode(true));
    this.style.display ||= 'contents';
    queueMicrotask(() => {
      if (this.isConnected) this.start();
    });
  }
  /** Release subscriptions/observers and invalidate pending callbacks after removal. */
  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.observer?.disconnect();
    this.started = false;
    this.generation = (this.generation || 0) + 1;
  }
  /** Switch templates or actions by releasing the previous connection before restarting. */
  attributeChangedCallback() {
    if (this.isConnected && this.started) {
      this.disconnectedCallback();
      queueMicrotask(() => this.start());
    }
  }
  /** Allow direct data rendering without introducing an action or subscription. */
  set data(value: unknown) {
    this.input = value;
    this.hasData = true;
    if (this.isConnected && this.getAttribute('template'))
      this.render(this.getAttribute('template')!, value);
  }
  get data(): unknown {
    return this.input;
  }
  /** Wait for registered actions and keep load-once regions outside the tag registry. */
  start() {
    if (this.started || !this.isConnected) return;
    const name = this.getAttribute('subscribe-to-action') || this.getAttribute('load-from-action');
    const fn = name ? settings.actions.get(name) : undefined;
    // configure() wakes waiting elements once module-local actions are registered.
    if (name && !fn) return;
    this.started = true;
    if (!name) {
      const template = this.getAttribute('template');
      if (template) this.render(template, this.input, !this.hasData);
      return;
    }
    if (!fn) return;
    this.action = fn;
    const generation = this.generation || 0;
    const receive = (result: ActionResult, entry?: CacheEntry): void => {
      if (!this.isConnected || generation !== (this.generation || 0)) return;
      const template = this.getAttribute(`on-${stateOf(result)}`);
      if (template) this.render(template, result, false, entry);
    };
    if (this.hasAttribute('subscribe-to-action') && fn.options)
      this.unsubscribe = subscribe(fn as Action, receive);
    else {
      receive(resultFor({ options: fn.options || {} }, 'pending', null));
      Promise.resolve()
        .then(() => fn())
        .then(
          (result) => {
            if (result) receive(result);
          },
          (error) => {
            receive({
              response: null,
              context: {
                pending: false,
                success: false,
                noContent: false,
                error: true,
                statusCode: undefined,
                nextPage: null,
              },
            });
            emit(fn, 'error', { error });
          },
        );
    }
  }
  /** Update mapped states and observe page rows for lazy infinite-query refreshes. */
  render(name: string, data: unknown, preview = false, entry?: CacheEntry): void {
    const template = Array.from(
      document.querySelectorAll<HTMLTemplateElement>('template[data-component]'),
    ).find((candidate) => candidate.dataset.component === name);
    if (!template) throw new Error(`Unknown template: ${name}`);
    if (this.action) emit(this.action, 'before:render', { result: data, element: this });
    if (this.renderer?.template !== template) {
      this.observer?.disconnect();
      this.replaceChildren();
      this.renderer = new TemplateRenderer(template, this);
    }
    this.renderer.update(data, this.slotChildren || [], preview, entry);
    if (
      entry?.fn.options.paginated?.mode === 'infinite' &&
      typeof IntersectionObserver !== 'undefined'
    ) {
      this.observer?.disconnect();
      this.observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((item) => item.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length)
            refreshPage(entry, Number((visible[0].target as HTMLElement).dataset.pageIndex));
        },
        { rootMargin: '100px 0px 0px 0px' },
      );
      const seen = new Set();
      for (const row of this.querySelectorAll<HTMLElement>('[data-page-index]')) {
        if (!seen.has(row.dataset.pageIndex)) {
          this.observer.observe(row);
          seen.add(row.dataset.pageIndex);
        }
      }
    }
    if (this.action) emit(this.action, 'after:render', { result: data, element: this });
  }
}

// Typed selectors expose the same data property and start method as the native element.
declare global {
  interface HTMLElementTagNameMap {
    'render-template': RenderTemplate;
  }
}
