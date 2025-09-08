import type { HistoryEntry } from '../types/storage';

import { closeModal as closeDOMModal } from './dom.js';
import { addLabelDefinition } from './dropdowns.js';

import { getAllHistory, saveHistory } from '@/platform';
import { uuid } from '@/shared/misc';

// Timer for updating history timestamps
let historyUpdateTimer: number | null = null;

/**
 * Label data structure
 */
interface LabelData {
    name: string;
    color: string;
    range?: string; // Optional range for display
}

/**
 * Setup the new label modal functionality
 */
export function setupLabelModal(): void {
    const modal = document.getElementById('modal-label-new');
    const form = document.getElementById('label-new-form') as HTMLFormElement | null;
    const nameInput = document.getElementById('label-name') as HTMLInputElement | null;
    const nameError = document.getElementById('label-name-error');
    const colorCustom = document.getElementById('label-color-custom') as HTMLInputElement | null;
    const createBtn = document.getElementById('label-create-btn') as HTMLButtonElement | null;
    const colorPresets = document.querySelectorAll<HTMLButtonElement>('.color-preset');

    if (!modal || !form || !nameInput || !nameError || !colorCustom || !createBtn) {
        return;
    }

    let selectedColor = '#3498db'; // Default color

    // Handle color preset selection
    colorPresets.forEach((preset) => {
        preset.addEventListener('click', () => {
            // Remove selected state from all presets
            colorPresets.forEach((p) => {
                p.classList.remove('selected');
            });
            // Add selected state to clicked preset
            preset.classList.add('selected');

            const color = preset.dataset.color;
            if (color) {
                selectedColor = color;
                // Update custom color picker to match
                colorCustom.value = color;
            }
        });
    });

    // Handle custom color picker
    colorCustom.addEventListener('input', () => {
        selectedColor = colorCustom.value;
        // Remove selected state from all presets when using custom color
        colorPresets.forEach((p) => {
            p.classList.remove('selected');
        });
    });

    // Real-time validation for label name
    const validateName = (): boolean => {
        const name = nameInput.value.trim();

        if (!name) {
            nameError.innerHTML =
                '<span class="material-symbols-outlined">error</span>Label name cannot be empty';
            nameInput.setAttribute('aria-invalid', 'true');
            createBtn.disabled = true;
            return false;
        }

        // Valid name
        nameError.innerHTML = '';
        nameInput.setAttribute('aria-invalid', 'false');
        createBtn.disabled = false;
        return true;
    };

    // Validate on input
    nameInput.addEventListener('input', validateName);

    // Handle form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!validateName()) {
            return;
        }

        const labelData: LabelData = {
            name: nameInput.value.trim(),
            color: selectedColor,
            range: '[0 – 0]', // Placeholder range
        };

        void createLabel(labelData);
        resetForm();
        closeModal();
    });

    // Reset form when modal opens
    modal.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-close]') || target === modal) {
            closeModal();
        }
    });

    // Initialize with first preset selected
    if (colorPresets[0]) {
        colorPresets[0].classList.add('selected');
        selectedColor = colorPresets[0].dataset.color || '#3498db';
        colorCustom.value = selectedColor;
    }

    function resetForm(): void {
        if (!form || !nameError || !nameInput || !createBtn || !colorCustom) return;

        form.reset();
        nameError.innerHTML = '';
        nameInput.setAttribute('aria-invalid', 'false');
        createBtn.disabled = false;

        // Reset color selection to first preset
        colorPresets.forEach((p) => {
            p.classList.remove('selected');
        });
        if (colorPresets[0]) {
            colorPresets[0].classList.add('selected');
            selectedColor = colorPresets[0].dataset.color || '#3498db';
            colorCustom.value = selectedColor;
        }
    }

    function closeModal(): void {
        // Use the centralized closeModal function for proper focus management
        closeDOMModal(modal);

        // Focus the button that opened the modal
        const openButton = document.querySelector('[data-modal="label-new"]') as HTMLElement;
        openButton.focus();
    }
}

/**
 * Create a new label definition (for future use in labeling)
 */
async function createLabel(labelData: LabelData): Promise<void> {
    // Add the label definition to the registry (now async)
    await addLabelDefinition(labelData.name, labelData.color);

    // Add history entry
    await addHistoryEntry(`Created label definition "${labelData.name}"`);

    // Dispatch event for other components to listen to
    window.dispatchEvent(
        new CustomEvent('timelab:labelDefinitionCreated', {
            detail: { label: labelData },
        })
    );
}

/**
 * Add an entry to the history list
 */
export async function addHistoryEntry(action: string): Promise<void> {
    const historyList = document.querySelector<HTMLUListElement>('.history-list');
    if (!historyList) {
        return;
    }

    // Create history entry object
    const historyEntry: HistoryEntry = {
        id: uuid(),
        action,
        timestamp: Date.now(),
    };

    // Save to IndexedDB
    try {
        const result = await saveHistory(historyEntry);
        if (!result.ok) {
            // Failed to save history entry
            return;
        }
    } catch (_error) {
        // Failed to save history entry
        return;
    }

    const historyItem = document.createElement('li');
    historyItem.className = 'history-item';
    historyItem.setAttribute('role', 'option');
    historyItem.setAttribute('aria-selected', 'false');
    historyItem.setAttribute('tabindex', '0');
    historyItem.setAttribute('data-timestamp', historyEntry.timestamp.toString());
    historyItem.innerHTML = `
        <div class="meta">
            <div class="title">${escapeHtml(action)}</div>
            <div class="time text-sm text-muted" data-time-element>just now</div>
        </div>
    `;

    // Add to the top of the history list
    historyList.prepend(historyItem);
}

