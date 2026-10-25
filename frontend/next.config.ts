import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // /admin sends one photo per action, shrunk in the browser to ~1 MB. Vercel
    // refuses request bodies over 4.5 MB whatever this says.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Real unit photos live on Cloudinary under decar/, uploaded by the API
    // (/admin or `pnpm photos`): /<cloud>/image/upload/v<version>/decar/….
    remotePatterns: [new URL("https://res.cloudinary.com/*/image/upload/*/decar/**")],
  },
};

export default nextConfig;
