import { confirmDelete } from './confirmation.js';
import { getLabelDefinitions, updateLabelDefinition, deleteLabelDefinition } from './dropdowns.js';

/**
 * Setup label management functionality
 */
export function setupLabelManagement(): void {
    const manageButton = document.querySelector('#btn-manage-labels');
    const modal = document.querySelector('#modal-label-manage');

    if (!manageButton || !modal) {
        return;
    }

    // Open modal when manage button is clicked
    manageButton.addEventListener('click', () => {
        openLabelManagementModal();
    });

    // Close modal when clicking backdrop or close button
    modal.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-close]') || target === modal) {
            closeLabelManagementModal();
        }
    });

    // Handle escape key
    modal.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape') {
            closeLabelManagementModal();
        }
    });
}

/**
 * Open the label management modal and populate it with current labels
 */
function openLabelManagementModal(): void {
    const modal = document.querySelector('#modal-label-manage');
    const listContainer = document.querySelector('#label-manage-list');

    if (!modal || !listContainer) {
        return;
    }

    // Populate the list with current label definitions
    populateLabelManagementList();

    // Show modal
    modal.setAttribute('aria-hidden', 'false');
}

/**
 * Close the label management modal
 */
function closeLabelManagementModal(): void {
    const modal = document.querySelector('#modal-label-manage');
    if (!modal) {
        return;
    }

    modal.setAttribute('aria-hidden', 'true');
}

/**
 * Populate the label management list with current label definitions
 */
function populateLabelManagementList(): void {
    const listContainer = document.querySelector('#label-manage-list');
    if (!listContainer) {
        return;
    }

    const labelDefinitions = getLabelDefinitions();

    // Clear existing content
    listContainer.innerHTML = '';

    if (labelDefinitions.length === 0) {
        // Show proper empty state using existing empty state component
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state labels-empty';
        emptyState.innerHTML = `
            <div class="empty-state-content">
                <span class="material-symbols-outlined empty-icon" aria-hidden="true">label_off</span>
                <div class="empty-title">No labels created</div>
                <div class="empty-subtitle">Create your first label definition to get started</div>
            </div>
        `;
        listContainer.appendChild(emptyState);
        return;
    }

    // Create items for each label definition
    labelDefinitions.forEach((label, index) => {
        const item = createLabelManagementItem(label, index);
        listContainer.appendChild(item);
    });
}

/**
 * Create a label management item element
 */
