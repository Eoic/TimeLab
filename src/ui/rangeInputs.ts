export function setupRangeProgress(): void {
    const rangeInputs = document.querySelectorAll<HTMLInputElement>('input[type="range"]');
    const applyProgress = (input: HTMLInputElement) => {
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const value = Number(input.value || 0);
        const percent = max > min ? ((value - min) * 100) / (max - min) : 0;
        const clamped = Math.max(0, Math.min(100, percent));
        input.style.setProperty('--range-pct', String(clamped) + '%');
    };
    rangeInputs.forEach((input) => {
        applyProgress(input);
        input.addEventListener('input', () => {
            applyProgress(input);
        });
        input.addEventListener('change', () => {
            applyProgress(input);
        });
    });
}
