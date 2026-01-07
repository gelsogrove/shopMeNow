/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
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
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/src/utils/"],
  testMatch: [
    "**/src/__tests__/unit/**/*.spec.ts",
    "**/__tests__/unit/**/*.spec.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/src/__tests__/security/",
    // Exclude tests that require real database (should be in integration suite)
    "customer-support-agent-faq.spec.ts",
    "message-repository-price-visibility.spec.ts",
    "whatsapp-webhook-registration-link.spec.ts",
    "whatsapp-webhook-first-message.spec.ts",
    "whatsapp-webhook-welcome-once.spec.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  verbose: true,
  transformIgnorePatterns: ["node_modules/"],
  extensionsToTreatAsEsm: [".ts"],
}
