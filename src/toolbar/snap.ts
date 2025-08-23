export function setupSnapSettingsDropdown(): void {
    const trigger = document.querySelector<HTMLButtonElement>(
        ".tools [aria-label='Snap settings']"
    );
    if (!trigger) {
        return;
    }

    const dd = document.createElement('tl-dropdown');
    dd.setAttribute('multiple', '');
    dd.setAttribute('placeholder', 'Snap options');
    dd.style.position = 'absolute';
    dd.style.left = '-9999px';
    dd.style.top = '0';
    dd.options = [
        { value: 'label-boundary', label: 'Snap to label' },
        { value: 'zero-crossings', label: 'Snap to zero crossings' },
    ];
    document.body.appendChild(dd);

    let selections: string[] = [];
    dd.addEventListener('change', (ev) => {
        const detail = (ev as CustomEvent<{ value: string[] }>).detail;
        selections = Array.isArray(detail.value) ? detail.value : selections;
    });

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        if (dd.hasAttribute('multiple')) {
            dd.values = selections;
        }
        dd.open(trigger);
    });
}
