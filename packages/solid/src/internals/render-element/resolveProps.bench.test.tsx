import { render } from "@solidjs/testing-library";
import { $PROXY, createRoot, createSignal, flush } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const counters = vi.hoisted(() => ({ merges: 0 }));

vi.mock("solid-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("solid-js")>();
  return {
    ...actual,
    merge: (...args: any[]) => {
      counters.merges += 1;
      return (actual.merge as any)(...args);
    },
  };
});

const { RenderElement } = await import("./RenderElement");

const report: string[] = [];

function record(line: string) {
  report.push(line);
}

beforeEach(() => {
  counters.merges = 0;
});

/* ------------------------------------------------------------------ *
 * Shapes that RenderElement is asked to resolve across the library
 * ------------------------------------------------------------------ */

/**
 * Stands in for a Solid props proxy: a source that reports `$PROXY` because the
 * set of keys it exposes can still grow after it is handed over.
 */
function dynamicProps(backing: Record<string, any>): Record<string, any> {
  return new Proxy(backing, {
    has: (target, key) => key === $PROXY || key in target,
    ownKeys: (target) => Reflect.ownKeys(target),
    getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
    },
  });
}

function ProxySource(props: Record<string, any>) {
  return <RenderElement as="div" props={[{ class: "base" }, props]} />;
}

const SHAPES: Array<{ name: string; render: () => any }> = [
  { name: "single source", render: () => <RenderElement as="div" props={{ id: "a" }} /> },
  { name: "state + one source", render: () => <RenderElement as="div" state={{ active: () => true }} props={[{ id: "a" }]} /> },
  { name: "two object sources", render: () => <RenderElement as="div" props={[{ id: "a" }, { title: "b" }]} /> },
  {
    name: "object + function source",
    render: () => <RenderElement as="div" props={[{ id: "a" }, (external: any) => ({ title: external.id })]} />,
  },
  {
    name: "class callback + ref",
    render: () => (
      <RenderElement as="div" state={{ active: () => true }} props={[{ class: (state: any) => (state.active() ? "on" : "") }]} />
    ),
  },
  { name: "props proxy source", render: () => <ProxySource {...dynamicProps({ id: "p" })} /> },
  {
    name: "proxy carrying class",
    render: () => <ProxySourceWithClass {...dynamicProps({ id: "p", class: () => "styled" })} />,
  },
];

function ProxySourceWithClass(props: Record<string, any>) {
  return <RenderElement as="div" state={{ active: () => true }} props={[props]} />;
}

