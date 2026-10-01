'use client'

import * as React from 'react'

import { ImageUploader } from '@/components/ui/image-uploader'

export interface ProductImageUploaderProps {
  value: string
  onChange: (url: string) => void
  /** File gambar yang dipilih pengguna (mode Deferred Upload) */
  file?: File | null
  /** Callback saat file dipilih secara lokal */
  onFileChange?: (file: File | null) => void
  outletId?: string
  disabled?: boolean
  className?: string
}

/**
 * [TERAPAN SPESIFIK PRODUK]
 * Komponen pembungkus khusus modul produk. Mendukung mode Deferred Upload
 * (file baru diunggah saat tombol Simpan ditekan) untuk mencegah orphaned asset di Cloudinary.
 */
export function ProductImageUploader({
  value,
  onChange,
  file,
  onFileChange,
  outletId,
  disabled = false,
  className,
}: ProductImageUploaderProps) {
  return (
    <ImageUploader
      value={value}
      onChange={onChange}
      file={file}
      onFileChange={onFileChange}
      purpose="products"
      outletId={outletId}
      shape="rounded"
      previewSize="md"
      dropzoneLabel="Klik untuk unggah gambar produk atau seret ke sini"
      dropzoneHint="Format JPG, PNG, atau WebP (otomatis dioptimasi ke WebP, maks 5MB)"
      maxSizeMB={5}
      maxWidth={1600}
      maxHeight={1600}
      quality={0.85}
      disabled={disabled}
      className={className}
    />
  )
}
