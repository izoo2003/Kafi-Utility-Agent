export type CsvColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const raw = c.value(row);
        if (raw == null) return "";
        return escapeCsvCell(String(raw));
      })
      .join(","),
  );
  return [header, ...body].join("\r\n");
}

export function csvFilename(slug: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `${slug}-${day}.csv`;
}
