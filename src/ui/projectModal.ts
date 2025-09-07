/**
 * Project management modal components
 */

import { projectService } from '../services/projectService.js';
import type { Project } from '../types/project.js';

import { showConfirmation } from './confirmation.js';

/**
 * Show a modal to create a new project
 */
export function showCreateProjectModal(): Promise<boolean> {
    return new Promise((resolve) => {
        // Close any open dropdowns before showing modal
        const openDropdowns = document.querySelectorAll('.dropdown-menu');
        openDropdowns.forEach((menu) => {
            const menuElement = menu as HTMLElement;
            // Check if dropdown is actually visible
            if (menuElement.style.display === 'block' || menuElement.offsetParent !== null) {
                const dropdown = menu.closest('.project-dropdown');
                if (dropdown) {
                    const button = dropdown.querySelector('.project-dropdown-btn');
                    if (button) {
                        button.classList.remove('active');
                    }
                }
                menuElement.style.display = 'none';
            }
        });

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modal-create-project';
        modal.setAttribute('aria-hidden', 'false');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'create-project-title');

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog modal-fluid card" role="document">
                <div class="card-title">
                    <span class="material-symbols-outlined" aria-hidden="true">create_new_folder</span>
                    <h4 id="create-project-title">Create new project</h4>
                </div>
                <form id="create-project-form" class="card-content">
                    <div class="form-group">
                        <label for="project-name-input" class="form-label">Project Name</label>
                        <input 
                            type="text" 
                            id="project-name-input" 
                            class="form-input" 
                            placeholder="Enter project name"
                            required
                            autofocus
                        />
                        <div id="project-name-error" class="form-error" aria-live="polite"></div>
                    </div>
                    <div class="form-group">
                        <label for="project-description-input" class="form-label">Description (optional)</label>
                        <textarea 
                            id="project-description-input" 
                            class="form-input" 
                            placeholder="Brief description of the project"
                            rows="3"
                        ></textarea>
                    </div>
                </form>
                <div class="modal-actions">
                    <button class="btn-outline" type="button" id="create-project-cancel">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span>
                        Cancel
                    </button>
                    <button class="btn-primary" type="submit" form="create-project-form" id="create-project-submit">
                        <span class="material-symbols-outlined" aria-hidden="true">add</span>
                        Create project
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus the name input after the modal is added to the DOM
        // Use requestAnimationFrame to ensure the modal is fully rendered
        requestAnimationFrame(() => {
            const nameInput = modal.querySelector('#project-name-input') as HTMLInputElement;
            if (nameInput) {
                nameInput.focus();
            }
        });

        const nameInput = modal.querySelector('#project-name-input') as HTMLInputElement;
        const descriptionInput = modal.querySelector(
            '#project-description-input'
        ) as HTMLTextAreaElement;
        const nameError = modal.querySelector('#project-name-error') as HTMLElement;
        const submitBtn = modal.querySelector('#create-project-submit') as HTMLButtonElement;
        const cancelBtn = modal.querySelector('#create-project-cancel') as HTMLButtonElement;
        const form = modal.querySelector('#create-project-form') as HTMLFormElement;

        let isValid = false;
        let nameFieldTouched = false; // Track if user has interacted with name field

        const validateForm = () => {
            const name = nameInput.value.trim();

            // Only show "required" error if field has been touched or is being submitted
            if (!name && nameFieldTouched) {
                nameError.innerHTML =
                    '<span class="material-symbols-outlined">error</span>Project name is required';
                nameInput.setAttribute('aria-invalid', 'true');
                submitBtn.disabled = true;
                isValid = false;
                return;
            }

            // Only check for duplicates if there's actually a name to check
            if (name) {
                // Check for duplicate names
                const projects = projectService.getAllProjects();
                if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                    nameError.innerHTML =
                        '<span class="material-symbols-outlined">error</span>A project with this name already exists';
                    nameInput.setAttribute('aria-invalid', 'true');
                    submitBtn.disabled = true;
                    isValid = false;
                    return;
                }
            }

            // Clear errors and enable submit if we have a valid name
            if (name) {
                nameError.innerHTML = '';
                nameInput.setAttribute('aria-invalid', 'false');
                submitBtn.disabled = false;
                isValid = true;
            } else {
                // No name but field not touched yet - just disable submit without showing error
                submitBtn.disabled = true;
                isValid = false;
            }
        };

        const cleanup = () => {
            document.body.removeChild(modal);
        };

        const handleSubmit = async (e: Event) => {
            e.preventDefault();

            // Force validation on submit attempt (mark as touched if not already)
            if (!nameFieldTouched) {
                nameFieldTouched = true;
                validateForm();
            }

            if (!isValid) {
                return;
            }

            try {
                await projectService.createProject({
                    name: nameInput.value.trim(),
                    description: descriptionInput.value.trim(),
                    isDefault: false,
                });

                cleanup();
                resolve(true);
            } catch (error) {
                nameError.innerHTML = `<span class="material-symbols-outlined">error</span>Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`;
                submitBtn.disabled = false;
            }
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        // Event listeners
        nameInput.addEventListener('input', () => {
            nameFieldTouched = true; // Mark field as touched when user types
            validateForm();
        });

        // Also mark as touched when user focuses and then leaves the field empty
        nameInput.addEventListener('blur', () => {
            if (nameInput.value.trim() === '') {
                nameFieldTouched = true;
                validateForm();
            }
        });

        form.addEventListener('submit', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);

        // Handle escape key and backdrop clicks
        modal.addEventListener('click', (e) => {
            if (
                e.target === modal ||
                (e.target as HTMLElement).classList.contains('modal-backdrop')
            ) {
                handleCancel();
            }
        });

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        });

        // Initial state: button disabled but no error shown
        submitBtn.disabled = true;
    });
}

