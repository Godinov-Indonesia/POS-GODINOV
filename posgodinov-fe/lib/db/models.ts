/**
 * Model IndexedDB kasir — docs/05 §1.5.1.
 *
 * Dexie **bukan** cache. Ia adalah basis data operasional POS (ADR-03): layar
 * kasir membaca dari `useLiveQuery`, tidak pernah dari TanStack Query, dan
 * jaringan tidak pernah menjadi prasyarat render.
 *
 * ATURAN PEMODELAN YANG MENGIKAT SELURUH SKEMA
 * --------------------------------------------
 * | Aturan                                        | Alasan                                                     |
 * |-----------------------------------------------|------------------------------------------------------------|
 * | `_synced` bertipe `-1 | 0 | 1`, BUKAN `boolean` | IndexedDB tidak dapat mengindeks boolean                  |
 * | Seluruh field lokal berprefiks `_`            | `stripLocalFields()` membuangnya dengan satu aturan         |
 * | Uang disimpan sebagai **integer sen** (ADR-05)| Konversi ke Rupiah hanya di batas API                       |
 * | `items` transaksi disimpan **bersarang**      | Payload sync memang bersarang ([03 §2.3])                   |
 * | Baris tidak pernah dihapus setelah tersinkron | Riwayat "Hari Ini" dibaca dari lokal ([04 §A.5])            |
 * | UUID dibuat sekali saat entitas lahir         | Dasar idempotensi; regenerasi = duplikasi data keuangan     |
 */

import type { PaymentMethod, PaymentSummaryMethod } from '@/lib/constants/payment'
import type {
  IsoDateTime,
  ReturnState,
  ReturnKind,
  RefundMethod,
  ShiftStatus,
  TransactionStatus,
  VoidScope,
} from '@/lib/types/api'

/** Metadata lokal yang WAJIB dibuang sebelum dikirim ke backend. */
export type LocalMeta = {
  /**
   * `1` tersinkron · `0` mengantre · `-1` **karantina** (v2, [11 §4.3]).
   *
   * `-1` dipakai untuk baris yang ditolak server dengan `retryable: false`.
   * Tanpa nilai ketiga ini, satu baris yang cacat permanen — mis. transaksi
   * kartu tanpa `trace_number` yang lolos dari perangkat lama — akan terus
   * dikirim ulang selamanya dan seluruh antrean di belakangnya ikut membusuk.
   *
   * Baris berkarantina KELUAR dari antrean (`where('_synced').equals(0)` tidak
   * menjaringnya) dan muncul di P-13 sebagai "Butuh tindakan".
   */
  _synced: -1 | 0 | 1
  /** Pesan kegagalan terakhir, untuk layar antrean sync (P-13). */
  _syncError?: string | null
  _syncAttempts: number
  _lastSyncAttemptAt?: string | null
}

/* ── Master data (sync-down; sumber: GET /v1/pos/sync/master-data) ────────── */

export type LocalStaff = {
  /** UUID dari server. */
  id: string
  staff_identifier: string
  name: string
  /** ⚠️ bcrypt — dibandingkan secara lokal di Web Worker ([05 §1.4.5]). */
  pin_hash: string
  /** v2 — mis. `OWNER`, `SUPERVISOR`, `CASHIER` ([11 §4.4]). */
  role?: string
  /** v2 — izin granular di atas peran, mis. `SHIFT_FORCE_CLOSE`. */
  permissions?: string[] | null
  _syncedAt: string
}

export type LocalCategory = {
  id: string
  name: string
  description: string | null
  _syncedAt: string
}

export type LocalProduct = {
  id: string
  name: string
  /** INTEGER SEN — server mengirim Rupiah desimal, dikonversi di `master-sync`. */
  price: number
  image_url: string | null
  category_id: string | null
  _syncedAt: string
  // CATATAN: TIDAK ADA `stock` dan TIDAK ADA `recipes`.
  // Master data POS memang tidak memuatnya ([03 §2.2]). UI kasir dilarang
  // menampilkan ketersediaan stok.
}

/* ── Data transaksional (sync-up; UUID dibuat klien) ──────────────────────── */

