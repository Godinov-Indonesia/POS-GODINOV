/**
 * [CORE API] Endpoint lisensi upload Cloudinary Signed Upload & helper upload gambar multi-tenant.
 */

import { adminRequest } from '@/lib/api/admin-client'
import { cacheImage } from '@/lib/cache/image-cache'
import { compressImageToWebp, type ImageCompressOptions } from '@/lib/utils/image-compressor'

export type UploadPurpose = 'products' | 'profiles' | 'general'

export interface UploadSignatureResponse {
  signature: string
  timestamp: number
  api_key: string
  cloud_name: string
  folder: string
}

export interface UploadSignatureParams {
  purpose?: UploadPurpose
  outlet_id?: string
}

export interface UploadImageOptions extends ImageCompressOptions {
  purpose?: UploadPurpose
  outletId?: string
  /** Otomatis kompresi ke WebP dan resize proporsional sebelum upload (default: true). */
  compress?: boolean
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
 * Menggunakan folder dinamis: env/business_id/{outlet_id}/products atau env/business_id/{purpose}
 */
export async function getUploadSignature(
  params: UploadSignatureParams | UploadPurpose = 'products',
): Promise<UploadSignatureResponse> {
  const payload =
    typeof params === 'string'
      ? { purpose: params }
      : { purpose: params.purpose ?? 'products', outlet_id: params.outlet_id }

  return await adminRequest<UploadSignatureResponse>('/v1/business/uploads/signature', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * [CORE FUNCTION] Mengunggah file gambar ke Cloudinary:
 * 1. Otomatis mengompresi ke WebP (kualitas 85%, max 1600px) untuk kecepatan & efisiensi kuota.
 * 2. Mengambil signature dinamis dari backend berdasarkan purpose & outletId.
 * 3. Mengunggah langsung ke Cloudinary API via FormData.
 * 4. Menyimpan otomatis ke Cache Storage browser lokal untuk zero-latency rendering.
 */
export async function uploadImage(file: File, options: UploadImageOptions = {}): Promise<string> {
  const { purpose = 'products', outletId, compress = true, ...compressOptions } = options

  // 1. Kompresi gambar ke WebP di sisi klien (menghemat 70-85% bandwidth upload)
  let fileToUpload = file
  if (compress) {
    try {
      fileToUpload = await compressImageToWebp(file, compressOptions)
    } catch (err) {
      console.warn('[Upload] Gagal kompresi WebP, menggunakan file asli:', err)
    }
  }

  // 2. Ambil signature dinamis multi-tenant dari backend
  const sig = await getUploadSignature({ purpose, outlet_id: outletId })

  // 3. Susun payload multipart/form-data
  const formData = new FormData()
  formData.append('file', fileToUpload)
  formData.append('api_key', sig.api_key)
  formData.append('timestamp', String(sig.timestamp))
  formData.append('signature', sig.signature)
  if (sig.folder) {
    formData.append('folder', sig.folder)
  }

  // 4. Upload langsung ke Cloudinary API
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

  // 5. Inkremental Pre-cache: Simpan langsung ke Cache Storage browser
  cacheImage(secureUrl).catch((err) => {
    console.warn('[Upload] Gagal pre-cache gambar baru:', err)
  })

  return secureUrl
}

/** Alias untuk kompatibilitas ke belakang */
export const uploadImageToCloudinary = (file: File) => uploadImage(file, { purpose: 'products' })
