import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EvidenceUpload } from '../EvidenceUpload'

const VALID_SIGNATURES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  'image/webp': new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]),
  'application/pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  'text/plain': new TextEncoder().encode('Valid UTF-8 plain text evidence'),
  'video/mp4': new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]),
  'video/webm': new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]),
}

function makeValidFile(name: string, type: string): File {
  const bytes = VALID_SIGNATURES[type] ?? new TextEncoder().encode('content')
  return new File([bytes as BlobPart], name, { type })
}

describe('EvidenceUpload', () => {
  it('renders an accessible evidence URL field with empty-state guidance', () => {
    render(<EvidenceUpload />)

    expect(screen.getByLabelText('Evidence URL')).toBeInTheDocument()
    expect(screen.getByText(/Attach a public http or https link/)).toBeInTheDocument()
  })

  it('does not render the file drop zone when onFileSelect is omitted', () => {
    render(<EvidenceUpload />)

    expect(screen.queryByTestId('evidence-drop-zone')).not.toBeInTheDocument()
  })

  it('emits trimmed http or https evidence URLs', () => {
    const handleChange = vi.fn()
    render(<EvidenceUpload onChange={handleChange} />)

    fireEvent.change(screen.getByLabelText('Evidence URL'), {
      target: { value: '  https://github.com/org/repo/pull/42  ' },
    })

    expect(handleChange).toHaveBeenLastCalledWith('https://github.com/org/repo/pull/42')
    expect(screen.getByText(/Evidence link accepted/)).toBeInTheDocument()
  })

  it('rejects unsafe URL schemes and marks the field invalid after blur', () => {
    const handleChange = vi.fn()
    render(<EvidenceUpload onChange={handleChange} />)

    const input = screen.getByLabelText('Evidence URL')
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
    fireEvent.blur(input)

    expect(handleChange).toHaveBeenLastCalledWith(undefined)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/starting with http:\/\/ or https:\/\//)).toBeInTheDocument()
  })

  it('submits only validated evidence URLs', () => {
    const handleSubmit = vi.fn()
    render(<EvidenceUpload onSubmit={handleSubmit} />)

    const button = screen.getByRole('button', { name: 'Attach Evidence' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Evidence URL'), {
      target: { value: 'https://example.com/proof' },
    })
    fireEvent.click(button)

    expect(handleSubmit).toHaveBeenCalledWith('https://example.com/proof')
  })

  describe('drag-and-drop', () => {
    it('renders a drop zone with accessible label when onFileSelect is provided', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      expect(dropZone).toBeInTheDocument()
      expect(dropZone).toHaveAttribute('aria-label', 'Drop evidence file here or click to browse')
      expect(dropZone).toHaveAttribute('role', 'button')
    })

    it('shows drag-over state when dragging over the drop zone', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      fireEvent.dragEnter(dropZone)
      expect(screen.getByText(/Drop file to attach/)).toBeInTheDocument()
    })

    it('shows idle state after dragging leaves the drop zone', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      fireEvent.dragEnter(dropZone)
      fireEvent.dragLeave(dropZone)
      expect(screen.getByText(/Drag and drop a file here/)).toBeInTheDocument()
    })

    it('accepts a valid file type and signature on drop and calls onFileSelect', async () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      const file = makeValidFile('proof.pdf', 'application/pdf')

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(handleFileSelect).toHaveBeenCalledWith(file)
      })
      expect(screen.getByText(/File attached: proof\.pdf/)).toBeInTheDocument()
    })

    it('rejects disallowed file types with an error message', async () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      const file = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      expect(handleFileSelect).not.toHaveBeenCalled()
      expect(screen.getByTestId('drag-error')).toBeInTheDocument()
      expect(screen.getByText(/File type not accepted/)).toBeInTheDocument()
    })

    it('rejects an HTML file renamed to .pdf with signature mismatch error', async () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      const spoofedPdf = new File(
        ['<!DOCTYPE html><html><body>phishing</body></html>'],
        'proof.pdf',
        { type: 'application/pdf' },
      )

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [spoofedPdf] },
      })

      await waitFor(() => {
        expect(screen.getByTestId('drag-error')).toHaveTextContent(
          "File content doesn't match its type",
        )
      })
      expect(handleFileSelect).not.toHaveBeenCalled()
    })

    it('rejects multiple files dropped at once', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      const file1 = makeValidFile('proof.pdf', 'application/pdf')
      const file2 = makeValidFile('proof2.pdf', 'application/pdf')

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file1, file2] },
      })

      expect(screen.getByText(/Only one file can be attached at a time/)).toBeInTheDocument()
    })

    it('allows removing an attached file', async () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      const file = makeValidFile('proof.png', 'image/png')

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.getByText(/File attached: proof\.png/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Remove file' }))
      expect(screen.queryByText(/File attached/)).not.toBeInTheDocument()
      expect(screen.getByText(/Drag and drop a file here/)).toBeInTheDocument()
    })

    it('prevents default drag behavior to enable drop', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} />)
      const dropZone = screen.getByTestId('evidence-drop-zone')

      const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true })
      dropZone.dispatchEvent(dragOverEvent)

      // dragover default should be prevented to allow drop
      expect(dragOverEvent.defaultPrevented).toBe(true)
    })

    it('ignores stale validation result when a second file is dropped before the first finishes', async () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')

      let resolveFirstSlice!: (buf: ArrayBuffer) => void
      const firstFile = makeValidFile('first.png', 'image/png')
      vi.spyOn(firstFile, 'slice').mockReturnValue({
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveFirstSlice = resolve
          }),
      } as Blob)

      const secondFile = makeValidFile('second.pdf', 'application/pdf')

      // Drop first file (remains pending)
      fireEvent.drop(dropZone, { dataTransfer: { files: [firstFile] } })
      // Drop second file immediately (resolves first)
      fireEvent.drop(dropZone, { dataTransfer: { files: [secondFile] } })

      await waitFor(() => {
        expect(handleFileSelect).toHaveBeenCalledWith(secondFile)
      })
      expect(screen.getByText(/File attached: second\.pdf/)).toBeInTheDocument()

      // Now resolve the first file's header bytes with valid PNG magic
      resolveFirstSlice(VALID_SIGNATURES['image/png'].buffer.slice(0) as ArrayBuffer)
      await new Promise((r) => setTimeout(r, 10))

      // Only the second file should have won
      expect(handleFileSelect).toHaveBeenCalledTimes(1)
      expect(handleFileSelect).toHaveBeenLastCalledWith(secondFile)
      expect(screen.getByText(/File attached: second\.pdf/)).toBeInTheDocument()
    })
  })

  describe('file type validation', () => {
    const validTypes = [
      { name: 'image.jpg', type: 'image/jpeg' },
      { name: 'image.png', type: 'image/png' },
      { name: 'image.gif', type: 'image/gif' },
      { name: 'image.webp', type: 'image/webp' },
      { name: 'document.pdf', type: 'application/pdf' },
      { name: 'notes.txt', type: 'text/plain' },
      { name: 'video.mp4', type: 'video/mp4' },
      { name: 'video.webm', type: 'video/webm' },
    ]

    validTypes.forEach(({ name, type }) => {
      it(`accepts ${type} files with matching signature`, async () => {
        const handleFileSelect = vi.fn()
        render(<EvidenceUpload onFileSelect={handleFileSelect} />)

        const dropZone = screen.getByTestId('evidence-drop-zone')
        const file = makeValidFile(name, type)

        fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

        await waitFor(() => {
          expect(handleFileSelect).toHaveBeenCalledWith(file)
        })
        expect(screen.queryByTestId('drag-error')).not.toBeInTheDocument()
      })
    })

    const invalidTypes = [
      { name: 'script.js', type: 'application/javascript' },
      { name: 'archive.zip', type: 'application/zip' },
      { name: 'binary.exe', type: 'application/x-msdownload' },
    ]

    invalidTypes.forEach(({ name, type }) => {
      it(`rejects ${type} files`, () => {
        const handleFileSelect = vi.fn()
        render(<EvidenceUpload onFileSelect={handleFileSelect} />)

        const dropZone = screen.getByTestId('evidence-drop-zone')
        const file = new File(['content'], name, { type })

        fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

        expect(handleFileSelect).not.toHaveBeenCalled()
        expect(screen.getByTestId('drag-error')).toBeInTheDocument()
      })
    })

    it('accepts custom acceptedFileTypes when provided', async () => {
      const handleFileSelect = vi.fn()
      render(
        <EvidenceUpload
          onFileSelect={handleFileSelect}
          acceptedFileTypes={['text/plain']}
        />
      )

      const dropZone = screen.getByTestId('evidence-drop-zone')

      // Accepted type
      const txtFile = makeValidFile('notes.txt', 'text/plain')
      fireEvent.drop(dropZone, { dataTransfer: { files: [txtFile] } })
      await waitFor(() => {
        expect(handleFileSelect).toHaveBeenCalledWith(txtFile)
      })

      handleFileSelect.mockClear()

      // Now drop a pdf which is not in custom accepted list
      const pdfFile = makeValidFile('proof.pdf', 'application/pdf')
      fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })
      expect(handleFileSelect).not.toHaveBeenCalled()
    })
  })

  describe('file size validation', () => {
    it('accepts a file within the default 50 MB limit', async () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      // 1 MB file starting with valid %PDF- magic header
      const buffer = new Uint8Array(1024 * 1024)
      buffer.set(VALID_SIGNATURES['application/pdf'], 0)
      const smallFile = new File([buffer as BlobPart], 'proof.pdf', { type: 'application/pdf' })
      fireEvent.drop(dropZone, { dataTransfer: { files: [smallFile] } })

      await waitFor(() => {
        expect(handleFileSelect).toHaveBeenCalledWith(smallFile)
      })
      expect(screen.queryByTestId('drag-error')).not.toBeInTheDocument()
    })

    it('rejects a file that exceeds the default 50 MB limit', () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      // Simulate a 60 MB file by overriding the size property
      const bigFile = Object.defineProperty(
        makeValidFile('huge-video.mp4', 'video/mp4'),
        'size',
        { value: 60 * 1024 * 1024 }
      )
      fireEvent.drop(dropZone, { dataTransfer: { files: [bigFile] } })

      expect(handleFileSelect).not.toHaveBeenCalled()
      expect(screen.getByTestId('drag-error')).toBeInTheDocument()
      expect(screen.getByText(/File is too large/)).toBeInTheDocument()
      expect(screen.getByText(/Maximum allowed size is 50 MB/)).toBeInTheDocument()
    })

    it('respects a custom maxFileSizeBytes prop', () => {
      const handleFileSelect = vi.fn()
      render(<EvidenceUpload onFileSelect={handleFileSelect} maxFileSizeBytes={1024} />)

      const dropZone = screen.getByTestId('evidence-drop-zone')
      // 2 KB file — exceeds the custom 1 KB limit
      const tooBig = Object.defineProperty(
        makeValidFile('proof.pdf', 'application/pdf'),
        'size',
        { value: 2048 }
      )
      fireEvent.drop(dropZone, { dataTransfer: { files: [tooBig] } })

      expect(handleFileSelect).not.toHaveBeenCalled()
      expect(screen.getByTestId('drag-error')).toBeInTheDocument()
      expect(screen.getByText(/File is too large/)).toBeInTheDocument()
    })

    it('shows the max file size in the drop zone hint', () => {
      render(<EvidenceUpload onFileSelect={vi.fn()} maxFileSizeBytes={10 * 1024 * 1024} />)
      expect(screen.getByText(/Max size: 10 MB/)).toBeInTheDocument()
    })
  })
})
