import { addLabelDefinition } from './dropdowns.js';

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

        // TODO: Check for duplicate names in label definitions registry
        // For now, we'll just check that the name is not empty

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

        createLabel(labelData);
        resetForm();
        closeModal();
    });

    // Reset form when modal opens
    modal.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.hasAttribute('data-close') || target === modal) {
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
        modal?.setAttribute('aria-hidden', 'true');

        // Focus the button that opened the modal
        const openButton = document.querySelector('[data-modal="label-new"]') as HTMLElement;
        openButton.focus();
    }
}

/**
 * Create a new label definition (for future use in labeling)
 */
function createLabel(labelData: LabelData): void {
    // Add the label definition to the registry
    addLabelDefinition(labelData.name, labelData.color);

    // Add history entry
    addHistoryEntry(`Created label definition "${labelData.name}"`);

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
function addHistoryEntry(action: string): void {
    const historyList = document.querySelector<HTMLUListElement>('.history-list');
    if (!historyList) {
        return;
    }

    const historyItem = document.createElement('li');
    historyItem.className = 'history-item';
    historyItem.setAttribute('role', 'option');
    historyItem.setAttribute('aria-selected', 'false');
    historyItem.setAttribute('tabindex', '0');
    historyItem.innerHTML = `
        <div class="meta">
            <div class="title">${escapeHtml(action)}</div>
            <div class="time text-sm text-muted">just now</div>
        </div>
    `;

    // Add to the top of the history list
    historyList.prepend(historyItem);
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
            if (target.hasAttribute('data-close') || target === modal) {
                modal.setAttribute('aria-hidden', 'true');
            }
        });

        // Handle Escape key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.setAttribute('aria-hidden', 'true');
            }
        });
    });
}
