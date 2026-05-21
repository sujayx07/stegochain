/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  // Compress responses — massive bandwidth savings
  compress: true,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Reduce re-renders on layout changes
  experimental: {
    scrollRestoration: true,
  },

  // SWC minification (enabled by default in Next 13+, but explicit is safer)
  swcMinify: true,

  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000",
    NEXT_PUBLIC_CHAIN_ID: "11155111",
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xa33fE3cee390910f8832134De02f7DC9bf473AfF",
    NEXT_PUBLIC_BASESCAN_URL: "https://sepolia.etherscan.io",
  },

  // Webpack: tree-shake framer-motion properly + reduce bundle
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      // Alias the full framer-motion to the smaller dom package
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    return config;
  },
};
