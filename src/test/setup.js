import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Browser API stubs
// These don't exist in jsdom and would cause "not a function" errors if called
// during module initialisation of hooks like useEnhancedGeolocation.
// ---------------------------------------------------------------------------

// Geolocation — stubbed as unavailable by default; override per-test as needed.
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
  configurable: true,
})

// Silence console.error calls that come from dataService's missing-column warnings.
// Tests that specifically check these warnings can restore it with vi.spyOn.
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
