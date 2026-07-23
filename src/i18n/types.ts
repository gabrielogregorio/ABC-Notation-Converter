// Shared i18n types. The five language dictionaries import `Dict` from here and
// the provider (i18n.tsx) re-exports these so consumers keep one import path.

export type Lang = "pt" | "en" | "es" | "zh" | "ja" | "ga" | "fr" | "de" | "cy" | "gd" | "af";
export type Params = Record<string, string | number>;
export type Entry = string | ((p: Params) => string);
export type Dict = Record<string, Entry>;
