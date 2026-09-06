export type ApiProp = {
  name: string;
  type: string;
  default?: string;
  description?: string;
  required?: boolean;
};

export type ApiAttribute = {
  name: string;
  type?: string;
  description?: string;
};

export type ApiType = {
  name: string;
  source: string;
};

export type ApiPart = {
  name: string;
  description?: string;
  element?: string;
  documentation?: string;
  props: ApiProp[];
  attributes: ApiAttribute[];
  state?: ApiType;
  definitions: Record<string, string>;
};

export type ApiPartDraft = ApiPart & { base: string };

export type ApiExportGroup = {
  part: string;
  names: string[];
};

export type ApiComponent = {
  name: string;
  slug: string;
  parts: ApiPart[];
  importSpecifier: string;
  exportGroups: ApiExportGroup[];
  canonicalTypes: Record<string, string>;
};

export type ApiReferenceOptions = {
  dir: string;
  shared?: string[];
};
