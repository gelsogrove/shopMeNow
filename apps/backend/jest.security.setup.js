afterAll(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { disconnectDatabase } = require("@echatbot/database")
    if (disconnectDatabase) {
      await disconnectDatabase()
    }
  } catch {
    // Ignore cleanup errors to avoid masking test results.
  }
})
