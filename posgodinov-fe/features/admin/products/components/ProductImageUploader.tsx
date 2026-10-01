'use client'

import { Link as LinkIcon, Loader2, UploadCloud, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast, toastApiError } from '@/components/ui/toaster'
import { CachedImage } from '@/features/admin/products/components/CachedImage'
import { uploadImageToCloudinary } from '@/lib/api/endpoints/uploads'
import { cn } from '@/lib/utils/cn'

interface ProductImageUploaderProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
}

const MAX_FILE_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ProductImageUploader({
  value,
  onChange,
  disabled = false,
}: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [showManualInput, setShowManualInput] = React.useState(false)
  const [previewLocalUrl, setPreviewLocalUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Bersihkan local object URL saat unmount
  React.useEffect(() => {
    return () => {
      if (previewLocalUrl) {
        URL.revokeObjectURL(previewLocalUrl)
      }
    }
  }, [previewLocalUrl])

  const handleFileProcess = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format file tidak didukung. Harap gunakan JPG, PNG, atau WebP.')
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    // Tampilkan preview instan dari local file
    const localUrl = URL.createObjectURL(file)
    if (previewLocalUrl) URL.revokeObjectURL(previewLocalUrl)
    setPreviewLocalUrl(localUrl)

    setIsUploading(true)
    try {
      const secureUrl = await uploadImageToCloudinary(file)
      onChange(secureUrl)
      toast.success('Gambar produk berhasil diunggah & disimpan di cache!')
    } catch (err) {
      // Jika upload gagal, batalkan preview lokal
      if (previewLocalUrl) URL.revokeObjectURL(previewLocalUrl)
      setPreviewLocalUrl(null)
      toastApiError(err, 'Gagal mengunggah gambar produk')
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

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileProcess(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileProcess(file)
    }
  }

  const handleRemove = () => {
    if (previewLocalUrl) {
      URL.revokeObjectURL(previewLocalUrl)
      setPreviewLocalUrl(null)
    }
    onChange('')
  }

  const activeImage = previewLocalUrl || value

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {activeImage ? (
        // Preview Box saat gambar sudah tersedia (baik lokal preview maupun Cloudinary)
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-lg border border-border p-3 bg-bg-surface">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-border bg-bg-subtle">
            {previewLocalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewLocalUrl}
                alt="Preview produk"
                className="size-full object-cover"
              />
            ) : (
              <CachedImage
                src={value}
                alt="Gambar produk"
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
              {isUploading ? 'Sedang mengunggah ke Cloudinary...' : 'Gambar Produk Tersimpan'}
            </p>
            <p className="text-xs text-fg-muted truncate">
              {value ? value : 'Memproses upload...'}
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
        // Dropzone Area saat belum ada gambar
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border-muted hover:border-primary/60 hover:bg-bg-subtle/50',
            (disabled || isUploading) && 'pointer-events-none opacity-60',
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-fg-muted">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Sedang memproses & mengunggah gambar…</p>
            </div>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <UploadCloud className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">
                  Klik untuk unggah atau seret file gambar ke sini
                </p>
                <p className="text-xs text-fg-muted mt-0.5">
                  Format PNG, JPG, atau WebP (maksimal {MAX_FILE_SIZE_MB}MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Input Toggle */}
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
              placeholder="https://example.com/image.jpg"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled || isUploading}
              className="text-xs"
            />
          </div>
        )}
      </div>
    </div>
  )
}
