import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Real unit photos live on Cloudinary under decar/, linked by the API's
    // `python -m app.photos`: /<cloud>/image/upload/v<version>/decar/….
    remotePatterns: [new URL("https://res.cloudinary.com/*/image/upload/*/decar/**")],
  },
};

export default nextConfig;
