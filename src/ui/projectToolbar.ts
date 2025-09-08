/**
 * Project management toolbar component
 */

import { projectService } from '../services/projectService.js';
import type { Project } from '../types/project.js';

import { showConfirmation } from './confirmation.js';
import { showCreateProjectModal, showEditProjectModal } from './projectModal.js';

export class ProjectToolbar {
    private container: HTMLElement;
    private projectDropdown: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.projectDropdown = this.createProjectDropdown();

        this.setupEventListeners();
        this.render();
    }

    private createProjectDropdown(): HTMLElement {
        const dropdown = document.createElement('div');
        dropdown.className = 'project-dropdown';
        dropdown.innerHTML = `
            <button class="project-dropdown-btn" aria-label="Project menu">
                <span class="material-symbols-outlined">folder</span>
                <span class="project-name">Loading...</span>
                <span class="material-symbols-outlined chevron">expand_more</span>
            </button>
            <div class="dropdown-menu" style="display: none;"></div>
        `;

        // Add click handler for dropdown toggle
        const button = dropdown.querySelector('.project-dropdown-btn') as HTMLButtonElement;
        const menu = dropdown.querySelector('.dropdown-menu') as HTMLElement;

        button.addEventListener('click', () => {
            // Handle dropdown toggle
            const isVisible = menu.style.display !== 'none';
            if (isVisible) {
                menu.style.display = 'none';
                button.classList.remove('active');
            } else {
                menu.style.display = 'block';
                button.classList.add('active');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target as Node)) {
                menu.style.display = 'none';
                button.classList.remove('active');
            }
        });

        return dropdown;
    }

    private setupEventListeners(): void {
        // Listen for project changes
        projectService.on('projectSwitched', (context) => {
            this.updateCurrentProjectDisplay(context.currentProject);
            this.refreshProjectList(); // Update active classes in dropdown
        });

        projectService.on('projectCreated', (project) => {
            // Wait for project switch to complete before refreshing the list
            void (async () => {
                await projectService.switchToProject(project.id);
                this.refreshProjectList();
            })();
        });

        projectService.on('projectUpdated', (project) => {
            this.refreshProjectList();
            // Update display if it's the current project
            const current = projectService.getCurrentProject();
            if (current?.id === project.id) {
                this.updateCurrentProjectDisplay(project);
            }
        });

        projectService.on('projectDeleted', () => {
            this.refreshProjectList();
        });

        projectService.on('projectsLoaded', () => {
            this.refreshProjectList();
        });
    }

    private updateCurrentProjectDisplay(project: Project): void {
        const nameElement = this.projectDropdown.querySelector('.project-name');
        if (nameElement) {
            nameElement.textContent = project.name;
        }
    }

    private refreshProjectList(): void {
        const projects = projectService.getAllProjects();
        const currentProject = projectService.getCurrentProject();

        // Sort projects by creation date (newest first)
        const sortedProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt);

        // Update dropdown items
        const dropdownMenu = this.projectDropdown.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.innerHTML = '';

            // Create projects list container
            const projectsList = document.createElement('ul');
            projectsList.className = 'dropdown-options';

            // Add project list
            sortedProjects.forEach((project) => {
                const item = document.createElement('li');
                item.className = 'dropdown-option';
                if (project.id === currentProject?.id) {
                    item.classList.add('active');
                }

                item.innerHTML = `
                    <span class="project-name">${this.escapeHtml(project.name)}</span>
                    <div class="project-actions">
                        <span class="material-symbols-outlined edit-btn" title="Edit">edit</span>
                        <span class="material-symbols-outlined delete-btn" title="Delete">delete</span>
                    </div>
                `;

                // Add click handler for switching to the entire item (better UX)
                item.addEventListener('click', (e) => {
                    // Don't trigger if clicking on action buttons or their children
                    const target = e.target as HTMLElement;
                    if (
                        target.classList.contains('edit-btn') ||
                        target.classList.contains('delete-btn') ||
                        target.closest('.edit-btn') ||
                        target.closest('.delete-btn') ||
                        target.closest('.project-actions')
                    ) {
                        return;
                    }

                    e.stopPropagation();
                    if (project.id !== currentProject?.id) {
                        // Close dropdown when switching projects
                        const menu = this.projectDropdown.querySelector(
                            '.dropdown-menu'
                        ) as HTMLElement;
                        const button = this.projectDropdown.querySelector(
                            '.project-dropdown-btn'
                        ) as HTMLButtonElement;
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM queries can return null
                        if (menu && button) {
                            menu.style.display = 'none';
                            button.classList.remove('active');
                        }
                        void projectService.switchToProject(project.id);
                    }
                });

                // Add edit handler
                const editBtn = item.querySelector('.edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        void this.handleEditProject(project);
                    });
                }

                // Add delete handler
                const deleteBtn = item.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        void this.handleDeleteProject(project);
                    });
                }

                projectsList.appendChild(item);
            });

            // Add "New Project" option
            const newProjectItem = document.createElement('li');
            newProjectItem.className = 'dropdown-option';
            newProjectItem.innerHTML = `
                <span class="material-symbols-outlined">add</span>
                <span>New Project</span>
            `;
            newProjectItem.addEventListener('click', () => {
                void this.handleNewProject();
            });
            projectsList.appendChild(newProjectItem);

            dropdownMenu.appendChild(projectsList);
        }
    }

    private async handleDeleteProject(project: Project): Promise<void> {
        // Close the dropdown first
        const menu = this.projectDropdown.querySelector('.dropdown-menu') as HTMLElement;
        const button = this.projectDropdown.querySelector(
            '.project-dropdown-btn'
        ) as HTMLButtonElement;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM queries can return null
        if (menu && button) {
            menu.style.display = 'none';
            button.classList.remove('active');
        }

        const confirmed = await showConfirmation({
            title: 'Delete Project',
            message: `Are you sure you want to delete "${project.name}"?\n\nThis will permanently remove the project and all its associated data. This action cannot be undone.`,
            confirmText: 'Delete Project',
            cancelText: 'Cancel',
            icon: 'warning',
            danger: true,
        });

        if (confirmed) {
            try {
                await projectService.deleteProject(project.id);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to delete project: ${errorMessage}`);
            }
        }
    }

    private async handleEditProject(project: Project): Promise<void> {
        // Close the dropdown first
        const menu = this.projectDropdown.querySelector('.dropdown-menu') as HTMLElement;
        const button = this.projectDropdown.querySelector(
            '.project-dropdown-btn'
        ) as HTMLButtonElement;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM queries can return null
        if (menu && button) {
            menu.style.display = 'none';
            button.classList.remove('active');
        }

        // Use the custom modal component
        await showEditProjectModal(project);
    }

    private async handleNewProject(): Promise<void> {
        // Close the dropdown first
        const menu = this.projectDropdown.querySelector('.dropdown-menu') as HTMLElement;
        const button = this.projectDropdown.querySelector(
            '.project-dropdown-btn'
        ) as HTMLButtonElement;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM queries can return null
        if (menu && button) {
            menu.style.display = 'none';
            button.classList.remove('active');
        }

        // Use the custom modal component like other UI elements
        await showCreateProjectModal();
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private render(): void {
        this.container.innerHTML = '';
        // Preserve the existing wrapper class from HTML and add our toolbar class
        this.container.className = 'project-toolbar-wrapper';

        // Create toolbar layout
        const toolbar = document.createElement('div');
        toolbar.className = 'project-toolbar-content';

        // Add only the dropdown (which now includes project name and dropdown)
        toolbar.appendChild(this.projectDropdown);

        this.container.appendChild(toolbar);

        // Initialize display
        const currentProject = projectService.getCurrentProject();
        if (currentProject) {
            this.updateCurrentProjectDisplay(currentProject);
        }

        this.refreshProjectList();
    }

    async initialize(): Promise<void> {
        await projectService.initialize();
        const currentProject = projectService.getCurrentProject();
        if (currentProject) {
            this.updateCurrentProjectDisplay(currentProject);
        }
        this.refreshProjectList();
    }
}

/**
 * Initialize project toolbar in a container element
 */
export function initializeProjectToolbar(container: HTMLElement): ProjectToolbar {
    const toolbar = new ProjectToolbar(container);
    return toolbar;
}
