const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Permite habilitar PWA também no dev definindo ENABLE_PWA_DEV=1
  disable: process.env.NODE_ENV === 'development' && process.env.ENABLE_PWA_DEV !== '1',
  swSrc: 'service-worker.js',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
