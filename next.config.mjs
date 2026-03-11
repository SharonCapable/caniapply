/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: ["pdf-parse", "sharp", "tesseract.js"],
    },
};


export default nextConfig;
