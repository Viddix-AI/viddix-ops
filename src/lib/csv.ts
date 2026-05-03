// Tiny dependency-free CSV (RFC 4180–ish) helpers for import/export. We only
// need the subset that handles quoting, embedded commas, embedded quotes
// (escaped as ""), and CRLF newlines. Imports tolerate either CRLF or LF.

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(esc).join(",")]
  for (const r of rows) lines.push(r.map(esc).join(","))
  return lines.join("\r\n") + "\r\n"
}

export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  // Streaming-style parser — walks character by character so quoted fields
  // containing commas or newlines parse correctly.
  const rows: string[][] = []
  let cur: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ",") {
      cur.push(field)
      field = ""
      i++
      continue
    }
    if (c === "\r") {
      // Swallow the optional LF that follows.
      if (input[i + 1] === "\n") i++
      cur.push(field)
      rows.push(cur)
      cur = []
      field = ""
      i++
      continue
    }
    if (c === "\n") {
      cur.push(field)
      rows.push(cur)
      cur = []
      field = ""
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field)
    rows.push(cur)
  }
  // Drop trailing all-empty row caused by a final newline.
  while (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop()

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map((h) => h.trim())
  const data = rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) o[headers[j]] = (r[j] ?? "").trim()
    return o
  })
  return { headers, rows: data }
}

export function downloadCsv(filename: string, csv: string) {
  downloadFile(filename, csv, "text/csv;charset=utf-8")
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function pickCsvFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv,text/csv"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve(await file.text())
    }
    input.click()
  })
}