export type LocalShift = LocalMeta & {
  /** `crypto.randomUUID()` — dibuat sekali, tidak pernah diregenerasi. */
  id: string
  staff_id: string
  /** sen */
  opening_balance: number
  /** sen */
  closing_balance: number
  /** sen — dihitung klien ([04 §A.3]); server tidak menghitung ulang. */
  expected_balance: number
  /** sen — dihitung klien. */
  discrepancy: number
  status: ShiftStatus
  /** ISO-8601 dengan zona waktu. */
  client_opened_at: IsoDateTime
  client_closed_at: IsoDateTime | null

  /* ── v2 — Blind Closing & penguncian sesi ([11 §3.2] migrasi 000021) ────── */

  /**
   * sen — uang fisik hasil hitung laci. **Satu-satunya** angka kas yang berasal
   * dari kasir pada Blind Closing (butir 9).
   *
   * Menggantikan peran `closing_balance`, yang dipertahankan agar laporan v1
   * tetap hidup selama jendela deprekasi ([11 §M18.4]).
   */
  declared_cash?: number
  /** sen — total settle EDC yang dibacakan kasir dari mesin EDC. */
  declared_edc_total?: number
  /** sen — total settle QRIS. */
  declared_qris_total?: number

  /**
   * `true` bila shift ditutup tanpa kasir melihat angka sistem.
   *
   * Nilainya ikut dikirim agar server tahu apakah `declared_*` benar-benar
   * kesaksian buta — angka deklarasi yang diketik sambil melihat ekspektasi
   * tidak memiliki nilai audit apa pun.
   */
  blind_close?: boolean

  /** Versi master data yang dipegang perangkat saat shift dibuka (butir 10). */
  master_data_version?: number

  /** Identitas instalasi pemilik sesi (butir 12). */
  device_id?: string

  /** Staff yang menutup shift — dapat berbeda dari `staff_id` pada Force Close. */
  closed_by?: string | null

  /**
   * ⚠️ `expected_balance` dan `discrepancy` di atas **DEPRECATED pada v2**.
   *
   * Keduanya dihitung server dan tidak pernah dikirim balik ke perangkat kasir
   * ([11 §1] aturan R3/R4). Kolomnya dipertahankan agar migrasi tetap aditif;
   * kode v2 tidak boleh membacanya untuk pengambilan keputusan.
   */
}

export type LocalTransactionItem = {
  /** UUID dibuat klien. */
  id: string
  transaction_id: string
  product_id: string
  /** INT — backend memakai INT, bukan desimal. */
  quantity: number
  /** sen, snapshot harga saat transaksi. */
  unit_price: number
  /** Hanya tampilan/struk — dibuang saat kirim. */
  _product_name: string
}

/**
 * Satu baris tender — v2, butir 8 ([11 §3.2] tabel `transaction_payments`).
 *
 * Disimpan **bersarang** di dalam transaksi induk, konsisten dengan `items`:
 * payload sync memang bersarang, dan tender tanpa induknya tidak punya arti.
 */
export type LocalPayment = {
  /** UUID dibuat klien. */
  id: string
  /** Urutan tender dalam satu transaksi, mulai dari 1. */
  sequence: number
  method: PaymentMethod
  /** sen — **nominal gesek** untuk kartu, bukan total transaksi. */
  amount: number

  /** WAJIB untuk `DEBIT`/`CREDIT`. Cerminan `ck_card_requires_trace`. */
  trace_number?: string | null
  /** WAJIB untuk `DEBIT`/`CREDIT`. Tepat 4 digit. */
  card_last4?: string | null

  /**
   * ⛔ **DILARANG** menambahkan PAN penuh, CVV, PIN kartu, atau data magstripe
   * ke tipe ini ([11 §1] aturan R8). Menyimpannya memindahkan seluruh sistem ke
   * ruang lingkup PCI-DSS penuh.
   */
  card_network?: string | null
  approval_code?: string | null
  edc_terminal_id?: string | null
}

