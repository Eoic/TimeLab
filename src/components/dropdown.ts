type Option = { value: string; label: string; color?: string };

export class TLDropdown extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['placeholder', 'search'];
  }

  private _options: Option[] = [];
  private _value: string | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private menuEl: HTMLDivElement | null = null;
  private onRepositionBound: (() => void) | null = null;

  // Bound handlers
  private onKeydown = (e: KeyboardEvent): void => {
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

  attributeChangedCallback(): void {
    this.render();
  }

  private setExpanded(expanded: boolean): void {
    this.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const wrap = this.querySelector<HTMLDivElement>('.dropdown');
    if (wrap) {
      wrap.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    if (expanded) {
      this.createOverlay();
      this.portalMenu();
    } else {
      this.unportalMenu();
      this.destroyOverlay();
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
    this._value = v;
    this.render();
  }

  get value(): string | null {
    return this._value;
  }

  private get placeholder(): string {
    return this.getAttribute('placeholder') ?? 'Select…';
  }

  private get enableSearch(): boolean {
    return this.hasAttribute('search');
  }

  private toggle(): void {
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
    this._value = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value } }));
    this.setExpanded(false);
    this.render();
  }

  private filterOptions(query: string): Option[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this._options;
    }
    return this._options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }

  private render(): void {
    const selected = this._options.find(o => o.value === this._value) ?? null;
    const expanded = this.getAttribute('aria-expanded') === 'true';
    const search = this.enableSearch;

    this.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'dropdown';
    wrap.setAttribute('aria-expanded', String(expanded));

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
    label.textContent = selected ? selected.label : this.placeholder;
    if (!selected) {
      label.classList.add('placeholder');
    }

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined chevron';
    icon.textContent = 'expand_more';

    btn.append(label, icon);

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.setAttribute('role', 'listbox');
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
            opts.findIndex(li => li.getAttribute('data-value') === this._value)
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
    menu.style.zIndex = '1001'; // above overlay
    this.repositionMenu();

    // Bind listeners
    const onReposition = () => {
      this.repositionMenu();
    };
    this.onRepositionBound = onReposition;
    window.addEventListener('resize', onReposition, { passive: true });
    // Capture scroll anywhere in the doc
    window.addEventListener('scroll', onReposition, { passive: true, capture: true } as AddEventListenerOptions);
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
    if (!menu || !btn) {
      return;
    }

    const rect = btn.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8; // viewport margin
    const gap = 4; // gap between button and menu

    // Width follows button width by default
    const width = Math.min(rect.width, viewportW - margin * 2);
    const left = Math.min(Math.max(rect.left, margin), viewportW - width - margin);

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
    const maxHeight = Math.max(100, Math.min(desiredMenu, placeBelow ? belowSpace : aboveSpace));

    // Compute top
    let top = placeBelow ? rect.bottom + gap : rect.top - gap;
    if (!placeBelow) {
      // position from bottom by subtracting height later using translateY
      // Instead, shift top upwards by maxHeight
      top = Math.max(margin, rect.top - maxHeight - gap);
    }

    menu.style.width = `${String(Math.floor(width))}px`;
    menu.style.left = `${String(Math.floor(left))}px`;
    menu.style.top = `${String(Math.floor(top))}px`;
    menu.style.maxHeight = `${String(Math.floor(maxHeight))}px`;

    // Adjust internal list height to match available space inside menu
    const list = menu.querySelector<HTMLUListElement>('.dropdown-options');
    if (list) {
      const available = Math.max(0, Math.floor(maxHeight - padTop - padBottom - searchBlock));
      list.style.maxHeight = `${String(available)}px`;
      list.style.overflow = 'auto';
    }
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
      li.setAttribute('aria-selected', String(o.value === this._value));
      li.addEventListener('click', () => {
        this.select(o.value);
      });

      const check = document.createElement('span');
      check.className = 'material-symbols-outlined check';
      check.textContent = 'check';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      if (o.color) {
        swatch.style.backgroundColor = o.color;
        swatch.setAttribute('aria-hidden', 'true');
      }

      const text = document.createElement('span');
      text.textContent = o.label;

      li.append(check, swatch, text);
      list.appendChild(li);
    }
  }

  private getOptionEls(): HTMLLIElement[] {
    return Array.from(this.querySelectorAll<HTMLLIElement>('.dropdown-options .dropdown-option'));
  }

  private setActive(index: number): void {
    const els = this.getOptionEls();
    if (!els.length) {
      return;
    }
    const clamped = Math.max(0, Math.min(index, els.length - 1));
    els.forEach((el, i) => {
      if (i === clamped) {
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  private moveActive(delta: number): void {
    const els = this.getOptionEls();
    if (!els.length) {
      return;
    }
    const current = els.findIndex(el => el.classList.contains('active'));
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
