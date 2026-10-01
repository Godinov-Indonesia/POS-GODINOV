'use client'

import * as React from 'react'

import { ImageUploader } from '@/components/ui/image-uploader'

export interface ProductImageUploaderProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  className?: string
}

/**
 * [TERAPAN SPESIFIK PRODUK]
 * Komponen pembungkus khusus modul produk yang mengunggah ke Cloudinary
 * folder dinamis `posgodinov/{business_id}/products` dengan kompresi WebP otomatis.
 */
export function ProductImageUploader({
  value,
  onChange,
  disabled = false,
  className,
}: ProductImageUploaderProps) {
  return (
    <ImageUploader
      value={value}
      onChange={onChange}
      purpose="products"
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
