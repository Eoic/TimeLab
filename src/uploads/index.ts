import { closeModal, openModal } from '@/utils/dom';
import { idbDelete, idbGetAll, idbPut } from '@/utils/idb';
import { formatBytes, uuid } from '@/utils/misc';

export type TDataFile = {
    id: string;
    name: string;
    size: number;
    type: string;
    addedAt: number;
    visible: boolean;
    text?: string;
};

export function setupUploads(): void {
    const uploadDataButton = document.getElementById('btn-upload-data') as HTMLButtonElement | null;
    const manageDataButton = document.getElementById('btn-manage-data') as HTMLButtonElement | null;
    const uploadModal = document.getElementById('modal-data-upload');
    const uploadDropzone = document.getElementById('upload-dropzone');
    const uploadInput = document.getElementById('upload-input') as HTMLInputElement | null;
    const uploadSelectButton = document.getElementById('upload-select') as HTMLButtonElement | null;
    const manageModal = document.getElementById('modal-data-manage');
    const filesList = document.getElementById('data-files-list');
    const uploadsList = document.getElementById('uploads-list');
    const uploadsSection = document.getElementById('uploads-section');
    const clearUploadsButton = document.getElementById('uploads-clear') as HTMLButtonElement | null;

    const dataFiles: TDataFile[] = [];
    (window as unknown as { __dataFiles?: TDataFile[] }).__dataFiles = dataFiles;

    const notifyChange = () => {
        window.dispatchEvent(
            new CustomEvent<{ files: TDataFile[] }>('timelab:dataFilesChanged', {
                detail: { files: dataFiles.slice() },
            })
        );
    };

    type UploadItemUI = { state: { cancelled: boolean }; detach: () => void } & {
        row: HTMLDivElement;
        bar: HTMLDivElement;
        status: HTMLDivElement;
    };
    const activeUploads = new Set<UploadItemUI>();

    const readSlice = (blob: Blob): Promise<ArrayBuffer> =>
        new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                resolve(fr.result as ArrayBuffer);
            };
            fr.onerror = () => {
                reject(fr.error ?? new Error('Failed to read file'));
            };
            fr.readAsArrayBuffer(blob);
        });

    const processFile = async (
        file: File,
        progressCb: (percent: number, status: string) => void,
        shouldCancel?: () => boolean
    ): Promise<string> => {
        const chunkSize = 1024 * 512; // 512KB
        const decoder = new TextDecoder();
        const parts: string[] = [];
        let offset = 0;
        let chunkIdx = 0;
        while (offset < file.size) {
            if (shouldCancel && shouldCancel()) {
                throw new Error('UPLOAD_CANCELLED');
            }
            const end = Math.min(offset + chunkSize, file.size);
            const buf = await readSlice(file.slice(offset, end));
            const isLast = end >= file.size;
            const textPart = decoder.decode(buf, { stream: !isLast });
            if (textPart) {
                parts.push(textPart);
            }
            offset = end;
            const percent = file.size === 0 ? 100 : Math.floor((offset / file.size) * 100);
            progressCb(percent, percent >= 100 ? 'Finalizing…' : 'Reading…');
            chunkIdx += 1;
            if (chunkIdx % 4 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        const flush = decoder.decode();
        if (flush) {
            parts.push(flush);
        }
        return parts.join('');
    };

    const addUploadRow = (file: File) => {
        if (!uploadsList) {
            return null;
        }
        if (uploadsSection) {
            uploadsSection.style.display = '';
            uploadsSection.setAttribute('aria-hidden', 'false');
        }

        const row = document.createElement('div');
        row.className = 'upload-item';
        row.setAttribute('role', 'listitem');

        const meta = document.createElement('div');
        meta.className = 'meta';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = file.name;
        const size = document.createElement('div');
        size.className = 'size text-sm';
        size.textContent = formatBytes(file.size);

        const progress = document.createElement('div');
        progress.className = 'progress';
        const bar = document.createElement('div');
        bar.className = 'bar';
        progress.appendChild(bar);

        meta.appendChild(name);
        meta.appendChild(size);
        meta.appendChild(progress);

        const status = document.createElement('div');
        status.className = 'status text-sm';
        status.innerHTML =
            '<span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span>Queued';

        const actions = document.createElement('div');
        actions.className = 'actions';
        const remove = document.createElement('button');
        remove.className = 'btn-ghost';
        remove.title = 'Remove from selection';
        remove.setAttribute('aria-label', 'Remove from selection');
        remove.innerHTML =
            '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
        actions.appendChild(remove);

        row.appendChild(meta);
        row.appendChild(status);
        row.appendChild(actions);
        uploadsList.appendChild(row);

        const state = { cancelled: false };
        const detach = () => {
            row.remove();
            if (uploadsList.children.length === 0 && uploadsSection) {
                uploadsSection.style.display = 'none';
                uploadsSection.setAttribute('aria-hidden', 'true');
            }
        };
        remove.addEventListener('click', () => {
            state.cancelled = true;
            detach();
        });
        const uploadUI = { row, bar, status, detach, state } as UploadItemUI;
        activeUploads.add(uploadUI);
        const originalDetach = uploadUI.detach;
        (uploadUI as unknown as { detach: () => void }).detach = () => {
            originalDetach();
            activeUploads.delete(uploadUI as unknown as UploadItemUI);
        };
        return uploadUI;
    };

    const renderFilesList = () => {
        if (!filesList) {
            return;
        }
        filesList.textContent = '';
        if (dataFiles.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No files uploaded yet.';
            filesList.appendChild(empty);
            return;
        }
        for (const file of dataFiles) {
            const row = document.createElement('div');
            row.className = 'file-item';
            row.setAttribute('role', 'listitem');

            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = file.name;

            const size = document.createElement('div');
            size.className = 'size text-sm';
            size.textContent = formatBytes(file.size);

            const vis = document.createElement('button');
            vis.className = 'btn-neutral';
            vis.setAttribute('aria-pressed', String(file.visible));
            vis.title = file.visible ? 'Hide from labeling' : 'Include in labeling';
            vis.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${file.visible ? 'visibility' : 'visibility_off'}</span>${file.visible ? 'Visible' : 'Hidden'}`;
            vis.addEventListener('click', () => {
                file.visible = !file.visible;
                void (async () => {
                    try {
                        await idbPut(file);
                    } catch {
                        // ignore persistence errors for UI responsiveness
                    }
                    renderFilesList();
                    notifyChange();
                })();
            });

            const del = document.createElement('button');
            del.className = 'btn-outline';
            del.title = 'Delete file';
            del.innerHTML =
                '<span class="material-symbols-outlined" aria-hidden="true">delete</span>Delete';
            del.addEventListener('click', () => {
                const idx = dataFiles.findIndex((x) => x.id === file.id);
                if (idx >= 0) {
                    dataFiles.splice(idx, 1);
                    void (async () => {
                        try {
                            await idbDelete(file.id);
                        } catch {
                            // ignore persistence errors
                        }
                        renderFilesList();
                        notifyChange();
                    })();
                }
            });

            row.appendChild(name);
            row.appendChild(size);
            row.appendChild(vis);
            row.appendChild(del);
            filesList.appendChild(row);
        }
    };

    const handleUploads = async (files: FileList | File[]) => {
        const list = Array.from(files);
        for (const file of list) {
            const uploadUI = addUploadRow(file);
            if (!uploadUI) {
                continue;
            }
            try {
                uploadUI.status.innerHTML =
                    '<span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>Reading…';
                const text = await processFile(
                    file,
                    (percent, status) => {
                        uploadUI.bar.style.width = String(percent) + '%';
                        uploadUI.status.innerHTML =
                            '<span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>' +
                            status +
                            ' ' +
                            String(percent) +
                            '%';
                    },
                    () => uploadUI.state.cancelled
                );
                const record: TDataFile = {
                    id: uuid(),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'text/csv',
                    addedAt: Date.now(),
                    visible: true,
                    text,
                };
                dataFiles.push(record);
                try {
                    await idbPut(record);
                } catch {
                    // ignore persistence errors and continue
                }
                uploadUI.bar.style.width = '100%';
                uploadUI.row.classList.add('done');
                uploadUI.status.innerHTML =
                    '<span class="material-symbols-outlined" aria-hidden="true">check_circle</span>Ready';
                notifyChange();
            } catch (_err) {
                if (!uploadUI.state.cancelled) {
                    uploadUI.row.classList.add('error');
                    uploadUI.status.innerHTML =
                        '<span class="material-symbols-outlined" aria-hidden="true">error</span>Error';
                }
            }
        }
        if (manageModal && manageModal.getAttribute('aria-hidden') !== 'true') {
            renderFilesList();
        }
    };

    const bindDropzone = () => {
        if (!uploadDropzone) {
            return;
        }
        const prevent = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
        };
        ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(
            (eventName) => {
                uploadDropzone.addEventListener(eventName, prevent as EventListener);
            }
        );
        uploadDropzone.addEventListener('dragover', () => {
            uploadDropzone.classList.add('drag-over');
        });
        uploadDropzone.addEventListener('dragenter', () => {
            uploadDropzone.classList.add('drag-over');
        });
        uploadDropzone.addEventListener('dragleave', () => {
            uploadDropzone.classList.remove('drag-over');
        });
        uploadDropzone.addEventListener('dragend', () => {
            uploadDropzone.classList.remove('drag-over');
        });
        uploadDropzone.addEventListener('drop', (event: DragEvent) => {
            uploadDropzone.classList.remove('drag-over');
            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) {
                return;
            }
            const files = dataTransfer.files;
            if (files.length > 0) {
                void handleUploads(files);
            }
        });
        uploadDropzone.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                uploadInput?.click();
            }
        });
    };

    // Wire buttons to open modals
    uploadDataButton?.addEventListener('click', () => {
        openModal(uploadModal as HTMLElement);
    });
    manageDataButton?.addEventListener('click', () => {
        renderFilesList();
        openModal(manageModal as HTMLElement);
    });
    uploadSelectButton?.addEventListener('click', () => {
        uploadInput?.click();
    });
    uploadInput?.addEventListener('change', () => {
        if (uploadInput.files && uploadInput.files.length) {
            void handleUploads(uploadInput.files);
            uploadInput.value = '';
        }
    });
    bindDropzone();

    // Load previously stored files from IndexedDB
    void (async () => {
        try {
            const stored = await idbGetAll<TDataFile>();
            if (Array.isArray(stored) && stored.length > 0) {
                dataFiles.push(...stored);
                renderFilesList();
                notifyChange();
            }
        } catch {
            // ignore load failures gracefully
        }
    })();

    // Clear-all for current session selection
    clearUploadsButton?.addEventListener('click', () => {
        activeUploads.forEach((uploadUI) => {
            uploadUI.state.cancelled = true;
            uploadUI.detach();
        });
        activeUploads.clear();
    });

    // Close upload/manage on backdrop or close buttons
    uploadModal?.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }
        if (target.hasAttribute('data-close') || target === uploadModal) {
            closeModal(uploadModal);
            if (uploadsList) {
                uploadsList.textContent = '';
            }
            if (uploadsSection) {
                uploadsSection.style.display = 'none';
                uploadsSection.setAttribute('aria-hidden', 'true');
            }
            activeUploads.forEach((uploadUI) => {
                uploadUI.state.cancelled = true;
            });
            activeUploads.clear();
        }
    });
    manageModal?.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }
        if (target.hasAttribute('data-close') || target === manageModal) {
            closeModal(manageModal);
        }
    });
}
