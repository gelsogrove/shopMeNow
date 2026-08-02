/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/../../shared/$1",
    // The custom-* chatbot modules are ESM and import each other with explicit
    // ".js" suffixes (required at runtime by Node's ESM resolver). Jest runs
    // them through ts-jest as CommonJS, where that suffix does not resolve, so
    // it is stripped here. Test-only: the emitted code is untouched.
    "^(\\.{1,2}/.*)\\.js$": "$1",
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
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/src/utils/"],
  testMatch: [
    "**/src/__tests__/unit/**/*.spec.ts",
    "**/__tests__/unit/**/*.spec.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/src/__tests__/security/",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  verbose: true,
  transformIgnorePatterns: ["node_modules/"],
  extensionsToTreatAsEsm: [".ts"],
}
