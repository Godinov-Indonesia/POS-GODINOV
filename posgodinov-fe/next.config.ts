import type { NextConfig } from "next";

/**
 * Route khusus pengembangan dikeluarkan dari build produksi lewat
 * `pageExtensions`, bukan lewat `notFound()` di dalam komponen.
 *
 * Perbedaannya nyata dan sempat terbukti: dengan `notFound()`, request memang
 * dijawab `404`, tetapi berkas halaman tetap ikut dikompilasi dan **isinya
 * tetap terkirim ke peramban** di dalam chunk JavaScript — termasuk PIN kasir
 * dan seluruh fixture uji. Dengan cara ini, `page.dev.tsx` bukan halaman sama
 * sekali di produksi, sehingga tidak ada yang dapat di-bundle.
 *
 * Konvensi: beri nama `page.dev.tsx` untuk route yang hanya boleh ada saat
 * pengembangan.
 */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  pageExtensions: isDev ? ["tsx", "ts", "jsx", "js", "dev.tsx"] : ["tsx", "ts", "jsx", "js"],
  allowedDevOrigins: ['192.168.100.95', 'localhost']
};

export default nextConfig;
