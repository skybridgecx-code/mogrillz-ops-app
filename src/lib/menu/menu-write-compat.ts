export const OPTIONAL_MENU_MACRO_COLUMNS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;

type MenuWriteError = {
  code?: string | null;
  message?: string | null;
};

const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

export function isMissingOptionalMenuMacroColumn(error: MenuWriteError | null | undefined) {
  if (!error?.code || !MISSING_COLUMN_CODES.has(error.code)) return false;
  const message = error.message?.toLocaleLowerCase() ?? "";
  return OPTIONAL_MENU_MACRO_COLUMNS.some((column) => message.includes(column));
}

export function stripOptionalMenuMacroColumns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const column of OPTIONAL_MENU_MACRO_COLUMNS) delete next[column];
  return next;
}