export type LocalTransaction = LocalMeta & {
  id: string
  shift_id: string
  /** String kosong bila tidak ada — kolom NOT NULL. */
  customer_name: string
  /** sen */
  total_amount: number
  /**
   * Ringkasan v1-compat. Bernilai `'SPLIT'` bila `payments.length > 1`.
   *
   * **Bukan lagi sumber kebenaran** pada v2 — `payments[]` yang menentukan.
   * Kolom ini dipertahankan agar laporan pemilik yang sudah ada tetap hidup.
   */
  payment_method: PaymentSummaryMethod
  status: TransactionStatus
  cancel_notes: string
  client_created_at: IsoDateTime
  items: LocalTransactionItem[]

  /* ── v2 ([11 §3.2] migrasi 000017 & 000018) ────────────────────────────── */

  /**
   * Rincian tender. Opsional secara tipe, **selalu ada** secara data: migrasi
   * Dexie v4 mengisinya untuk seluruh baris lama, dan `toWireTransactionV2`
   * mensintesis satu baris tunggal bila entah bagaimana kosong — sehingga
   * invarian `Σ payments.amount === total_amount` tidak pernah bocor ke server.
   *
   * Penulisnya baru lahir di M17.2; sampai saat itu setiap transaksi baru
   * memiliki tepat satu tender yang disintesis dari `payment_method`.
   */
  payments?: LocalPayment[]

  /**
   * **DISKRIMINATOR VOID vs RETUR** (butir 15, [11 §2.1]).
   *
   * `null`/absen = struk belum pernah terbit → wilayah VOID.
   * Terisi = dokumen sudah berpindah ke pelanggan → wilayah RETUR.
   *
   * Ditulis saat `print_jobs` bertipe `SALE_RECEIPT` mencapai status `PRINTED`,
   * **bukan** saat perintah cetak dikirim: perintah yang gagal di tengah tidak
   * menghasilkan kertas di tangan siapa pun.
   */
  receipt_printed_at?: IsoDateTime | null

  /** Berapa kali struk dicetak ulang. Setiap kenaikan menulis peristiwa audit. */
  reprint_count?: number

  /** Kode struk yang dapat diketik manusia, mis. `AB1234-250820-K7QF` (butir 16). */
  short_code?: string

  /** Agregat retur, dihitung server. Nilai lokal hanya untuk tampilan. */
  return_state?: ReturnState

  /** Identitas instalasi tempat transaksi lahir (butir 12). */
  device_id?: string

  voided_at?: IsoDateTime | null
  voided_by?: string | null
  void_reason_code?: string | null

  /** sen — untuk cetak ulang struk, tidak dikirim. */
  _cash_received?: number
  /** sen — idem. */
  _change?: number
}

export type LocalWaste = LocalMeta & {
  id: string
  staff_id: string
  product_id: string
  /** INT */
  quantity: number
  reason: string
  client_created_at: IsoDateTime

  /* ── v2 ([11 §3.2] migrasi 000023) ─────────────────────────────────────── */

  /** Kamus beku [11 §3.5] — `EXPIRED`, `SPOILED`, `BROKEN`, … */
  reason_code?: string
  /** Shift saat pembuangan terjadi; v1 tidak mencatatnya sama sekali. */
  shift_id?: string
  device_id?: string
  /** Bukti struk pembuangan terbit (butir 7). */
  receipt_printed?: boolean
  printed_at?: IsoDateTime | null

  _product_name: string
}

/* ── v2: Retur ([11 §3.2] migrasi 000019, butir 15) ───────────────────────── */

export type LocalReturnItem = {
  /** UUID dibuat klien. */
  id: string
  /** Baris item pada transaksi ASAL yang diretur. */
  transaction_item_id: string
  product_id: string
  /** INT — selalu > 0. Retur nol baris bukan retur. */
  quantity: number
  /** sen — snapshot harga **asal**, bukan harga hari ini. */
  unit_price: number

  /**
   * `false` untuk barang rusak: uang kembali ke pelanggan, stok **tidak**.
   *
   * Inilah yang membuat retur mustahil direduksi menjadi "transaksi bernilai
   * negatif" — arah uang dan arah barang dapat berbeda.
   */
  restock: boolean
  /** Wajib bila `restock === false`; kamus WASTE di [11 §3.5]. */
  waste_reason_code?: string | null

  /** Hanya tampilan/struk — dibuang saat kirim. */
  _product_name: string
}

/**
 * Retur adalah **peristiwa keuangan baru**, bukan perubahan atas transaksi asal.
 *
 * Transaksi asal tetap `COMPLETED` selamanya ([11 §2.1]). Mengubahnya setelah
 * struk berpindah tangan berarti menerbitkan realitas kedua yang bertentangan
 * dengan kertas di tangan pelanggan.
 */
export type LocalReturn = LocalMeta & {
  /** UUID dibuat klien, sekali seumur entitas. */
  id: string
  original_transaction_id: string
  /**
   * Shift **saat retur terjadi** — sengaja dapat berbeda dari shift transaksi
   * asal. Pelanggan yang kembali besok adalah kasus ritel normal.
   */
  shift_id: string
  device_id?: string
  staff_id: string
  authorized_by?: string | null

  return_type: ReturnKind
  refund_method: RefundMethod
  /** sen */
  refund_amount: number

  reason_code: string
  reason_notes: string

  receipt_printed: boolean
  receipt_printed_at?: IsoDateTime | null
  short_code?: string

  client_created_at: IsoDateTime
  items: LocalReturnItem[]
}

/* ── v2: Log pembatalan ([11 §3.2] migrasi 000020, butir 5, 6, 13, 15) ────── */

