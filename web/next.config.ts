import type { NextConfig } from 'next';
// O site não usa next/image; desligar o otimizador remove o endpoint /_next/image.
const config: NextConfig = { poweredByHeader: false, images: { unoptimized: true }, experimental: { cpus: 1 } };
export default config;
