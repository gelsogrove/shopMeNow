/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/../../shared/$1",
  },
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        useESM: true,
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
  setupFilesAfterEnv: ["<rootDir>/jest.security.setup.js"],
  globalTeardown: "<rootDir>/jest.security.teardown.js",
  verbose: true,
  transformIgnorePatterns: ["node_modules/"],
  extensionsToTreatAsEsm: [".ts"],
  forceExit: true,
}
