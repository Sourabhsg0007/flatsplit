// Browser-side PDF statement parsing. Loaded lazily (dynamic import) so
// pdf.js only downloads when someone actually picks a PDF file.
// The inline worker keeps this working in the single-file demo build too.

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
import { groupItemsToLines, linesToTransactions } from './pdfText'

let workerStarted = false
function ensureWorker() {
  if (!workerStarted) {
    GlobalWorkerOptions.workerPort = new PdfWorker()
    workerStarted = true
  }
}

// → { transactions, skipped } | { needsPassword: true } | { error }
export async function parsePdfStatement(arrayBuffer, password) {
  ensureWorker()
  let doc
  try {
    doc = await getDocument({ data: arrayBuffer, password: password || undefined }).promise
  } catch (err) {
    if (err?.name === 'PasswordException') {
      return { needsPassword: true, wrongPassword: err.code === 2 || /incorrect/i.test(err.message || '') }
    }
    return { error: 'Could not open that PDF. Is it a valid statement file?' }
  }

  try {
    const lines = []
    let textItems = 0
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const items = content.items.map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
      }))
      textItems += items.filter((i) => i.str.trim()).length
      lines.push(...groupItemsToLines(items))
    }
    if (textItems < 10) {
      return { error: 'This PDF has no selectable text — it looks scanned. Export a CSV or a text-based PDF from netbanking instead.' }
    }
    return linesToTransactions(lines)
  } finally {
    doc.destroy()
  }
}
