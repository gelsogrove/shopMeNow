require("dotenv").config()

global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

jest.mock("./src/utils/logger", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

jest.setTimeout(10000)
// Ensure all async operations complete before Jest exits
afterAll(async () => {
  // Give pending promises a chance to resolve
  await new Promise(resolve => setTimeout(resolve, 100))
}, 1000)