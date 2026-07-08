function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return '"' + str.replaceAll('"', '""') + '"';
  return str;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}
