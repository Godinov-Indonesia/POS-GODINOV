/**
 * Endpoint lisensi upload Cloudinary Signed Upload & helper upload langsung ke Cloudinary.
 */

import { adminRequest } from '@/lib/api/admin-client'
import { cacheImage } from '@/lib/cache/image-cache'

export interface UploadSignatureResponse {
  signature: string
  timestamp: number
  api_key: string
  cloud_name: string
  folder: string
}

interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  format: string
  width: number
  height: number
  bytes: number
  error?: {
    message: string
  }
}

/**
 * Meminta token signature otentikasi upload dari backend Go.
 */
export async function getUploadSignature(): Promise<UploadSignatureResponse> {
  return await adminRequest<UploadSignatureResponse>('/v1/business/uploads/signature', {
    method: 'POST',
  })
}

/**
 * Mengunggah file binary langsung ke Cloudinary menggunakan lisensi signature,
 * lalu otomatis memasukkan URL hasil upload ke browser Cache Storage.
 */
export async function uploadImageToCloudinary(file: File): Promise<string> {
  // 1. Ambil signature dari backend
  const sig = await getUploadSignature()

  // 2. Susun payload multipart/form-data
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.api_key)
  formData.append('timestamp', String(sig.timestamp))
  formData.append('signature', sig.signature)
  if (sig.folder) {
    formData.append('folder', sig.folder)
  }

  // 3. Upload langsung ke Cloudinary API
  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`
  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  })

  const data = (await res.json()) as CloudinaryUploadResult

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Gagal mengunggah gambar ke Cloudinary')
  }

  const secureUrl = data.secure_url

  // 4. Inkremental Pre-cache: Simpan langsung ke Cache Storage browser
  // sehingga gambar langsung siap pakai tanpa perlu download ulang!
  cacheImage(secureUrl).catch((err) => {
    console.warn('[Upload] Gagal pre-cache gambar baru:', err)
  })

  return secureUrl
}