/**
 * Satu tabel untuk SELURUH peristiwa pembatalan — termasuk yang terjadi
 * **sebelum** sebuah transaksi lahir.
 *
 * Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
 * membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar. Tanpa baris
 * ini peristiwa tersebut tidak meninggalkan jejak apa pun — tidak ada
 * transaksi, tidak ada stok bergerak, tidak ada yang bisa diaudit.
 */
export type LocalVoidLog = LocalMeta & {
  id: string
  shift_id: string
  device_id?: string
  staff_id: string
  authorized_by?: string | null

  scope: VoidScope

  /** Hanya `scope === 'TRANSACTION'`. */
  transaction_id?: string | null
  /** Hanya `scope === 'HELD_ORDER'`. Lokal-only — server tidak mengenal hold. */
  held_cart_id?: string | null
  /** Hanya `scope === 'CART_LINE'`. */
  product_id?: string | null

  quantity_before: number
  quantity_after: number
  /** sen — nilai rupiah yang lenyap dari keranjang. */
  value_amount: number

  reason_code: string
  reason_notes: string

  /** Bukti struk pembatalan terbit (butir 6). */
  receipt_printed: boolean
  receipt_printed_at?: IsoDateTime | null

  /**
   * Salinan item untuk scope `HELD_ORDER`/`TRANSACTION`.
   *
   * Pesanan tertahan **tidak pernah ada di server**; tanpa snapshot ini, isi
   * pesanan yang dibatalkan hilang selamanya.
   */
  items_snapshot?: LocalVoidLogItem[] | null

  client_created_at: IsoDateTime
}

export type LocalVoidLogItem = {
  product_id: string
  product_name: string
  quantity: number
  /** sen */
  unit_price: number
}

/* ── v2: Audit keamanan ([11 §3.2] migrasi 000023, aturan R9) ─────────────── */

/**
 * Kanal audit yang **ikut antre sync**.
 *
 * `audit_logs` di backend hanya menangkap permintaan HTTP. Kecurangan di POS
 * terjadi justru ketika perangkat offline — dan tidak ada satu pun permintaan
 * HTTP yang lahir dari peristiwa itu.
 */
export type LocalSecurityEvent = LocalMeta & {
  id: string
  shift_id?: string | null
  staff_id?: string | null
  device_id?: string
  /** Kamus di [11 §3.3], mis. `KIOSK_EXIT_DENIED`. */
  event_type: string
  severity: SecuritySeverity
  details: Record<string, unknown>
  client_created_at: IsoDateTime
}

export type SecuritySeverity = 'INFO' | 'WARN' | 'CRITICAL'

/* ── v2: Antrean cetak — MURNI LOKAL, tidak pernah di-sync ([11 §3.8]) ────── */

export type PrintJobKind =
  | 'SALE_RECEIPT'
  | 'CANCEL_RECEIPT'
  | 'RETURN_RECEIPT'
  | 'WASTE_RECEIPT'
  | 'SHIFT_REPORT'

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'ABANDONED'

/**
 * ⚠️ Tabel ini **tidak memiliki** `LocalMeta` dan itu disengaja: kehadiran
 * `_synced` akan menggoda seseorang memasukkannya ke antrean sync. Antrean
 * cetak adalah urusan perangkat dan printernya, bukan urusan server.
 */
export type PrintJob = {
  id: string
  kind: PrintJobKind
  status: PrintJobStatus
  /** `transaction` | `return` | `void_log` | `waste` | `shift` */
  ref_type: string
  ref_id: string

  /**
   * Byte ESC/POS yang **sudah dirender**, disimpan base64.
   *
   * Dirender sekali agar cetak ulang menghasilkan kertas yang identik, bukan
   * hasil render ulang dari data yang mungkin sudah berubah.
   */
  payload: string

  attempts: number
  last_error?: string | null

  /**
   * Kapan percobaan kirim TERAKHIR terjadi — dasar jeda mundur.
   *
   * Tidak diindeks, sehingga penambahannya tidak menuntut versi Dexie baru:
   * Dexie menyimpan properti apa pun pada objeknya, dan hanya kunci terindeks
   * yang hidup di dalam skema.
   */
  last_attempt_at?: IsoDateTime | null

  created_at: IsoDateTime
  printed_at?: IsoDateTime | null
}

/* ── Murni lokal, TIDAK PERNAH dikirim ke server ──────────────────────────── */

export type HeldCart = {
  id: string
  /** mis. "Meja 4" / nama pelanggan. */
  label: string
  items: LocalTransactionItem[]
  created_at: IsoDateTime
  _staff_id: string
}

/* ── Key-value internal ───────────────────────────────────────────────────── */

