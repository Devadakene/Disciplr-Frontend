import { type ChangeEvent, type CSSProperties, type DragEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Field } from './Field'
import { Text } from './Text'
import { normalizeEvidenceUrl } from '../utils/url'
import { FILE_SIGNATURE_MISMATCH_ERROR, validateFileSignature } from '../utils/fileSignature'

type EvidenceUploadStatus = 'empty' | 'invalid' | 'valid'

const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'video/mp4',
  'video/webm',
]

const ACCEPTED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.mp4', '.webm']


interface EvidenceUploadProps {
  id?: string
  label?: string
  value?: string
  required?: boolean
  onChange?: (evidenceUrl: string | undefined) => void
  onSubmit?: (evidenceUrl: string) => void
  onFileSelect?: (file: File) => void
  acceptedFileTypes?: string[]
  /** Maximum allowed file size in bytes. Defaults to 50 MB. */
  maxFileSizeBytes?: number
}

/** Default maximum file size: 50 MB */
const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export function EvidenceUpload({
  id,
  label = 'Evidence URL',
  value = '',
  required = false,
  onChange,
  onSubmit,
  onFileSelect,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
}: EvidenceUploadProps) {
  const generatedId = useId()
  const fieldId = id || `evidence-upload-${generatedId}`
  const [rawValue, setRawValue] = useState(value)
  const [touched, setTouched] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragError, setDragError] = useState<string | undefined>(undefined)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validationTokenRef = useRef(0)

  const normalizedUrl = useMemo(() => normalizeEvidenceUrl(rawValue), [rawValue])
  const hasInput = rawValue.trim().length > 0
  const status: EvidenceUploadStatus = !hasInput ? 'empty' : normalizedUrl ? 'valid' : 'invalid'
  const error = touched && status === 'invalid'
    ? 'Enter a safe evidence URL starting with http:// or https://.'
    : undefined

  useEffect(() => {
    setRawValue(value)
  }, [value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    const nextUrl = normalizeEvidenceUrl(nextValue)

    validationTokenRef.current += 1
    setRawValue(nextValue)
    setDroppedFile(null)
    setDragError(undefined)
    onChange?.(nextUrl ?? undefined)
  }

  const handleSubmit = () => {
    setTouched(true)

    if (normalizedUrl) {
      onSubmit?.(normalizedUrl)
    }
  }

  const processFile = async (file: File) => {
    const token = ++validationTokenRef.current
    const effectiveTypes = acceptedFileTypes

    if (!effectiveTypes.includes(file.type)) {
      setDragError(
        `File type not accepted. Allowed types: ${ACCEPTED_FILE_EXTENSIONS.join(', ')}.`
      )
      setDroppedFile(null)
      return
    }

    if (file.size > maxFileSizeBytes) {
      const limitMb = (maxFileSizeBytes / (1024 * 1024)).toFixed(0)
      const fileMb = (file.size / (1024 * 1024)).toFixed(1)
      setDragError(`File is too large (${fileMb} MB). Maximum allowed size is ${limitMb} MB.`)
      setDroppedFile(null)
      return
    }

    try {
      const validation = await validateFileSignature(file)
      if (token !== validationTokenRef.current) {
        return
      }
      if (!validation.valid) {
        setDragError(validation.error ?? FILE_SIGNATURE_MISMATCH_ERROR)
        setDroppedFile(null)
        return
      }
    } catch {
      if (token !== validationTokenRef.current) {
        return
      }
      setDragError(FILE_SIGNATURE_MISMATCH_ERROR)
      setDroppedFile(null)
      return
    }

    setDragError(undefined)
    setDroppedFile(file)
    onFileSelect?.(file)
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    // Only clear if leaving the drop zone entirely (not entering a child)
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const files = event.dataTransfer.files
    if (files.length === 0) return

    if (files.length > 1) {
      validationTokenRef.current += 1
      setDroppedFile(null)
      setDragError('Only one file can be attached at a time.')
      return
    }

    void processFile(files[0])
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    void processFile(files[0])
    // Reset input so the same file can be selected again
    event.target.value = ''
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = () => {
    validationTokenRef.current += 1
    setDroppedFile(null)
    setDragError(undefined)
  }

  const dropZoneStyles: CSSProperties = {
    border: `2px dashed ${isDragOver ? 'var(--accent)' : dragError ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 'var(--radius)',
    padding: 'var(--spacing-4)',
    textAlign: 'center' as const,
    background: isDragOver ? 'var(--surface-raised)' : 'var(--surface)',
    transition: 'border-color 0.15s ease, background 0.15s ease',
    cursor: 'pointer',
  }

  return (
    <div
      data-status={status}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2)',
      }}
    >
      <Field
        id={fieldId}
        label={label}
        type="url"
        inputMode="url"
        value={rawValue}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder="https://github.com/org/repo/pull/42"
        required={required}
        error={error}
        hint={status === 'empty' ? 'Attach a public http or https link to milestone evidence.' : undefined}
      />
      {status === 'valid' && normalizedUrl && (
        <Text
          role="caption"
          as="span"
          style={{
            color: 'var(--success)',
          }}
        >
          Evidence link accepted: {normalizedUrl}
        </Text>
      )}

      {onFileSelect && (
        <>
          {/* Drag-and-drop zone */}
          <div
            data-testid="evidence-drop-zone"
            aria-label="Drop evidence file here or click to browse"
            role="button"
            tabIndex={0}
            aria-dropeffect="copy"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleBrowseClick()
              }
            }}
            style={dropZoneStyles}
          >
            {isDragOver ? (
              <Text role="caption" as="span" style={{ color: 'var(--accent)' }}>
                Drop file to attach
              </Text>
            ) : droppedFile ? (
              <Text role="caption" as="span" style={{ color: 'var(--success)' }}>
                File attached: {droppedFile.name}
              </Text>
            ) : (
              <Text role="caption" as="span" style={{ color: 'var(--muted)' }}>
                Drag and drop a file here, or{' '}
                <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse</span>
                <br />
                Accepted types: {ACCEPTED_FILE_EXTENSIONS.join(', ')}
                <br />
                Max size: {(maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB
              </Text>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
            onChange={handleFileInputChange}
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
          />

          {dragError && (
            <Text
              role="caption"
              as="span"
              style={{ color: 'var(--danger)' }}
              data-testid="drag-error"
            >
              {dragError}
            </Text>
          )}

          {droppedFile && (
            <button
              type="button"
              onClick={handleRemoveFile}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Remove file
            </button>
          )}
        </>
      )}

      {onSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!normalizedUrl}
          style={{
            alignSelf: 'flex-start',
            background: normalizedUrl ? 'var(--accent)' : 'var(--surface-raised)',
            border: 'var(--border-width-1) solid var(--border)',
            borderRadius: 'var(--radius)',
            color: normalizedUrl ? 'var(--bg)' : 'var(--muted)',
            cursor: normalizedUrl ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            minHeight: 'var(--touch-target)',
            padding: 'var(--spacing-2) var(--spacing-4)',
          }}
        >
          Attach Evidence
        </button>
      )}
    </div>
  )
}
