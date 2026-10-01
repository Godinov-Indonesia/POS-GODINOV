'use client'

import { Image as ImageIcon } from 'lucide-react'
import * as React from 'react'

import { getCachedImageBlobUrl, cacheImage } from '@/lib/cache/image-cache'
import { cn } from '@/lib/utils/cn'

interface CachedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  alt: string
  fallbackIconClassName?: string
}

/**
 * Komponen gambar yang mengutamakan Cache Storage browser lokal (0ms render time),
 * dan secara otomatis mengunduh ke cache jika belum ada.
 */
export function CachedImage(props: CachedImageProps) {
  // Keying dengan src memastikan state internal reset secara bersih saat src berubah
  return <CachedImageInner key={props.src ?? 'empty'} {...props} />
}

function CachedImageInner({
  src,
  alt,
  className,
  fallbackIconClassName,
  ...props
}: CachedImageProps) {
  const [resolvedSrc, setResolvedSrc] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)
  const blobUrlRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    if (!src) return

    // Cek apakah gambar sudah ada di Cache Storage browser
    getCachedImageBlobUrl(src).then((blobUrl) => {
      if (!isMounted) return

      if (blobUrl) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = blobUrl
        setResolvedSrc(blobUrl)
      } else {
        // Belum ada di cache -> pakai URL asli & download ke cache di background
        setResolvedSrc(src)
        cacheImage(src).catch(() => {})
      }
    })

    return () => {
      isMounted = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [src])

  if (!src || hasError || !resolvedSrc) {
    return (
      <div
        className={cn(
          'flex size-full items-center justify-center rounded bg-bg-subtle text-fg-subtle',
          className,
        )}
      >
        <ImageIcon className={cn('size-5', fallbackIconClassName)} aria-hidden="true" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  )
}
