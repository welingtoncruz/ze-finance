import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'app/**/{page,layout,loading,error,not-found,route,default}.{js,ts,jsx,tsx}',
    'app/**/route.{js,ts}',
    'next.config.{js,ts}',
    'middleware.{js,ts}',
  ],
  project: [
    'app/**/*.{js,ts,jsx,tsx}',
    'components/**/*.{js,ts,jsx,tsx}',
    'context/**/*.{js,ts,jsx,tsx}',
    'lib/**/*.{js,ts,jsx,tsx}',
  ],
  ignore: [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}',
    '**/tests/**',
    '**/e2e/**',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/.next/**',
  ],
  ignoreDependencies: [
    // Next.js internal dependencies
    '@next/next',
    'next/dist',
    // Type definitions
    '@types/node',
    '@types/react',
    '@types/react-dom',
  ],
};

export default config;
