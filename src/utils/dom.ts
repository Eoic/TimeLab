// Focus the first focusable within a container
export function focusFirst(container: HTMLElement): void {
    const firstFocusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    setTimeout(() => firstFocusable?.focus(), 0);
}

export function openModal(modal: HTMLElement | null | undefined): void {
    if (!modal) {
        return;
    }

    modal.setAttribute('aria-hidden', 'false');
    focusFirst(modal);
}

export function closeModal(modal: HTMLElement | null | undefined): void {
    if (!modal) {
        return;
    }
    modal.setAttribute('aria-hidden', 'true');
}

// Simple focus trap + Escape close for a modal element
export function installModalFocusTrap(
    modal: HTMLElement,
    onEscape: () => void
): (event: KeyboardEvent) => void {
    const handler = (event: KeyboardEvent) => {
        if (modal.getAttribute('aria-hidden') === 'true') {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            onEscape();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const focusables = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const tabbables = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'));
        if (tabbables.length === 0) {
            return;
        }
        const first = tabbables[0];
        const last = tabbables[tabbables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!first || !last) {
            return;
        }
        if (event.shiftKey) {
            if (active === first || !modal.contains(active)) {
                event.preventDefault();
                last.focus();
            }
        } else if (active === last) {
            event.preventDefault();
            first.focus();
        }
    };
    document.addEventListener('keydown', handler);
    return handler;
}
