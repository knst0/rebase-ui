import { createRouter } from "@solidjs/router";
import { fileRoutes } from "@solidjs/router/fs";
import { pageRoutes } from "virtual:file-routes";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const Router = createRouter({ base: base === "/" ? "" : base, routes: fileRoutes(pageRoutes) });

export const { paths } = Router;
