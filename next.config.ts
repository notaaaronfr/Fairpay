import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default config;
