const createNextIntlPlugin = require('next-intl/plugin');
const withPWA = require('@ducanh2912/next-pwa').default;

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // no service worker in dev (preserves hot reload)
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
})(withNextIntl(nextConfig));
