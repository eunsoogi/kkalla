/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack5: true,
  webpack: (config, options) => {
    config.cache = false;
    return config;
  }
};

export default nextConfig;
