export function csv(rows: (string | number | null | undefined)[][]) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    const text = value == null ? "" : String(value);
    const safe = typeof value === "string" && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}
