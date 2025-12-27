/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        isolatedModules: true,
        diagnostics: {
          ignoreCodes: [2615, 6133],
        },
      },
    ],
  },
  testEnvironment: "node",
  testTimeout: 60000, // 60s for integration tests (workspace-isolation needs real DB + Express)
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/src/utils/"],
  testMatch: ["**/__tests__/security/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // NO setupFilesAfterEnv - security tests use real DB, no mocks
  verbose: true,
  transformIgnorePatterns: ["node_modules/"],
  extensionsToTreatAsEsm: [".ts"],
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
}
