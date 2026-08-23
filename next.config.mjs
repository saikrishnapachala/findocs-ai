/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // unpdf ships an ESM build of pdfjs; keep it external to the server bundle
  // so the worker resolves correctly in the Node serverless runtime.
  serverExternalPackages: ['unpdf', 'pdfjs-dist'],
  eslint: {
    // CI runs `next lint` as a separate step; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
