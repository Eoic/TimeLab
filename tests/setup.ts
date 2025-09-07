import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock console.log and console.warn by default to reduce test noise
beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log('Test environment initialized');

    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup global DOM elements that the app expects
    document.body.innerHTML = `
    <div id="loading-screen" class="loading-screen">
      <div class="loading-percentage">0%</div>
      <div class="loading-status">Loading...</div>
    </div>
    <div class="container">
      <div class="labels-list" role="listbox" aria-label="Time series labels"></div>
      <div class="history-list"></div>
    </div>
  `;
});

beforeEach(() => {
    // Clear IndexedDB before each test
    // Note: fake-indexeddb clears automatically between tests

    // Reset DOM to clean state
    const labelsList = document.querySelector('.labels-list');
    if (labelsList) {
        labelsList.innerHTML = '';
    }

    const historyList = document.querySelector('.history-list');
    if (historyList) {
        historyList.innerHTML = '';
    }
});

afterEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
});