/**
 * Show confirmation for deleting a project
 */
export function confirmDeleteProject(project: Project): Promise<boolean> {
    return showConfirmation({
        title: 'Delete project',
        message: `Are you sure you want to delete "${project.name}"?\n\nThis will permanently remove the project and all its associated data. This action cannot be undone.`,
        confirmText: 'Delete Project',
        cancelText: 'Cancel',
        icon: 'warning',
        danger: true,
    });
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Show a modal to edit an existing project
 */
export function showEditProjectModal(project: Project): Promise<boolean> {
    return new Promise((resolve) => {
        // Close any open dropdowns before showing modal
        const openDropdowns = document.querySelectorAll('.dropdown-menu');
        openDropdowns.forEach((menu) => {
            const menuElement = menu as HTMLElement;
            // Check if dropdown is actually visible
            if (menuElement.style.display === 'block' || menuElement.offsetParent !== null) {
                const dropdown = menu.closest('.project-dropdown');
                if (dropdown) {
                    const button = dropdown.querySelector('.project-dropdown-btn');
                    if (button) {
                        button.classList.remove('active');
                    }
                }
                menuElement.style.display = 'none';
            }
        });

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modal-edit-project';
        modal.setAttribute('aria-hidden', 'false');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'edit-project-title');

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog modal-fluid card" role="document">
                <div class="card-title">
                    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                    <h4 id="edit-project-title">Edit project</h4>
                </div>
                <form id="edit-project-form" class="card-content">
                    <div class="form-group">
                        <label for="edit-project-name-input" class="form-label">Project Name</label>
                        <input 
                            type="text" 
                            id="edit-project-name-input" 
                            class="form-input" 
                            placeholder="Enter project name"
                            value="${escapeHtml(project.name)}"
                            required
                            autofocus
                        />
                        <div id="edit-project-name-error" class="form-error" aria-live="polite"></div>
                    </div>
                    <div class="form-group">
                        <label for="edit-project-description-input" class="form-label">Description (optional)</label>
                        <textarea 
                            id="edit-project-description-input" 
                            class="form-input" 
                            placeholder="Brief description of the project"
                            rows="3"
                        >${escapeHtml(project.description || '')}</textarea>
                    </div>
                </form>
                <div class="modal-actions">
                    <button class="btn-outline" type="button" id="edit-project-cancel">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span>
                        Cancel
                    </button>
                    <button class="btn-primary" type="submit" form="edit-project-form" id="edit-project-submit">
                        <span class="material-symbols-outlined" aria-hidden="true">save</span>
                        Save changes
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus the name input after the modal is added to the DOM
        // Use requestAnimationFrame to ensure the modal is fully rendered
        requestAnimationFrame(() => {
            const nameInput = modal.querySelector('#edit-project-name-input') as HTMLInputElement;
            if (nameInput) {
                nameInput.focus();
                // Select all text for easy editing
                nameInput.select();
            }
        });

        const nameInput = modal.querySelector('#edit-project-name-input') as HTMLInputElement;
        const descriptionInput = modal.querySelector(
            '#edit-project-description-input'
        ) as HTMLTextAreaElement;
        const nameError = modal.querySelector('#edit-project-name-error') as HTMLElement;
        const submitBtn = modal.querySelector('#edit-project-submit') as HTMLButtonElement;
        const cancelBtn = modal.querySelector('#edit-project-cancel') as HTMLButtonElement;

        let touched = false;

        function cleanup(): void {
            document.body.removeChild(modal);
            modal.setAttribute('aria-hidden', 'true');
        }

        function validateForm(): boolean {
            const name = nameInput.value.trim();
            nameError.textContent = '';
            nameError.style.display = 'none';

            if (!name) {
                if (touched) {
                    nameError.textContent = 'Project name is required';
                    nameError.style.display = 'block';
                }
                return false;
            }

            return true;
        }

        // Validation on input
        nameInput.addEventListener('input', () => {
            touched = true;
            validateForm();
        });

        // Handle form submission
        const form = modal.querySelector('#edit-project-form') as HTMLFormElement;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            touched = true;

            if (!validateForm()) {
                return;
            }

            const name = nameInput.value.trim();
            const description = descriptionInput.value.trim();

            // Disable submit button to prevent double submission
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const updateParams: { name: string; description?: string } = { name };
                if (description) {
                    updateParams.description = description;
                }

                const result = await projectService.updateProject(project.id, updateParams);

                if (result.ok) {
                    cleanup();
                    resolve(true);
                } else {
                    nameError.textContent = `Failed to update project: ${result.error.message}`;
                    nameError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `
                        <span class="material-symbols-outlined" aria-hidden="true">save</span>
                        Save changes
                    `;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                nameError.textContent = `Failed to update project: ${errorMessage}`;
                nameError.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span class="material-symbols-outlined" aria-hidden="true">save</span>
                    Save changes
                `;
            }
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        // Handle backdrop click
        modal.addEventListener('click', (e) => {
            if (
                e.target === modal ||
                (e.target as HTMLElement).classList.contains('modal-backdrop')
            ) {
                cleanup();
                resolve(false);
            }
        });

        // Handle escape key
        const handleEscape = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}
