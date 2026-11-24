// Typed DOM lookups for the pages (show, audition, tests, the admin remote). A missing element, or one of
// another kind than the page expects, fails loudly with its id instead of as a null dereference later.

/** A DOM element class, such as HTMLInputElement or SVGFEGaussianBlurElement. */
export type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** The element with this id: any HTMLElement, or an instance of `type`. Throws when it is missing or of another kind. */
export function el(id: string): HTMLElement;
export function el<T extends Element>(id: string, type: ElementClass<T>): T;
export function el(id: string, type: ElementClass<Element> = HTMLElement): Element {
  const node = document.getElementById(id);
  if (node instanceof type) return node;
  throw new Error(node ? `#${id} is not a ${type.name}` : `#${id} is missing from the page`);
}

/** An event's target, checked to be an instance of `type` (for example the input a `change` came from). */
export function targetOf<T extends Element>(event: Event, type: ElementClass<T>): T {
  const { target } = event;
  if (!(target instanceof type)) throw new Error(`${event.type} event: the target is not a ${type.name}`);
  return target;
}