function createLabelManagementItem(
    label: { name: string; color: string },
    index: number
): HTMLElement {
    const item = document.createElement('div');
    item.className = 'label-management-item';
    item.dataset.index = String(index);

    item.innerHTML = `
        <div class="label-preview">
            <span class="dot" style="--dot: ${label.color}"></span>
        </div>
        <div class="label-content">
            <div class="label-display">
                <span class="label-name-display">${escapeHtml(label.name)}</span>
            </div>
            <div class="label-edit" style="display: none;">
                <input class="label-color-input" type="color" value="${label.color}">
                <input class="label-name-input" type="text" value="${escapeHtml(label.name)}" placeholder="Label name">
            </div>
        </div>
        <div class="label-actions">
            <button class="btn-icon btn-ghost edit-btn" 
                    aria-label="Edit ${escapeHtml(label.name)}"
                    title="Edit label">
                <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-icon btn-ghost save-btn" 
                    aria-label="Save changes"
                    title="Save changes"
                    style="display: none;">
                <span class="material-symbols-outlined">check</span>
            </button>
            <button class="btn-icon btn-ghost cancel-btn" 
                    aria-label="Cancel editing"
                    title="Cancel editing"
                    style="display: none;">
                <span class="material-symbols-outlined">close</span>
            </button>
            <button class="btn-icon btn-ghost delete-btn" 
                    aria-label="Delete ${escapeHtml(label.name)}"
                    title="Delete label">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;

    // Add event listeners
    setupItemEventListeners(item, index, label);

    return item;
}

/**
 * Setup event listeners for a label management item
 */
function setupItemEventListeners(
    item: HTMLElement,
    index: number,
    label: { name: string; color: string }
): void {
    const editBtn = item.querySelector('.edit-btn') as HTMLButtonElement;
    const saveBtn = item.querySelector('.save-btn') as HTMLButtonElement;
    const cancelBtn = item.querySelector('.cancel-btn') as HTMLButtonElement;
    const deleteBtn = item.querySelector('.delete-btn') as HTMLButtonElement;

    const nameInput = item.querySelector('.label-name-input') as HTMLInputElement;
    const colorInput = item.querySelector('.label-color-input') as HTMLInputElement;

    // Edit button
    editBtn.addEventListener('click', () => {
        enterEditMode(item);
    });

    // Save button
    saveBtn.addEventListener('click', () => {
        saveChanges(item, index);
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        cancelEditing(item, label);
    });

    // Delete button
    deleteBtn.addEventListener('click', () => {
        void deleteLabelDefinitionWithConfirm(index, label);
    });

    // Handle enter key to save
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveChanges(item, index);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditing(item, label);
        }
    });

    // Handle color input change
    colorInput.addEventListener('input', () => {
        const dot = item.querySelector('.dot') as HTMLElement;
        dot.style.setProperty('--dot', colorInput.value);
    });
}

/**
 * Enter edit mode for a label item
 */
function enterEditMode(item: HTMLElement): void {
    const labelDisplay = item.querySelector('.label-display') as HTMLElement;
    const labelEdit = item.querySelector('.label-edit') as HTMLElement;
    const nameInput = item.querySelector('.label-name-input') as HTMLInputElement;

    const editBtn = item.querySelector('.edit-btn') as HTMLButtonElement;
    const saveBtn = item.querySelector('.save-btn') as HTMLButtonElement;
    const cancelBtn = item.querySelector('.cancel-btn') as HTMLButtonElement;
    const deleteBtn = item.querySelector('.delete-btn') as HTMLButtonElement;

    // Hide display elements, show edit container
    labelDisplay.style.display = 'none';
    labelEdit.style.display = 'flex';

    // Hide edit/delete buttons, show save/cancel
    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';

    // Focus name input and select text
    nameInput.focus();
    nameInput.select();

    // Add editing class for styling
    item.classList.add('editing');
}

/**
 * Save changes from edit mode
 */
function saveChanges(item: HTMLElement, index: number): void {
    const nameInput = item.querySelector('.label-name-input') as HTMLInputElement;
    const colorInput = item.querySelector('.label-color-input') as HTMLInputElement;

    const newName = nameInput.value.trim();
    const newColor = colorInput.value;

    // Validate
    if (!newName) {
        nameInput.focus();
        return;
    }

    // Check for duplicate names (excluding current item)
    const allLabels = getLabelDefinitions();
    const isDuplicate = allLabels.some(
        (label, i) => i !== index && label.name.toLowerCase() === newName.toLowerCase()
    );

    if (isDuplicate) {
        alert('A label with this name already exists. Please choose a different name.');
        nameInput.focus();
        nameInput.select();
        return;
    }

    // Update the label definition
    updateLabelDefinition(index, newName, newColor);

    // Exit edit mode
    exitEditMode(item, newName, newColor);
}

/**
 * Cancel editing and revert changes
 */
function cancelEditing(item: HTMLElement, originalLabel: { name: string; color: string }): void {
    const nameInput = item.querySelector('.label-name-input') as HTMLInputElement;
    const colorInput = item.querySelector('.label-color-input') as HTMLInputElement;

    // Revert to original values
    nameInput.value = originalLabel.name;
    colorInput.value = originalLabel.color;
    const dot = item.querySelector('.dot') as HTMLElement;
    dot.style.setProperty('--dot', originalLabel.color);

    // Exit edit mode
    exitEditMode(item, originalLabel.name, originalLabel.color);
}

/**
 * Exit edit mode and return to display mode
 */
function exitEditMode(item: HTMLElement, name: string, _color: string): void {
    const nameDisplay = item.querySelector('.label-name-display') as HTMLElement;
    const labelDisplay = item.querySelector('.label-display') as HTMLElement;
    const labelEdit = item.querySelector('.label-edit') as HTMLElement;

    const editBtn = item.querySelector('.edit-btn') as HTMLButtonElement;
    const saveBtn = item.querySelector('.save-btn') as HTMLButtonElement;
    const cancelBtn = item.querySelector('.cancel-btn') as HTMLButtonElement;
    const deleteBtn = item.querySelector('.delete-btn') as HTMLButtonElement;

    // Update display values
    nameDisplay.textContent = name;

    // Show display container, hide edit container
    labelDisplay.style.display = 'block';
    labelEdit.style.display = 'none';

    // Show edit/delete buttons, hide save/cancel
    editBtn.style.display = 'inline-flex';
    deleteBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';

    // Remove editing class
    item.classList.remove('editing');
}

/**
 * Delete a label definition with confirmation
 */
async function deleteLabelDefinitionWithConfirm(
    index: number,
    label: { name: string; color: string }
): Promise<void> {
    const confirmed = await confirmDelete(label.name, 'label');
    if (!confirmed) {
        return;
    }

    // Delete the label definition
    deleteLabelDefinition(index);

    // Refresh the list
    populateLabelManagementList();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