describe("benchmark: prop layer resolution (experiment 4)", () => {
  it("keeps the merge proxy off all but the genuinely dynamic shapes", () => {
    record("");
    record("merge() proxies allocated per rendered element");
    record("  shape                    | proxies");

    const results: Array<{ name: string; merges: number }> = [];

    for (const shape of SHAPES) {
      counters.merges = 0;
      render(shape.render);
      flush();
      results.push({ name: shape.name, merges: counters.merges });
      record(`  ${shape.name.padEnd(24)} | ${String(counters.merges).padStart(7)}`);
    }

    const byName = Object.fromEntries(results.map((entry) => [entry.name, entry.merges]));

    // Everything with a statically known key set collapses to a plain object.
    expect(byName["single source"]).toBe(0);
    expect(byName["state + one source"]).toBe(0);
    expect(byName["two object sources"]).toBe(0);
    expect(byName["object + function source"]).toBe(0);
    expect(byName["class callback + ref"]).toBe(0);

    // Only a props proxy whose keys can still appear needs one.
    expect(byName["props proxy source"]).toBe(1);

    // A proxy that carries `class` is rebuilt into a fixed key set before it
    // ever becomes a layer, so it now takes the fast path. The previous check
    // looked at the raw source and sent this shape through `merge` anyway,
    // even though the rebuilt layer could no longer gain keys.
    expect(byName["proxy carrying class"]).toBe(0);
  });

  it("collapses to plain objects rather than proxies", () => {
    const seen: Record<string, any>[] = [];

    render(() => (
      <RenderElement
        as="div"
        state={{ active: () => true }}
        props={[
          { id: "a" },
          { title: "b" },
          (external: any): Record<string, any> => {
            seen.push(external);
            return { role: "button" };
          },
        ]}
      />
    ));

    record("");
    record("intermediate props object handed to a function source");
    record(`  is a proxy: ${$PROXY in seen[0]}`);
    record(`  own keys:   ${Object.keys(seen[0]).join(", ")}`);

    expect(seen).toHaveLength(1);
    expect($PROXY in seen[0]).toBe(false);
    expect(Object.keys(seen[0])).toEqual(["id", "title"]);
  });

  it("resolves a layer stack in one pass regardless of source count", () => {
    record("");
    record("property reads to resolve every key once");
    record("  sources | layers | reads");

    for (const count of [2, 4, 8]) {
      let reads = 0;

      const sources = Array.from({ length: count }, (_, index) => {
        const source: Record<string, any> = {};
        Object.defineProperty(source, `key${index}`, {
          enumerable: true,
          configurable: true,
          get: () => {
            reads += 1;
            return `value${index}`;
          },
        });
        return source;
      });

      const { container } = render(() => <RenderElement as="div" props={sources} />);
      flush();
      const element = container.querySelector("div")!;

      record(`  ${String(count).padStart(7)} | ${String(count).padStart(6)} | ${String(reads).padStart(5)}`);

      // Each key is read once to write it to the DOM, not once per layer.
      expect(reads).toBe(count);
      for (let index = 0; index < count; index += 1) {
        expect(element.getAttribute(`key${index}`)).toBe(`value${index}`);
      }
    }
  });

  it("produces the same DOM as the branchier implementation for every shape", () => {
    const html: string[] = [];

    for (const shape of SHAPES) {
      const { container } = render(shape.render);
      flush();
      html.push(container.innerHTML);
    }

    record("");
    record("rendered output per shape");
    for (let index = 0; index < SHAPES.length; index += 1) {
      record(`  ${SHAPES[index].name.padEnd(24)} | ${html[index]}`);
    }

    expect(html).toEqual([
      '<div id="a"></div>',
      '<div id="a" data-active=""></div>',
      '<div id="a" title="b"></div>',
      '<div id="a" title="a"></div>',
      '<div class="on" data-active=""></div>',
      '<div class="base" id="p"></div>',
      '<div id="p" class="styled" data-active=""></div>',
    ]);
  });

  it("keeps reactivity through the collapsed layers", () => {
    createRoot((dispose) => {
      const [title, setTitle] = createSignal("before", { ownedWrite: true });
      const { container } = render(() => (
        <RenderElement as="div" props={[{ id: "a" }, { get title() { return title(); } }]} />
      ));
      flush();

      const element = container.querySelector("div")!;
      expect(element.getAttribute("title")).toBe("before");

      setTitle("after");
      flush();
      expect(element.getAttribute("title")).toBe("after");
      dispose();
    });
  });
});

const isBrowser = Boolean((globalThis as unknown as { __vitest_browser__?: boolean }).__vitest_browser__);

describe.skipIf(isBrowser)("benchmark: prop resolution shape (experiment 4, Node only)", () => {
  it("has one code path collecting layers instead of two parallel ones", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "RenderElement.tsx"), "utf8");

    record("");
    record("prop resolution helpers");
    for (const name of ["resolveProps", "combineLayers", "reactiveLayer", "createSourceResolver", "createRefChain"]) {
      record(`  kept:    ${name}`);
      expect(source).toContain(`function ${name}`);
    }
    for (const name of ["mergeSources", "collapseSources", "mergeAll", "flatten"]) {
      record(`  removed: ${name}`);
      expect(source).not.toContain(`function ${name}`);
    }

    // The source-collecting loop exists exactly once.
    expect(source.match(/for \(const source of propsSources\)/g)).toHaveLength(1);
  });
});

describe("benchmark report (experiment 4)", () => {
  it("prints the collected measurements", () => {
    console.log(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});
