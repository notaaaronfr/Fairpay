import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default config;
