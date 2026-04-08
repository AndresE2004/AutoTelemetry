/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
