/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  // custom-* chatbot modules are ESM and import siblings with an explicit
  // .js extension; under ts-jest those resolve to the .ts source.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/src/utils/'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  testTimeout: 15000,
  modulePathIgnorePatterns: ['/dist/'],
  // Resolve the Haste module naming collision
  haste: {
    forceNodeFilesystemAPI: true,
    hasteMapModulePath: null,
    enableSymlinks: false, 
  },
  transformIgnorePatterns: [
    'node_modules/'
  ]
}; 