export type MetaRow = { key: MetaKey | string; value: unknown; updated_at: IsoDateTime }

/** Kunci `meta` yang dibakukan ([05 §1.5.1]). */
export type MetaKey =
  /** `device_token` PASETO — ditulis saat binding (P-01). JANGAN ke localStorage. */
  | 'device.token'
  | 'device.boundAt'
  /** Nama outlet untuk ditampilkan di P-14. */
  | 'device.outletLabel'
  | 'master.lastSyncAt'
  /** `{ kind, deviceId?, host? }` */
  | 'printer.preferred'
  | 'sync.lastSuccessAt'
  /** epoch ms */
  | 'sync.backoffUntil'
  /** angka, ditulis `detectClockSkew` */
  | 'clock.lastSkewMs'
  /** Penanda database telah terisi seeder lokal. */
  | 'seed.isSeeded'
  /* ── v2 ──────────────────────────────────────────────────────────────── */
  /** Identitas instalasi, dibuat sekali saat binding — dasar butir 12. */
  | 'device.id'
  /** Versi master data yang sedang dipegang perangkat (butir 10). */
  | 'master.version'
  /**
   * Versi master data TERKINI menurut server, dari respons sync terakhir.
   *
   * Dibandingkan dengan `master.version` oleh gerbang Buka Shift. Disimpan
   * terpisah supaya perbandingannya tidak memerlukan permintaan jaringan
   * tersendiri setiap kali kasir membuka shift.
   */
  | 'master.serverVersion'
  /** Blok `config` dari master-data ([11 §4.4]) — ambang batas dari server. */
  | 'config'

/**
 * Apa yang memicu satu putaran sinkronisasi ([11 §M12.2]).
 *
 * Nilainya masuk ke `syncLog.trigger` dan dibaca saat menelusuri "mengapa
 * antrean ini baru terkirim sekarang". Karena itu ia dibedakan lebih halus
 * daripada yang dibutuhkan mesinnya sendiri: `void` dan `return` sebenarnya
 * berjalan identik dengan `transaction-commit`, tetapi membedakannya membuat
 * riwayat sync dapat menjawab pertanyaan audit tanpa menebak.
 */
export type SyncTrigger =
  /** Aplikasi baru dibuka — menangkap antrean sesi sebelumnya. */
  | 'startup'
  /** Jaringan kembali (setelah jeda 2 detik) atau service worker membangunkan. */
  | 'reconnect'
  /** Timer berkala 5 menit saat tab terlihat. */
  | 'interval'
  /** Tab kembali terlihat setelah lama di-suspend. */
  | 'visibility'
  /** Debounce 1,5 detik setelah sebuah transaksi/waste/shift tersimpan. */
  | 'transaction-commit'
  /** Debounce yang sama, tetapi pemicunya sebuah pembatalan. */
  | 'void'
  /** Debounce yang sama, tetapi pemicunya sebuah retur. */
  | 'return'
  /** Dipanggil langsung dari P-12 — laci sudah dihitung. */
  | 'shift-close'
  /** Tombol P-13. **Mengabaikan** backoff. */
  | 'manual'

/**
 * Satu baris riwayat putaran sinkronisasi.
 *
 * Dipakai P-13 dan penelusuran insiden: ketika kasir melaporkan "transaksi saya
 * tidak masuk", pertanyaan pertamanya selalu *kapan putaran terakhir berjalan,
 * apa isinya, dan apa jawaban server*. Tanpa baris ini jawabannya hanya bisa
 * ditebak dari log server, yang justru tidak memuat batch yang gagal terkirim.
 */
export type SyncLogRow = {
  /** auto-increment */
  id?: number
  at: IsoDateTime
  trigger: SyncTrigger
  ok: boolean
  shifts_sent: number
  shifts_synced: number
  transactions_sent: number
  transactions_synced: number
  wastes_sent: number
  wastes_synced: number

  /* ── v2 ([11 §M12.3]) ──────────────────────────────────────────────────── */
  returns_sent: number
  returns_synced: number
  void_logs_sent: number
  void_logs_synced: number
  security_events_sent: number
  security_events_synced: number

  /**
   * Baris yang dipindahkan ke KARANTINA pada putaran ini (`_synced = -1`).
   *
   * Dicatat terpisah dari kegagalan biasa karena maknanya berbeda secara
   * operasional: kegagalan biasa akan hilang sendiri, karantina **tidak akan
   * pernah** hilang tanpa seseorang menanganinya.
   */
  quarantined: number

  failed_transaction_ids: string[]
  error?: string
  duration_ms: number
}
