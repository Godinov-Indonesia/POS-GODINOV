/**
 * Jalur 1 — Web Bluetooth (Chrome/Android). docs/05 §1.7.2.
 *
 * Jalur cetak utama pada konfigurasi yang direkomendasikan (tablet Android +
 * Chrome). Tidak tersedia di Safari/iOS maupun Firefox ([05 §1.7.6]).
 */

import type { PrinterStatus, ReceiptPrinter } from '@/lib/printer/types'

// UUID paling umum pada printer termal BLE generik. Merek tertentu memakai UUID
// lain — pengaturan lanjutan di P-14 dapat menimpanya.
const PRINTER_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_WRITE = '00002af1-0000-1000-8000-00805f9b34fb'

/** Di bawah MTU BLE umum (185 byte payload ATT). */
const CHUNK_SIZE = 180
/** Buffer printer termal mudah luber; jeda antar-potongan bukan optimasi. */
const CHUNK_DELAY_MS = 20

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class WebBluetoothAdapter implements ReceiptPrinter {
  readonly kind = 'web-bluetooth' as const
  readonly label = 'Printer Bluetooth'

  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private status: PrinterStatus = { state: 'disconnected' }

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  getStatus(): PrinterStatus {
    if (!this.isSupported()) {
      return { state: 'unavailable', reason: 'Peramban ini tidak mendukung Web Bluetooth' }
    }
    return this.status
  }

  /** ⚠️ Wajib dipanggil dari handler gestur pengguna — Chrome menolak selain itu. */
  async connect(): Promise<void> {
    if (!this.isSupported()) throw new Error('Web Bluetooth tidak tersedia di peramban ini')

    this.status = { state: 'connecting' }
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE] }],
        optionalServices: [PRINTER_SERVICE],
      })

      // Printer termal sering mati sendiri untuk menghemat baterai; tanpa
      // listener ini, status di UI akan berbohong sampai cetak berikutnya gagal.
      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null
        this.status = { state: 'disconnected' }
      })

      const server = await this.device.gatt?.connect()
      if (!server) throw new Error('Gagal terhubung ke printer')

      const service = await server.getPrimaryService(PRINTER_SERVICE)
      this.characteristic = await service.getCharacteristic(PRINTER_WRITE)
      this.status = { state: 'ready' }
    } catch (error) {
      this.status = {
        state: 'error',
        message: error instanceof Error ? error.message : 'Gagal terhubung',
      }
      throw error
    }
  }

  async print(payload: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error('Printer belum terhubung')

    this.status = { state: 'printing' }
    try {
      for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
        const chunk = payload.slice(offset, offset + CHUNK_SIZE)
        // `WithoutResponse` jauh lebih cepat dan didukung lebih luas pada
        // printer generik; jeda tetap dan chunk kecil menggantikan flow control.
        await this.characteristic.writeValueWithoutResponse(chunk)
        await sleep(CHUNK_DELAY_MS)
      }
      this.status = { state: 'ready' }
    } catch (error) {
      this.status = {
        state: 'error',
        message: error instanceof Error ? error.message : 'Gagal mencetak',
      }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect()
    this.characteristic = null
    this.device = null
    this.status = { state: 'disconnected' }
  }
}
