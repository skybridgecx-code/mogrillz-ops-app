export const OPTIONAL_MENU_MACRO_COLUMNS = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
] as const;

type MenuWriteError = {
  code?: string | null;
  message?: string | null;
};

const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

export function isMissingOptionalMenuMacroColumn(
  error: MenuWriteError | null | undefined,
) {
  const code = error?.code ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  if (!MISSING_COLUMN_CODES.has(code)) return false;

  return OPTIONAL_MENU_MACRO_COLUMNS.some((column) =>
    message.includes(column.toLowerCase()),
  );
}

export function stripOptionalMenuMacroColumns<T extends Record<string, unknown>>(
  payload: T,
): Omit<T, (typeof OPTIONAL_MENU_MACRO_COLUMNS)[number]> {
  const next = { ...payload };

  for (const column of OPTIONAL_MENU_MACRO_COLUMNS) {
    delete next[column];
  }

  return next;
}
