const SHOW_ELEMENT = 0x1;

export function orderByDocumentPosition(elements: Iterable<HTMLElement>): HTMLElement[] {
  const list = Array.from(elements);

  if (list.length < 2) {
    return list;
  }

  const ancestor = commonAncestor(list);
  const walked = ancestor === null ? undefined : walkSubtree(list, ancestor);

  if (walked !== undefined) {
    return walked;
  }

  list.sort(compareDocumentOrder);
  return list;
}

function walkSubtree(list: HTMLElement[], ancestor: Node): HTMLElement[] | undefined {
  const document = ancestor.ownerDocument;
  if (document === null) {
    return undefined;
  }

  const remaining = new Set(list);
  const ordered: HTMLElement[] = [];

  if (remaining.delete(ancestor as HTMLElement)) {
    ordered.push(ancestor as HTMLElement);
  }

  const walker = document.createTreeWalker(ancestor, SHOW_ELEMENT);

  let budget = Math.max(32, list.length * Math.ceil(Math.log2(list.length + 1)));

  while (remaining.size > 0) {
    if (budget-- <= 0) {
      return undefined;
    }

    const node = walker.nextNode();
    if (node === null) {
      return undefined;
    }
    if (remaining.delete(node as HTMLElement)) {
      ordered.push(node as HTMLElement);
    }
  }

  return ordered;
}

function commonAncestor(list: HTMLElement[]): Node | null {
  let ancestor: Node = list[0];
  let chain: Set<Node> | undefined;

  for (let index = 1; index < list.length; index += 1) {
    const element = list[index];

    if (contains(ancestor, element)) {
      continue;
    }

    chain ??= ancestorChain(ancestor);
    const next = firstCommonAncestor(element, chain);

    if (next === null) {
      return null;
    }

    ancestor = next;
    chain = undefined;
  }

  return ancestor;
}

function contains(ancestor: Node, node: Node): boolean {
  for (let current: Node | null = node; current !== null; current = current.parentNode) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

function ancestorChain(node: Node): Set<Node> {
  const chain = new Set<Node>();
  for (let current: Node | null = node; current !== null; current = current.parentNode) {
    chain.add(current);
  }
  return chain;
}

function firstCommonAncestor(node: Node, chain: Set<Node>): Node | null {
  for (let current: Node | null = node; current !== null; current = current.parentNode) {
    if (chain.has(current)) {
      return current;
    }
  }
  return null;
}

export function compareDocumentOrder(a: HTMLElement, b: HTMLElement): number {
  const position = a.compareDocumentPosition(b);

  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
    return 0;
  }
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  return 0;
}
