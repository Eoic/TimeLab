class CheckboxEnterToggleManager {
    private _onKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
            return;
        }

        const target = event.target as HTMLElement | null;

        if (!target) {
            return;
        }

        const tagName = target.tagName;
        const isTextInput =
            tagName === 'TEXTAREA' ||
            (tagName === 'INPUT' &&
                !['checkbox', 'radio', 'button', 'submit', 'range'].includes(
                    (target as HTMLInputElement).type
                ));

        if (isTextInput || target.isContentEditable) {
            return;
        }

        if (target instanceof HTMLInputElement && target.type === 'checkbox' && !target.disabled) {
            event.preventDefault();
            target.checked = !target.checked;
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    public enable(): void {
        document.addEventListener('keydown', this._onKeydown);
    }

    public disable(): void {
        document.removeEventListener('keydown', this._onKeydown);
    }
}

export function setupCheckboxEnterToggle(): void {
    new CheckboxEnterToggleManager().enable();
}
