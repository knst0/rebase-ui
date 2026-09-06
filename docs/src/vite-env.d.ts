/// <reference types="vite/client" />
/// <reference types="znaki/client" />
/// <reference types="../file-routes.d.ts" />
/// <reference types="../znaki.d.ts" />

declare module "virtual:components-nav" {
  import type { NavHeading, NavItem } from "../plugins/componentsNav.ts";
  export type { NavHeading, NavItem };
  export const nav: NavItem[];
  export default nav;
}

declare module "virtual:api-reference" {
  import type { ApiComponent } from "../plugins";

  export const api: Record<string, ApiComponent>;
  export default api;
}
