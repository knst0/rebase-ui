import { describe, expect, it } from "vite-plus/test";

import type { PageMeta } from "../frontmatter";
import { apiToMarkdown } from "./toMarkdown";
import type { ApiComponent } from "./types";

const component: ApiComponent = {
  name: "Avatar",
  slug: "avatar",
  importSpecifier: "@rebase-ui/solid/avatar",
  exportGroups: [{ part: "Avatar.Root", names: ["AvatarRootProps", "AvatarRootState"] }],
  canonicalTypes: { "Avatar.Root.State": "AvatarRootState" },
  parts: [
    {
      name: "Avatar.Root",
      description: "The root element.",
      element: "<span>",
      props: [{ name: "as", type: "ValidComponent", default: '"span"', description: "Render as another tag.", required: false }],
      attributes: [],
      definitions: { ImageLoadingStatus: 'export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";' },
    },
  ],
};

const page: PageMeta = {
  title: "Avatar",
  subtitle: "An easily stylable avatar component.",
  description: "A high-quality, unstyled Solid.js avatar component that is easy to customize.",
  sections: ["anatomy", "api"],
};

const singlePartComponent: ApiComponent = {
  name: "Toggle",
  slug: "toggle",
  importSpecifier: "@rebase-ui/solid/toggle",
  exportGroups: [],
  canonicalTypes: {},
  parts: [
    {
      name: "Toggle",
      description: "A two-state button that can be on or off.",
      element: "<button>",
      props: [{ name: "pressed", type: "boolean", description: "Whether the toggle button is currently pressed.", required: false }],
      attributes: [{ name: "data-pressed", description: "Present when the toggle is pressed." }],
      definitions: {},
    },
  ],
};

const multiPartComponent: ApiComponent = {
  name: "Switch",
  slug: "switch",
  importSpecifier: "@rebase-ui/solid/switch",
  exportGroups: [],
  canonicalTypes: {},
  parts: [
    {
      name: "Root",
      description: "The root element.",
      element: "<span>",
      props: [{ name: "checked", type: "boolean", description: "Whether the switch is currently active.", required: false }],
      attributes: [],
      definitions: {},
    },
    {
      name: "Thumb",
      description: "The thumb element.",
      element: "<span>",
      props: [],
      attributes: [],
      definitions: {},
    },
  ],
};

const singlePartPage: PageMeta = {
  title: "Toggle",
  description: "A high-quality, unstyled Solid.js toggle component that is easy to customize.",
  sections: ["api"],
};

describe("apiToMarkdown", () => {
  it("renders a single-part component without nested subsections", () => {
    const markdown = apiToMarkdown(singlePartComponent, singlePartPage, []);

    expect(markdown).toContain("## API reference");
    expect(markdown).toContain("| `pressed` | `boolean` |");
    expect(markdown).toContain("`data-pressed`");
    expect(markdown).not.toContain("### Toggle");
    expect(markdown).not.toContain("A two-state button that can be on or off.");
    expect(markdown).not.toContain("Renders a");
  });

  it("keeps nested subsections for multi-part components", () => {
    const markdown = apiToMarkdown(multiPartComponent, singlePartPage, []);

    expect(markdown).toContain("### Root");
    expect(markdown).toContain("### Thumb");
    expect(markdown).toContain("The root element.");
    expect(markdown).toContain("Renders a `<span>` element.");
  });

  it("orders sections and renders a prop table row with its default", () => {
    const markdown = apiToMarkdown(component, page, []);

    const disclaimerIndex = markdown.indexOf("authoritative");
    const frontmatterIndex = markdown.indexOf("title: Avatar");
    const headingIndex = markdown.indexOf("# Avatar");
    const apiIndex = markdown.indexOf("## API reference");
    const additionalTypesIndex = markdown.indexOf("## Additional Types");
    const exportGroupsIndex = markdown.indexOf("## Export Groups");
    const canonicalTypesIndex = markdown.indexOf("## Canonical Types");

    expect(disclaimerIndex).toBeGreaterThanOrEqual(0);
    expect(frontmatterIndex).toBeGreaterThan(disclaimerIndex);
    expect(headingIndex).toBeGreaterThan(frontmatterIndex);
    expect(apiIndex).toBeGreaterThan(headingIndex);
    expect(additionalTypesIndex).toBeGreaterThan(apiIndex);
    expect(exportGroupsIndex).toBeGreaterThan(additionalTypesIndex);
    expect(canonicalTypesIndex).toBeGreaterThan(exportGroupsIndex);

    expect(markdown).toContain('| `as` | `ValidComponent` | `"span"` | Render as another tag. |');
    expect(markdown).toContain("ImageLoadingStatus");
    expect(markdown).toContain("Avatar.Root.State");
  });
});
