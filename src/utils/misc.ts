// Shared small utilities
export const uuid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
        return String(bytes) + ' B';
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};
