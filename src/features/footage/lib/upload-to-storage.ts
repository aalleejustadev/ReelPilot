/**
 * Browser side of a signed upload: posts the form fields, then the file, to
 * storage with progress. XHR rather than fetch, which can't report upload
 * progress. Resolves when storage accepts the file.
 */
export function uploadToStorage(
  upload: { url: string; fields: Record<string, string> },
  file: Blob,
  options: { onProgress: (fraction: number) => void; signal?: AbortSignal }
) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData()
    for (const [name, value] of Object.entries(upload.fields)) {
      form.append(name, value)
    }
    form.append("file", file) // must come last in an S3 POST

    const xhr = new XMLHttpRequest()
    xhr.open("POST", upload.url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(event.loaded / event.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage refused the upload (${xhr.status})`))
    xhr.onerror = () => reject(new Error("The upload was interrupted"))
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"))
    options.signal?.addEventListener("abort", () => xhr.abort())
    xhr.send(form)
  })
}
