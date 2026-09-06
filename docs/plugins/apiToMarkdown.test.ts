import { describe, expect, it } from "vitest";

import type { ApiComponent } from "./apiReference";
import { apiToMarkdown } from "./apiToMarkdown";
import type { PageMeta } from "./frontmatter";

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
  description: "A high-quality, unstyled Solid avatar component that is easy to customize.",
  sections: ["anatomy", "api"],
};

describe("apiToMarkdown", () => {
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
