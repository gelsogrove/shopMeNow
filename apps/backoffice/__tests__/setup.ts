import "@testing-library/jest-dom"
import { configure } from '@testing-library/react'

// Increase default timeout for waitFor (some tests need more time)
configure({ asyncUtilTimeout: 5000 })
