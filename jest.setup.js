// Jest setup file for testing environment
const jest = require("jest")
const { beforeEach } = require("@jest/globals")
import "whatwg-fetch"

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.CLEARBIT_API_KEY = "test-clearbit-key"
process.env.PEOPLE_DATA_LABS_API_KEY = "test-pdl-key"
process.env.SERPAPI_KEY = "test-serpapi-key"

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock AbortController for Node.js environments
if (!global.AbortController) {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = {
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }
    }

    abort() {
      this.signal.aborted = true
    }
  }
}

// Mock setTimeout and clearTimeout
global.setTimeout = jest.fn((fn, delay) => {
  if (typeof fn === "function") {
    fn()
  }
  return 1
})

global.clearTimeout = jest.fn()

// Setup fetch mock
global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})
