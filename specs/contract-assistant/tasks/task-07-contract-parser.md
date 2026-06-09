# Task 07: Contract Parser Utility

## Status

complete

## Wave

2

## Description

Create a client-side utility that extracts plain text from uploaded contract files. Only two formats are supported: PDF (using `pdfjs-dist`) and plain text (using `FileReader`). The original file never leaves the browser — only the extracted string is used downstream. This is a pure utility module with no UI and no external API calls.

## Dependencies

**Depends on:** task-01-typescript-tailwind
**Blocks:** task-13-azure-ai-integration

**Context from dependencies:**
- task-01 installed `pdfjs-dist` as a project dependency (it's already in `node_modules`). The project is now TypeScript.

## Files to Create

- `src/utils/contractParser.ts` — exports `parseContract(file: File): Promise<string>`

## Technical Details

### Implementation Steps

1. Create `src/utils/contractParser.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist'

// pdfjs requires a worker. In Vite, import the worker as a URL.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export class ContractParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractParseError'
  }
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageText)
  }

  const text = pageTexts.join('\n\n').trim()
  if (!text) throw new ContractParseError('No text could be extracted from this PDF.')
  return text
}

async function parseTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string).trim()
      if (!text) reject(new ContractParseError('The text file appears to be empty.'))
      else resolve(text)
    }
    reader.onerror = () => reject(new ContractParseError('Failed to read the text file.'))
    reader.readAsText(file, 'utf-8')
  })
}

export async function parseContract(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()

  if (type === 'application/pdf' || ext === 'pdf') {
    return parsePdf(file)
  }

  if (
    type === 'text/plain' ||
    ext === 'txt'
  ) {
    return parseTxt(file)
  }

  throw new ContractParseError(
    `Unsupported file type: ${file.type || ext}. Please upload a PDF or TXT file.`
  )
}

export function getContractFileSizeWarning(file: File): string | null {
  const MB = 1024 * 1024
  if (file.size > 10 * MB) {
    return 'This file is large (>10 MB). Parsing may take a moment.'
  }
  return null
}
```

### pdfjs Worker Configuration

Vite's `?url` import suffix returns the worker file's URL as a string at build time. This is the correct way to configure `pdfjs-dist` in a Vite project. The worker file is at `pdfjs-dist/build/pdf.worker.min.mjs`.

If the `?url` import causes a TypeScript error (`Cannot find module 'pdfjs-dist/build/pdf.worker.min.mjs?url'`), add this to `src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```
Vite provides type definitions for `?url`, `?raw`, etc. queries, but only when this triple-slash reference is present.

### File Validation Approach

`parseContract` checks both the MIME type (`file.type`) and the file extension. This handles cases where the OS doesn't set a MIME type correctly. Unsupported files throw `ContractParseError` (a subclass of `Error`) so callers can display a user-friendly message.

## Acceptance Criteria

- [ ] `parseContract(pdfFile)` returns a non-empty string of extracted text for a standard legal PDF
- [ ] `parseContract(txtFile)` returns the raw text content for a `.txt` file
- [ ] `parseContract(docxFile)` throws `ContractParseError` with a clear message
- [ ] `parseContract` does not make any network requests
- [ ] `npx tsc --noEmit` passes for this file
- [ ] The pdfjs worker is correctly configured and no "Setting up fake worker" console warnings appear

## Notes

- `pdfjs-dist` v4 uses `.mjs` extensions for its built files. If the worker path causes a build error, try `pdfjs-dist/build/pdf.worker.min.js?url` (no `.mjs`).
- PDF text extraction from scanned PDFs (image-only) will return empty — that case is handled by the "No text could be extracted" error. Inform the user they need a text-layer PDF.
- Do not add DOCX support — it was explicitly excluded from requirements.
