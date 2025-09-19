const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/' // Exclude Playwright tests
  ],
  projects: [
    {
      displayName: 'API Tests',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/src/app/api/**/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      },
    },
    {
      displayName: 'Service Tests',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/src/lib/**/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      },
    },
    {
      displayName: 'React Tests',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: ['**/src/(components|contexts|hooks)/**/__tests__/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/generated/**',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)