# Migrasi yang sengaja diparkir

Berkas di folder ini **tidak dijalankan** oleh `migrate up`, dan itulah
tujuannya. `cmd/api/main.go` mengarahkan golang-migrate ke `db/migrations`
saja — apa pun yang ada di sini berada di luar jangkauannya, termasuk saat
`Dockerfile` menyalin migrasi ke image.

Ini menggantikan pengamanan berbasis nama berkas, yang **tidak bekerja**:
golang-migrate mengurai nama sebagai `{versi}_{judul}`, sehingga
`000025_DO_NOT_RUN_YET_...` tetap terbaca sebagai versi `25` dan tetap
dijalankan. Awalan `DO_NOT_RUN_YET` hanya menjadi bagian judul. Satu-satunya
hal yang menyelamatkan basis data saat itu adalah guard `RAISE EXCEPTION`
di dalam SQL-nya.

## Cara mengaktifkan kembali

Pindahkan pasangan `.up.sql` dan `.down.sql`-nya kembali ke `db/migrations/`
**setelah** seluruh gerbang di kepala berkas terpenuhi. Memindahkannya adalah
tindakan yang harus disengaja dan ditinjau — persis sebagaimana `DROP COLUMN`
seharusnya.
