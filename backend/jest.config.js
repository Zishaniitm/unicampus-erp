/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Match all test files
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },

  // Module path aliases matching tsconfig paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // ts-jest config — transpileOnly skips type checking (much faster)
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
        diagnostics: false,  // Disable type checking in tests (use lint for that)
        isolatedModules: true, // Faster compilation
      },
    ],
  },

  // Coverage config
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/db/migrations/**',
    '!src/db/migrate.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout for async tests
  testTimeout: 30000,
  clearMocks: true,
};

  // Clear mocks between tests automatically
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};
