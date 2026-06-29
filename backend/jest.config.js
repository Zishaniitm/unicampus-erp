/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globals: { 'ts-jest': { tsconfig: 'tsconfig.test.json' } },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/db/migrations/**'],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
};
