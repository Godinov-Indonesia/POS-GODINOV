'use client'

/**
 * Penyimpanan lokal sesi opname ([11 §M16.2]).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DRAF HIDUP DI PERANGKAT LEBIH DULU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Opname gudang berlangsung di ruang pendingin, gudang belakang, dan lantai
 * bawah — tempat sinyal seluler paling buruk di seluruh outlet. Petugas
 * menghitung ratusan bahan selama berjam-jam; menuntut jaringan untuk setiap
 * angka berarti pekerjaan itu tidak dapat diselesaikan sama sekali.
 *
 * Karena itu setiap hitungan ditulis ke Dexie SEKARANG dan menyusul ke server
 * ketika ada sinyal — pola yang sama dengan transaksi di jalur kasir, dengan
 * satu perbedaan penting: draf opname **tidak pernah** dikirim otomatis.
 * Pengiriman terjadi saat petugas menekan kunci, karena penguncian adalah
 * keputusan yang harus ia ambil secara sadar.
 */

import { lineKey, opnameDb } from '@/lib/db/opname-dexie'
import type {
  OpnameInputType,
  OpnameLine,
  OpnameMaterial,
  OpnameResultLine,
  OpnameSession,
} from '@/lib/db/opname-models'
import { nowIso } from '@/lib/time'
import { newUuid } from '@/lib/uuid'

/* ── Sesi ─────────────────────────────────────────────────────────────────── */

/** Sesi yang sedang dihitung, bila ada. */
export const getActiveSession = (): Promise<OpnameSession | undefined> =>
  opnameDb.sessions.where('status').equals('DRAFT').first()

export const getSession = (id: string): Promise<OpnameSession | undefined> =>
  opnameDb.sessions.get(id)

export const listSessions = (): Promise<OpnameSession[]> =>
  opnameDb.sessions.orderBy('client_created_at').reverse().toArray()

/**
 * Membuka sesi baru.
 *
 * UUID dibuat KLIEN dan **tidak pernah** diregenerasi (aturan R2): sesi yang
 * dikirim ulang karena jaringan putus tidak boleh melahirkan sesi kedua di
 * server.
 */
export async function createSession(params: {
  countedBy?: string
  countedByName?: string
  notes?: string
} = {}): Promise<OpnameSession> {
  // Identitas penghitung dibaca dari sesi aktif bila pemanggil tidak
  // menyediakannya.
  //
  // Layar login petugas gudang adalah pekerjaan M16.5 (peran & akses); sampai
  // saat itu, nilainya bisa kosong. Yang tersimpan di sini hanya untuk
  // DITAMPILKAN — `counted_by` yang mengikat ditetapkan SERVER dari header
  // `X-Staff-Id`, bukan dari kiriman body ini.
  const active = (await opnameDb.meta.get('session.active'))?.value as
    | { staffId?: string; staffName?: string }
    | undefined

  const session: OpnameSession = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : newUuid(),
    status: 'DRAFT',
    scope: 'FULL',
    notes: params.notes ?? '',
    counted_by: params.countedBy ?? active?.staffId ?? '',
    counted_by_name: params.countedByName ?? active?.staffName ?? '',
    client_created_at: nowIso(),
    locked_at: null,
    _synced: 0,
    _syncError: null,
  }

  await opnameDb.sessions.add(session)
  return session
}

/**
 * Menandai sesi terkunci **dari respons server**, bukan dari keputusan klien.
 *
 * `locked_at` diambil apa adanya dari server: jam perangkat gudang tidak dapat
 * dipercaya sebagai penentu momen snapshot, dan seluruh selisih dihitung
 * relatif terhadap momen itu.
 */
export const markSessionLocked = (id: string, lockedAt: string): Promise<number> =>
  opnameDb.sessions.update(id, { status: 'LOCKED', locked_at: lockedAt, _synced: 1 })

/* ── Baris hitungan ───────────────────────────────────────────────────────── */

export const listLines = (sessionId: string): Promise<OpnameLine[]> =>
  opnameDb.lines.where('session_id').equals(sessionId).toArray()

/**
 * Menyimpan satu hitungan.
 *
 * `put` dengan kunci majemuk `${session_id}:${raw_material_id}`: petugas
 * menghitung ulang bahan yang sama berkali-kali selama sesi berjalan, dan
 * hitungan terakhirlah yang berlaku. Menumpuk baris akan membuat penguncian
 * mengirim dua angka yang saling bertentangan untuk satu bahan.
 */
export async function saveLine(params: {
  sessionId: string
  rawMaterialId: string
  counted: number
  inputType: OpnameInputType
  notes?: string
}): Promise<void> {
  const line: OpnameLine = {
    key: lineKey(params.sessionId, params.rawMaterialId),
    session_id: params.sessionId,
    raw_material_id: params.rawMaterialId,
    counted: params.counted,
    input_type: params.inputType,
    notes: params.notes ?? '',
    counted_at: nowIso(),
  }
  await opnameDb.lines.put(line)
}

/**
 * Membatalkan hitungan satu bahan — mengembalikannya ke keadaan "belum
 * dihitung".
 *
 * Bukan menyimpan nol. Nol adalah HITUNGAN yang sah dan bermakna: bahan itu
 * habis. Membedakan "nol" dari "belum dihitung" adalah satu-satunya cara
 * petugas tahu apa yang masih tersisa dikerjakan di gudang seluas itu.
 */
export const clearLine = (sessionId: string, rawMaterialId: string): Promise<void> =>
  opnameDb.lines.delete(lineKey(sessionId, rawMaterialId))

/* ── Hasil ────────────────────────────────────────────────────────────────── */

export const listResults = (sessionId: string): Promise<OpnameResultLine[]> =>
  opnameDb.results.where('session_id').equals(sessionId).toArray()

/**
 * Menyimpan hasil penguncian dari respons server.
 *
 * ⚠️ Angka-angka ini **tidak pernah dihitung klien**. Menghitungnya sendiri
 * berarti perangkat gudang harus memegang stok sistem — dan butir 3 runtuh
 * sebelum satu pixel pun digambar.
 */
export async function saveResults(sessionId: string, lines: OpnameResultLine[]): Promise<void> {
  await opnameDb.results.bulkPut(lines)
}

/* ── Katalog bahan baku ───────────────────────────────────────────────────── */

export const listMaterials = (): Promise<OpnameMaterial[]> =>
  opnameDb.materials.orderBy('name').toArray()

export const countMaterials = (): Promise<number> => opnameDb.materials.count()