/**
 * Load and display history entries from IndexedDB
 */
export async function loadHistoryEntries(): Promise<void> {
    const historyList = document.querySelector<HTMLUListElement>('.history-list');
    if (!historyList) {
        return;
    }

    try {
        const result = await getAllHistory<HistoryEntry>();

        if (result.ok) {
            const historyEntries = result.value;

            // Sort by timestamp (newest first)
            historyEntries.sort((a: HistoryEntry, b: HistoryEntry) => b.timestamp - a.timestamp);

            // Clear existing entries
            historyList.innerHTML = '';

            // Render each entry
            historyEntries.forEach((entry: HistoryEntry) => {
                renderHistoryEntry(entry, historyList);
            });

            // Setup visibility observer for real-time updates
            setupHistoryPanelObserver();
        }
    } catch (_error) {
        // Failed to load history entries
    }
}

/**
 * Render a single history entry in the UI
 */
function renderHistoryEntry(entry: HistoryEntry, historyList: HTMLUListElement): void {
    const historyItem = document.createElement('li');
    historyItem.className = 'history-item';
    historyItem.setAttribute('role', 'option');
    historyItem.setAttribute('aria-selected', 'false');
    historyItem.setAttribute('tabindex', '0');
    historyItem.setAttribute('data-timestamp', entry.timestamp.toString());

    // Format timestamp
    const timeText = formatTimestamp(entry.timestamp);

    historyItem.innerHTML = `
        <div class="meta">
            <div class="title">${escapeHtml(entry.action)}</div>
            <div class="time text-sm text-muted" data-time-element>${timeText}</div>
        </div>
    `;

    historyList.appendChild(historyItem);
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    // Less than a minute
    if (diff < 60000) {
        return 'just now';
    }

    // Less than an hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes.toString()} min ago`;
    }

    // Less than a day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours.toString()}h ago`;
    }

    // More than a day - show date
    const date = new Date(timestamp);
    return date.toLocaleDateString();
}

/**
 * Update all visible history timestamps
 */
function updateHistoryTimestamps(): void {
    const historyItems = document.querySelectorAll<HTMLElement>('.history-item[data-timestamp]');

    historyItems.forEach((item) => {
        const timestampStr = item.getAttribute('data-timestamp');
        if (!timestampStr) return;

        const timestamp = parseInt(timestampStr, 10);
        const timeElement = item.querySelector<HTMLElement>('[data-time-element]');

        if (timeElement) {
            timeElement.textContent = formatTimestamp(timestamp);
        }
    });
}

/**
 * Start the history update timer
 */
function startHistoryUpdateTimer(): void {
    // Clear any existing timer
    stopHistoryUpdateTimer();

    // Update every 30 seconds
    historyUpdateTimer = window.setInterval(updateHistoryTimestamps, 30000);
}

/**
 * Stop the history update timer
 */
function stopHistoryUpdateTimer(): void {
    if (historyUpdateTimer !== null) {
        clearInterval(historyUpdateTimer);
        historyUpdateTimer = null;
    }
}

/**
 * Setup history panel visibility observer
 */
function setupHistoryPanelObserver(): void {
    const historyPanel = document.querySelector('.history-list');
    if (!historyPanel) return;

    // Use Intersection Observer to detect when history panel becomes visible
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0) {
                    // Panel is visible, start updating timestamps
                    startHistoryUpdateTimer();
                } else {
                    // Panel is not visible, stop updating
                    stopHistoryUpdateTimer();
                }
            });
        },
        {
            threshold: 0.1, // Trigger when at least 10% of the panel is visible
        }
    );

    observer.observe(historyPanel);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopHistoryUpdateTimer();
        observer.disconnect();
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup modal opening functionality
 */
export function setupModalTriggers(): void {
    // Handle all modal triggers
    const modalTriggers = document.querySelectorAll<HTMLElement>('[data-modal]');

    modalTriggers.forEach((trigger) => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = trigger.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(`modal-${modalId}`);
                if (modal) {
                    modal.setAttribute('aria-hidden', 'false');

                    // Focus first focusable element in modal
                    const firstInput = modal.querySelector<HTMLElement>(
                        'input, button, [tabindex]:not([tabindex="-1"])'
                    );
                    firstInput?.focus();
                }
            }
        });
    });

    // Handle modal backdrop and close button clicks
    const modals = document.querySelectorAll<HTMLElement>('.modal');
    modals.forEach((modal) => {
        modal.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-close]') || target === modal) {
                closeDOMModal(modal);
            }
        });

        // Handle Escape key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDOMModal(modal);
            }
        });
    });
}
