'use client'

import { Link as LinkIcon, Loader2, UploadCloud, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { CachedImage } from '@/components/ui/cached-image'
import { Input } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { uploadImage, type UploadPurpose } from '@/lib/api/endpoints/uploads'
import { cn } from '@/lib/utils/cn'

export interface ImageUploaderProps {
  value?: string
  onChange: (url: string) => void
  /** File gambar yang dipilih (untuk mode Deferred Upload) */
  file?: File | null
  /** Callback saat file lokal dipilih/diubah tanpa langsung mengunggah ke cloud */
  onFileChange?: (file: File | null) => void
  /** Kategori target Cloudinary (e.g. 'products', 'profiles', 'general') */
  purpose?: UploadPurpose
  /** ID outlet untuk struktur folder dinamis: env/business_id/outlet_id/products */
  outletId?: string
  /** Bentuk visual preview: 'rounded' (default), 'circle' (untuk avatar/profil), atau 'square' */
  shape?: 'rounded' | 'circle' | 'square'
  /** Ukuran kotak preview */
  previewSize?: 'sm' | 'md' | 'lg'
  dropzoneLabel?: string
  dropzoneHint?: string
  maxSizeMB?: number
  disabled?: boolean
  allowManualUrl?: boolean
  maxWidth?: number
  maxHeight?: number
  quality?: number
  className?: string
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ImageUploader({
  value = '',
  onChange,
  file,
  onFileChange,
  purpose = 'general',
  outletId,
  shape = 'rounded',
  previewSize = 'md',
  dropzoneLabel = 'Klik untuk unggah atau seret file gambar ke sini',
  dropzoneHint,
  maxSizeMB = 5,
  disabled = false,
  allowManualUrl = true,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85,
  className,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [showManualInput, setShowManualInput] = React.useState(false)
  const [previewLocalUrl, setPreviewLocalUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Object URL preview untuk mode deferred (file prop)
  const filePreviewUrl = React.useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  React.useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl)
      }
    }
  }, [filePreviewUrl])

  // Object URL preview untuk mode immediate upload (previewLocalUrl state)
  React.useEffect(() => {
    return () => {
      if (previewLocalUrl) {
        URL.revokeObjectURL(previewLocalUrl)
      }
    }
  }, [previewLocalUrl])

  const handleFileProcess = async (selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      toast.error('Format file tidak didukung. Harap gunakan JPG, PNG, atau WebP.')
      return
    }

    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file melebihi batas maksimal ${maxSizeMB}MB.`)
      return
    }

    // Mode Deferred Upload: Simpan file ke state form dan buat preview lokal tanpa upload ke Cloudinary
    if (onFileChange) {
      onFileChange(selectedFile)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Mode Immediate Upload: Langsung upload ke Cloudinary
    const localUrl = URL.createObjectURL(selectedFile)
    if (previewLocalUrl) URL.revokeObjectURL(previewLocalUrl)
    setPreviewLocalUrl(localUrl)

    setIsUploading(true)
    try {
      const secureUrl = await uploadImage(selectedFile, {
        purpose,
        outletId,
        compress: true,
        maxWidth,
        maxHeight,
        quality,
      })
      onChange(secureUrl)
      toast.success('Gambar berhasil diunggah & dioptimasi ke WebP!')
    } catch (err) {
      if (previewLocalUrl) URL.revokeObjectURL(previewLocalUrl)
      setPreviewLocalUrl(null)
      toastApiError(err, 'Gagal mengunggah gambar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileProcess(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileProcess(selectedFile)
    }
  }

  const handleRemove = () => {
    if (previewLocalUrl) {
      URL.revokeObjectURL(previewLocalUrl)
      setPreviewLocalUrl(null)
    }
    onFileChange?.(null)
    onChange('')
  }

  const activePreviewUrl = filePreviewUrl || previewLocalUrl
  const activeImage = activePreviewUrl || value

  const sizeClasses = {
    sm: 'size-16',
    md: 'size-24',
    lg: 'size-32',
  }[previewSize]

  const shapeClasses = {
    rounded: 'rounded-md',
    circle: 'rounded-full',
    square: 'rounded-none',
  }[shape]

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {activeImage ? (
        // Preview Box ketika gambar telah tersedia (baik file lokal maupun URL)
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-lg border border-border p-3 bg-bg-surface">
          <div
            className={cn(
              'relative shrink-0 overflow-hidden border border-border bg-bg-subtle',
              sizeClasses,
              shapeClasses,
            )}
          >
            {activePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePreviewUrl}
                alt="Preview gambar"
                className="size-full object-cover"
              />
            ) : (
              <CachedImage
                src={value}
                alt="Gambar tersimpan"
                className="size-full object-cover"
              />
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1 text-center sm:text-left min-w-0">
            <p className="text-sm font-medium text-fg truncate">
              {file
                ? 'File gambar siap disimpan'
                : isUploading
                  ? 'Sedang mengunggah ke Cloudinary...'
                  : 'Gambar Produk Tersimpan'}
            </p>
            <p className="text-xs text-fg-muted truncate">
              {file ? (
                <span className="text-primary font-medium">
                  {file.name} (akan diunggah saat simpan)
                </span>
              ) : value ? (
                value
              ) : (
                'Memproses upload…'
              )}
            </p>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Ganti Gambar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={disabled || isUploading}
                onClick={handleRemove}
              >
                <X className="size-3.5 mr-1" />
                Hapus
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Dropzone Area ketika belum ada gambar
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
            shape === 'circle' ? 'rounded-full aspect-square max-w-[200px] mx-auto' : 'rounded-lg',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border-muted hover:border-primary/60 hover:bg-bg-subtle/50',
            (disabled || isUploading) && 'pointer-events-none opacity-60',
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-fg-muted">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Sedang memproses & mengompresi gambar…</p>
            </div>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <UploadCloud className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">{dropzoneLabel}</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {dropzoneHint ?? `Format WebP, JPG, atau PNG (maksimal ${maxSizeMB}MB)`}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Input Toggle */}
      {allowManualUrl && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowManualInput((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg transition-colors w-fit"
          >
            <LinkIcon className="size-3" />
            <span>{showManualInput ? 'Sembunyikan URL manual' : 'Atau tempel URL gambar manual'}</span>
          </button>

          {showManualInput && (
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://example.com/image.webp"
                value={value}
                onChange={(e) => {
                  onFileChange?.(null)
                  onChange(e.target.value)
                }}
                disabled={disabled || isUploading}
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
