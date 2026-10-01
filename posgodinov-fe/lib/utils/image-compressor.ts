/**
 * Helper utilitas kompresi gambar berbasis browser HTML5 Canvas.
 *
 * Mengonversi gambar ke format WebP dan melakukan downscale proporsional:
 * - Format: image/webp
 * - Kualitas: 0.85 (perceptually lossless, mata manusia tidak melihat degradasi, namun ukuran turun 70-85%)
 * - Batas Dimensi: default 1600px (mencegah upload foto mentah 4000x3000px dari kamera ponsel)
 */

export interface ImageCompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.85

/**
 * Mengompresi file gambar menjadi format WebP dengan resolusi optimal.
 * Jika browser tidak mendukung Canvas atau terjadi kendala, otomatis fallback ke file asli.
 */
export async function compressImageToWebp(
  file: File,
  options: ImageCompressOptions = {},
): Promise<File> {
  const {
    maxWidth = DEFAULT_MAX_DIMENSION,
    maxHeight = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
  } = options

  // Jika file adalah SVG atau bukan gambar, kembalikan apa adanya
  if (file.type === 'image/svg+xml' || !file.type.startsWith('image/')) {
    return file
  }

  // Jika berjalan di server (SSR), kembalikan file asli
  if (typeof window === 'undefined') {
    return file
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Hitung skala proporsional agar tidak melebihi maxWidth / maxHeight
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      // Aktifkan image smoothing untuk hasil downscale yang tajam
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }

          // Buat nama file baru dengan ekstensi .webp
          const originalName = file.name
          const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
          const newFileName = `${baseName}.webp`

          const compressedFile = new File([blob], newFileName, {
            type: 'image/webp',
            lastModified: Date.now(),
          })

          resolve(compressedFile)
        },
        'image/webp',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Fallback aman ke file asli jika gambar gagal dimuat
      resolve(file)
    }

    img.src = objectUrl
  })
}
