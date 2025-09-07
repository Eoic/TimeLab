type Option = { value: string; label: string; color?: string };

export class TLDropdown extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['placeholder', 'search', 'multiple'];
    }

    private _options: Option[] = [];
    private _value: string | null = null;
    private _values: Set<string> = new Set();
    private overlayEl: HTMLDivElement | null = null;
    private menuEl: HTMLDivElement | null = null;
    private onRepositionBound: (() => void) | null = null;
    private _anchorEl: HTMLElement | null = null;
    private _activeExternalAnchor: HTMLElement | null = null;

    // Bound handlers
    private onKeydown = (e: KeyboardEvent): void => {
        // Check if dropdown is disabled
        if (this.classList.contains('dropdown-disabled')) {
            return;
        }

        const expanded = this.getAttribute('aria-expanded') === 'true';
        if (e.key === 'Escape') {
            this.setExpanded(false);
            return;
        }
        if (!expanded && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            this.setExpanded(true);
            return;
        }
        if (expanded) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.moveActive(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.moveActive(-1);
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.setActive(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                const options = this.getOptionEls();
                this.setActive(options.length - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const active = this.querySelector<HTMLLIElement>('.dropdown-option.active');
                if (active) {
                    const val = active.getAttribute('data-value') ?? '';
                    if (val) {
                        this.select(val);
                    }
                }
            }
        }
    };

    connectedCallback(): void {
        this.render();
        this.addEventListener('keydown', this.onKeydown);
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.onKeydown);
        this.destroyOverlay();
    }

    attributeChangedCallback(name: string, _old: string | null, _new: string | null): void {
        if (name === 'multiple') {
            if (this.isMultiple) {
                // Moving to multiple: seed the set with single value if present
                if (this._value) {
                    this._values = new Set([this._value]);
                }
            } else {
                // Moving to single: collapse set into a single value
                const first = Array.from(this._values)[0];
                this._value = first !== undefined ? first : null;
                this._values.clear();
            }
        }
        this.render();
    }

    public setExpanded(expanded: boolean): void {
        this.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        const wrap = this.querySelector<HTMLDivElement>('.dropdown');
        if (wrap) {
            wrap.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
        if (expanded) {
            this.createOverlay();
            this.portalMenu();
            // If opened against an external anchor (e.g., toolbar button), mark it active
            const anchor = this._anchorEl;
            if (anchor && anchor.closest('tl-dropdown') !== this) {
                anchor.classList.add('active');
                anchor.setAttribute('aria-pressed', 'true');
                this._activeExternalAnchor = anchor;
            }
        } else {
            this.unportalMenu();
            this.destroyOverlay();
            // Remove active marker from external anchor if previously set
            if (this._activeExternalAnchor) {
                this._activeExternalAnchor.classList.remove('active');
                this._activeExternalAnchor.setAttribute('aria-pressed', 'false');
                this._activeExternalAnchor = null;
            }
            this._anchorEl = null;
        }
    }

    set options(v: Option[]) {
        this._options = Array.isArray(v) ? v : [];
        this.render();
    }

    get options(): Option[] {
        return this._options;
    }

    set value(v: string | null) {
        if (this.isMultiple) {
            this._values.clear();
            if (typeof v === 'string' && v) {
                this._values.add(v);
            }
            this.updateButtonLabel();
            this.updateOptionsSelectionUI();
        } else {
            this._value = v;
            this.render();
        }
    }

    get value(): string | null {
        if (this.isMultiple) {
            const first = Array.from(this._values)[0];
            return first !== undefined ? first : null;
        }
        return this._value;
    }

    set values(arr: string[]) {
        if (this.isMultiple) {
            this._values = new Set(Array.isArray(arr) ? arr : []);
            this.updateButtonLabel();
            this.updateOptionsSelectionUI();
        }
    }

    get values(): string[] {
        return Array.from(this._values);
    }

    private get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Select…';
    }

    private get enableSearch(): boolean {
        return this.hasAttribute('search');
    }

    private get isMultiple(): boolean {
        return this.hasAttribute('multiple');
    }

    private toggle(): void {
        // Check if dropdown is disabled
        if (this.classList.contains('dropdown-disabled')) {
            return;
        }

        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setExpanded(!expanded);
        if (!expanded && this.enableSearch) {
            const input = this.querySelector<HTMLInputElement>('.dropdown-search input');
            if (input) {
                input.focus();
            }
        }
    }

    private select(value: string): void {
        if (this.isMultiple) {
            if (this._values.has(value)) {
                this._values.delete(value);
            } else {
                this._values.add(value);
            }
            this.dispatchEvent(
                new CustomEvent('change', { detail: { value: Array.from(this._values) } })
            );
            // Keep menu open for multi-select
            this.updateButtonLabel();
            this.updateOptionsSelectionUI();
        } else {
            this._value = value;
            this.dispatchEvent(new CustomEvent('change', { detail: { value } }));
            this.setExpanded(false);
            this.render();
        }
    }

    private filterOptions(query: string): Option[] {
        const q = query.trim().toLowerCase();
        if (!q) {
            return this._options;
        }
        return this._options.filter(
            (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
        );
    }

    private render(): void {
        const selected = this.isMultiple
            ? this._options.filter((o) => this._values.has(o.value))
            : (this._options.find((o) => o.value === this._value) ?? null);
        const expanded = this.getAttribute('aria-expanded') === 'true';
        const search = this.enableSearch;

        this.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'dropdown';
        wrap.setAttribute('aria-expanded', String(expanded));
        if (this.isMultiple) {
            wrap.classList.add('multi');
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dropdown-toggle';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', String(expanded));
        btn.addEventListener('click', () => {
            this.toggle();
        });

        const label = document.createElement('span');
        label.className = 'label';
        if (this.isMultiple) {
            const sel = Array.isArray(selected) ? selected : [];
            if (sel.length === 0) {
                label.textContent = this.placeholder;
                label.classList.add('placeholder');
            } else if (sel.length === 1) {
                const a = sel[0];
                label.textContent = a ? a.label : this.placeholder;
            } else if (sel.length === 2) {
                const a = sel[0];
                const b = sel[1];
                label.textContent = (a ? a.label : '') + ', ' + (b ? b.label : '');
            } else {
                const rest = sel.length - 2;
                const a = sel[0];
                const b = sel[1];
                label.textContent =
                    (a ? a.label : '') + ', ' + (b ? b.label : '') + ', +' + String(rest);
            }
        } else {
            const one = selected as Option | null;
            label.textContent = one ? one.label : this.placeholder;
            if (!one) {
                label.classList.add('placeholder');
            }
        }
        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            label.classList.add('placeholder');
        }

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined chevron';
        icon.textContent = 'expand_more';

        btn.append(label, icon);

        // Add color dot for single selection if color is available (after elements are appended)
        if (!this.isMultiple && selected && !Array.isArray(selected) && selected.color) {
            const colorDot = document.createElement('span');
            colorDot.className = 'color-dot';
            colorDot.style.setProperty('--dot-color', selected.color);
            colorDot.setAttribute('aria-hidden', 'true');
            btn.insertBefore(colorDot, label);
        }

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.setAttribute('role', 'listbox');
        if (this.isMultiple) {
            menu.setAttribute('aria-multiselectable', 'true');
        } else {
            menu.removeAttribute('aria-multiselectable');
        }
        this.menuEl = menu;

        if (search) {
            const s = document.createElement('div');
            s.className = 'dropdown-search';
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Search…';
            input.addEventListener('input', () => {
                this.populateOptions(list, input.value);
            });
            s.appendChild(input);
            menu.appendChild(s);
        }

        const list = document.createElement('ul');
        list.className = 'dropdown-options';
        this.populateOptions(list, '');
        menu.appendChild(list);

        wrap.append(btn, menu);
        this.appendChild(wrap);

        // Initialize active option (for keyboard nav)
        const opts = this.getOptionEls();
        if (opts.length) {
            const idx = this._value
                ? Math.max(
                      0,
                      opts.findIndex((li) => li.getAttribute('data-value') === this._value)
                  )
                : 0;
            this.setActive(idx);
        }
    }

    private portalMenu(): void {
        const menu = this.menuEl ?? this.querySelector<HTMLDivElement>('.dropdown-menu');
        const btn = this.querySelector<HTMLButtonElement>('.dropdown-toggle');
        if (!menu || !btn) {
            return;
        }

        // Move menu to body for overlay positioning
        if (!document.body.contains(menu)) {
            document.body.appendChild(menu);
        }
        menu.classList.add('dropdown-menu--portaled');
        menu.style.position = 'fixed';
        menu.style.display = 'block';
        menu.style.visibility = 'visible'; // Ensure dropdown is visible
        menu.style.zIndex = '1001'; // above overlay
        this.repositionMenu();

        // Bind listeners
        const onReposition = () => {
            this.repositionMenu();
        };
        this.onRepositionBound = onReposition;
        window.addEventListener('resize', onReposition, { passive: true });
        // Capture scroll anywhere in the doc
        window.addEventListener('scroll', onReposition, {
            passive: true,
            capture: true,
        } as AddEventListenerOptions);
    }

    private unportalMenu(): void {
        const menu = this.menuEl ?? this.querySelector<HTMLDivElement>('.dropdown-menu');
        if (!menu) {
            return;
        }

        // Unbind listeners
        if (this.onRepositionBound) {
            window.removeEventListener('resize', this.onRepositionBound as EventListener);
            window.removeEventListener('scroll', this.onRepositionBound as EventListener, true);
            this.onRepositionBound = null;
        }

        // Return menu back to component DOM
        const container = this.querySelector('.dropdown');
        if (container) {
            container.appendChild(menu);
        }
        menu.classList.remove('dropdown-menu--portaled');
        menu.removeAttribute('style');
    }

    private repositionMenu(): void {
        const menu = this.menuEl ?? this.querySelector<HTMLDivElement>('.dropdown-menu');
        const btn = this.querySelector<HTMLButtonElement>('.dropdown-toggle');
        const anchor = this._anchorEl ?? btn;
        if (!menu || !anchor) {
            return;
        }

        const rect = anchor.getBoundingClientRect();

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const margin = 8; // viewport margin

        // Check if this is a theme dropdown for custom spacing
        const isThemeDropdown = this.classList.contains('theme-dropdown');

        // Check if anchor is an icon button (typically square/small buttons)
        const isIconButton = anchor.classList.contains('btn-icon') || anchor.offsetWidth <= 48;

        const gap = isThemeDropdown ? 8 : 4; // $spacing-sm (16px) for theme, default 4px for others
        const rightOffset = isThemeDropdown ? 0 : 0; // $spacing-lg (32px) from right for theme dropdown

        // Width: at least a comfortable min, not smaller than anchor; clamp to viewport
        const searchElForWidth = menu.querySelector<HTMLElement>('.dropdown-search');
        // Use a more reasonable minimum width that doesn't force dropdowns to be too wide
        const baseMinWidth = searchElForWidth ? 200 : 160;

        // Special handling for theme dropdown which needs extra width for theme names
        const themeMinWidth = isThemeDropdown ? 180 : baseMinWidth;

        // Prefer the button width, but ensure a reasonable minimum for usability
        // For theme dropdowns, always use the theme minimum since the button is just an icon
        const minWidth = isThemeDropdown ? themeMinWidth : Math.max(rect.width, baseMinWidth);
        const width = Math.min(minWidth, viewportW - margin * 2);

        // Smart horizontal positioning: try to align with button edges before shifting
        let left = rect.left; // Default: align with left edge of button

        // For icon buttons, try to center the dropdown over the button first
        if (isIconButton && !isThemeDropdown) {
            const centerLeft = rect.left + (rect.width - width) / 2;
            if (centerLeft >= margin && centerLeft + width <= viewportW - margin) {
                // Centering fits, use it
                left = centerLeft;
            } else {
                // Centering doesn't fit, fall back to edge alignment logic
                const leftAlignedRight = rect.left + width;
                const rightAlignedLeft = rect.right - width;

                if (leftAlignedRight > viewportW - margin) {
                    // Left alignment doesn't fit, try right alignment
                    if (rightAlignedLeft >= margin) {
                        // Right alignment fits, use it
                        left = rightAlignedLeft;
                    } else {
                        // Neither alignment fits perfectly, choose the better option
                        const leftOverflow = leftAlignedRight - (viewportW - margin);
                        const rightOverflow = margin - rightAlignedLeft;

                        if (rightOverflow < leftOverflow) {
                            // Right alignment has less overflow
                            left = Math.max(margin, rightAlignedLeft);
                        } else {
                            // Left alignment has less overflow
                            left = Math.min(rect.left, viewportW - width - margin);
                        }
                    }
                }
            }
        } else {
            // Regular button positioning: try left/right edge alignment
            const leftAlignedRight = left + width;
            const rightAlignedLeft = rect.right - width;

            if (leftAlignedRight > viewportW - margin) {
                // Left alignment doesn't fit, try right alignment
                if (rightAlignedLeft >= margin) {
                    // Right alignment fits, use it
                    left = rightAlignedLeft;
                } else {
                    // Neither alignment fits perfectly, choose the better option
                    const leftOverflow = leftAlignedRight - (viewportW - margin);
                    const rightOverflow = margin - rightAlignedLeft;

                    if (rightOverflow < leftOverflow) {
                        // Right alignment has less overflow
                        left = Math.max(margin, rightAlignedLeft);
                    } else {
                        // Left alignment has less overflow
                        left = Math.min(rect.left, viewportW - width - margin);
                    }
                }
            }
        }

        // Final bounds check
        left = Math.max(margin, Math.min(left, viewportW - width - margin));

        // Special handling for theme dropdown positioning
        if (isThemeDropdown) {
            // Position dropdown with right offset for theme dropdown
            left = Math.min(rect.right - width - rightOffset, viewportW - width - margin);
            left = Math.max(left, margin); // Ensure it doesn't go off-screen
        }

        // Determine placement
        const belowSpace = viewportH - rect.bottom - margin;
        const aboveSpace = rect.top - margin;

        // Calculate desired menu height so that the list content can be ~200px even with search present
        const cs = window.getComputedStyle(menu);
        const padTop = parseFloat(cs.paddingTop) || 0;
        const padBottom = parseFloat(cs.paddingBottom) || 0;
        const searchEl = menu.querySelector<HTMLElement>('.dropdown-search');
        const searchBlock = searchEl ? searchEl.getBoundingClientRect().height : 0;
        const baseListDesired = 200; // desired list viewport
        const desiredMenu = baseListDesired + padTop + padBottom + searchBlock;

        const placeBelow = belowSpace >= Math.min(desiredMenu, aboveSpace) || belowSpace >= 140;
        const maxHeight = Math.max(
            100,
            Math.min(desiredMenu, placeBelow ? belowSpace : aboveSpace)
        );

        // Compute top
        let top = placeBelow ? rect.bottom + gap : rect.top - gap;
        if (!placeBelow) {
            // position from bottom by subtracting height later using translateY
            // Instead, shift top upwards by maxHeight
            top = Math.max(margin, rect.top - maxHeight - gap);
        }

        // Force positioning with maximum specificity
        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('left', `${String(Math.floor(left))}px`, 'important');
        menu.style.setProperty('top', `${String(Math.floor(top))}px`, 'important');
        menu.style.setProperty('width', `${String(Math.floor(width))}px`, 'important');
        menu.style.setProperty('max-height', `${String(Math.floor(maxHeight))}px`, 'important');

        // Only override the specific conflicting properties
        menu.style.setProperty('right', 'auto', 'important');
        menu.style.setProperty('bottom', 'auto', 'important');

        // Add portal class to override CSS positioning constraints
        menu.classList.add('dropdown-menu--portaled');

        // Adjust internal list height to match available space inside menu
        const list = menu.querySelector<HTMLUListElement>('.dropdown-options');
        if (list) {
            const available = Math.max(0, Math.floor(maxHeight - padTop - padBottom - searchBlock));
            list.style.maxHeight = `${String(available)}px`;
            list.style.overflow = 'auto';
        }
    }

    /** Programmatically open the dropdown, optionally anchored to a specific element. */
    public open(anchor?: HTMLElement): void {
        if (anchor) {
            this._anchorEl = anchor;
        }
        this.setExpanded(true);

        // Ensure dropdown receives focus for keyboard navigation when opened externally
        if (this._anchorEl && this._anchorEl.closest('tl-dropdown') !== this) {
            // Focus the dropdown toggle for keyboard navigation
            const toggleBtn = this.querySelector<HTMLButtonElement>('.dropdown-toggle');
            if (toggleBtn) {
                // Use setTimeout to ensure the dropdown is fully rendered and positioned
                setTimeout(() => {
                    toggleBtn.focus();
                }, 0);
            }
        }
    }

    /** Programmatically close the dropdown. */
    public close(): void {
        this.setExpanded(false);
    }

    private populateOptions(list: HTMLUListElement, query: string): void {
        list.innerHTML = '';
        const items = this.filterOptions(query);
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'dropdown-empty';
            empty.textContent = 'No results';
            list.appendChild(empty);
            return;
        }
        for (const o of items) {
            const li = document.createElement('li');
            li.className = 'dropdown-option';
            li.setAttribute('role', 'option');
            li.setAttribute('data-value', o.value);
            const isSel = this.isMultiple ? this._values.has(o.value) : o.value === this._value;
            li.setAttribute('aria-selected', String(isSel));
            // Click anywhere on the option toggles selection (checkbox sync handled elsewhere)
            li.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.select(o.value);
            });

            const check = document.createElement('span');
            check.className = 'material-symbols-outlined check';
            check.textContent = 'check';

            // For multi-select, include a real checkbox for clarity
            let checkbox: HTMLInputElement | null = null;
            if (this.isMultiple) {
                checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isSel;
                checkbox.tabIndex = -1; // avoid double focus
                checkbox.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.select(o.value);
                });
            }

            // Only add swatch when a color/graphic is provided
            let swatch: HTMLSpanElement | null = null;
            if (o.color) {
                swatch = document.createElement('span');
                swatch.className = 'swatch';
                swatch.style.backgroundColor = o.color;
                swatch.setAttribute('aria-hidden', 'true');
            }

            const text = document.createElement('span');
            text.textContent = o.label;

            if (swatch && checkbox) {
                li.append(checkbox, swatch, text);
            } else if (swatch) {
                li.append(check, swatch, text);
            } else if (checkbox) {
                li.append(checkbox, text);
            } else {
                li.append(check, text);
            }
            list.appendChild(li);
        }
    }

    private getOptionEls(): HTMLLIElement[] {
        const root: ParentNode = this.menuEl ?? this;
        return Array.from(
            root.querySelectorAll<HTMLLIElement>('.dropdown-options .dropdown-option')
        );
    }

    private setActive(index: number): void {
        const els = this.getOptionEls();
        if (!els.length) {
            return;
        }
        const clamped = Math.max(0, Math.min(index, els.length - 1));
        els.forEach((el, i) => {
            // In multi-select we don't visually mark active; still scroll for keyboard nav
            if (i === clamped) {
                if (!this.isMultiple) {
                    el.classList.add('active');
                }
                el.scrollIntoView({ block: 'nearest' });
            } else if (!this.isMultiple) {
                el.classList.remove('active');
            }
        });
    }

    private moveActive(delta: number): void {
        const els = this.getOptionEls();
        if (!els.length) {
            return;
        }
        const current = els.findIndex((el) => el.classList.contains('active'));
        const next = current < 0 ? 0 : current + delta;
        this.setActive(next);
    }

    private createOverlay(): void {
        if (this.overlayEl) {
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'tl-dropdown-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'transparent';
        overlay.style.zIndex = '999';
        overlay.addEventListener('click', () => {
            this.setExpanded(false);
        });
        document.body.appendChild(overlay);
        this.overlayEl = overlay;
    }

    private destroyOverlay(): void {
        if (this.overlayEl && this.overlayEl.parentNode) {
            this.overlayEl.parentNode.removeChild(this.overlayEl);
        }
        this.overlayEl = null;
    }

    private updateButtonLabel(): void {
        const btn = this.querySelector<HTMLButtonElement>('.dropdown-toggle');
        const labelEl = btn?.querySelector<HTMLSpanElement>('.label');
        if (!labelEl) {
            return;
        }
        if (this.isMultiple) {
            const selected = this._options.filter((o) => this._values.has(o.value));
            if (selected.length === 0) {
                labelEl.textContent = this.placeholder;
                labelEl.classList.add('placeholder');
            } else if (selected.length === 1) {
                const a = selected[0];
                labelEl.textContent = a ? a.label : this.placeholder;
                labelEl.classList.remove('placeholder');
            } else if (selected.length === 2) {
                const a = selected[0];
                const b = selected[1];
                labelEl.textContent = (a ? a.label : '') + ', ' + (b ? b.label : '');
                labelEl.classList.remove('placeholder');
            } else {
                const rest = selected.length - 2;
                const a = selected[0];
                const b = selected[1];
                labelEl.textContent =
                    (a ? a.label : '') + ', ' + (b ? b.label : '') + ', +' + String(rest);
                labelEl.classList.remove('placeholder');
            }
        } else {
            const selected = this._options.find((o) => o.value === this._value) ?? null;
            labelEl.textContent = selected ? selected.label : this.placeholder;
            if (!selected) {
                labelEl.classList.add('placeholder');
            } else {
                labelEl.classList.remove('placeholder');
            }

            // Update color dot for single selection
            const btn = this.querySelector<HTMLButtonElement>('.dropdown-toggle');
            const existingDot = btn?.querySelector('.color-dot');
            if (existingDot) {
                existingDot.remove();
            }

            if (selected?.color && btn) {
                const colorDot = document.createElement('span');
                colorDot.className = 'color-dot';
                colorDot.style.setProperty('--dot-color', selected.color);
                colorDot.setAttribute('aria-hidden', 'true');
                btn.insertBefore(colorDot, labelEl);
            }
        }
    }

    private updateOptionsSelectionUI(): void {
        const els = this.getOptionEls();
        els.forEach((li) => {
            const val = li.getAttribute('data-value') ?? '';
            const isSel = this.isMultiple ? this._values.has(val) : val === (this._value ?? '');
            li.setAttribute('aria-selected', String(isSel));
            // Sync real checkbox in multi-select for full-row toggling UX
            const cb = li.querySelector<HTMLInputElement>("input[type='checkbox']");
            if (cb) {
                cb.checked = isSel;
            }
        });
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'tl-dropdown': TLDropdown;
    }
}

export function defineDropdown(): void {
    if (!customElements.get('tl-dropdown')) {
        customElements.define('tl-dropdown', TLDropdown);
    }
}
