# Evidence Upload

`EvidenceUpload` lets a vault owner attach evidence for milestone validation. It
supports two input modes: a URL text field and a drag-and-drop file zone. Both
build on the shared `Field` and `Text` components so label, hint, error,
`aria-describedby`, and `aria-invalid` behavior stays consistent with the rest
of the forms.

## URL Input

### Accepted URLs

- `https://...`
- `http://...`

The URL is trimmed before being emitted. Missing schemes, `javascript:`,
`data:`, and other non-http(s) schemes are rejected so verifier screens do not
render unsafe evidence links later.

### URL States

| State | Behavior |
| --- | --- |
| Empty | Shows neutral guidance using `--muted`. |
| Invalid | Shows a `Field` error using `--danger` after blur or submit. |
| Valid | Shows accepted evidence feedback using `--success`. |

Use the `onChange` callback to receive the validated URL, or `undefined` when
the current input is empty or invalid. Use `onSubmit` when the parent flow
needs an explicit attach action.

## Drag-and-Drop File Zone

Beneath the URL field, the component renders a drop zone that also accepts files
selected through the hidden file browser (activated by clicking or pressing
`Enter`/`Space` on the zone).

### Accessibility

- `role="button"` and `tabIndex={0}` make the zone keyboard-reachable.
- `aria-label="Drop evidence file here or click to browse"` provides a
  descriptive label for screen readers.
- `aria-dropeffect="copy"` signals the drop semantics to assistive technology.

### Accepted File Types

By default the zone accepts:

`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf`, `.txt`, `.mp4`, `.webm`

Override the list at the component level with the `acceptedFileTypes` prop
(MIME type strings). Dropping or selecting a file whose MIME type is not in the
accepted list shows an error message and calls neither `onFileSelect` nor
`onChange`.

### File Size Limit

Files are validated against `maxFileSizeBytes` (default **50 MB**). Dropping or
selecting a file that exceeds this limit rejects the file with an error message
that states both the file's actual size and the configured limit. No callback is
fired for rejected files.

Provide a custom limit via the prop:

```tsx
<EvidenceUpload
  onFileSelect={handleFile}
  maxFileSizeBytes={10 * 1024 * 1024} {/* 10 MB */}
/>
```

### Drop Zone States

| State | Behavior |
| --- | --- |
| Idle | Shows accepted types, size limit, and a browse link. |
| Drag-over | Border switches to `--accent`; prompt changes to "Drop file to attach". |
| File attached | Shows filename in `--success`; a "Remove file" button appears. |
| Error (type or size) | Shows an error message in `--danger` via `data-testid="drag-error"`. |

Only one file can be attached at a time. Dropping multiple files simultaneously
shows an error and accepts none of them.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | auto | DOM id for the URL input; auto-generated if omitted. |
| `label` | `string` | `'Evidence URL'` | Visible label text. |
| `value` | `string` | `''` | Controlled value for the URL input. |
| `required` | `boolean` | `false` | Marks the URL field as required. |
| `onChange` | `(url: string \| undefined) => void` | — | Fires when the URL input changes; receives the normalized URL or `undefined`. |
| `onSubmit` | `(url: string) => void` | — | When provided, renders an "Attach Evidence" button and fires on click with the validated URL. |
| `onFileSelect` | `(file: File) => void` | — | Fires when a valid, size-within-limit file is dropped or browsed. |
| `acceptedFileTypes` | `string[]` | MIME list above | Override the accepted MIME types for the drop zone. |
| `maxFileSizeBytes` | `number` | `52428800` (50 MB) | Maximum file size in bytes. Files exceeding this are rejected with an error. |
