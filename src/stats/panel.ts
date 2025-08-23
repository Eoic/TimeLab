export function setupStatsPanel(): void {
    const labelsList = document.querySelector<HTMLUListElement>('.labels-list');
    const totalEl = document.getElementById('stats-total');
    const typesEl = document.getElementById('stats-types');
    const listEl = document.getElementById('stats-list');

    if (!labelsList || !totalEl || !typesEl || !listEl) {
        return;
    }

    type TCount = { name: string; count: number; color?: string };

    const update = () => {
        const labelItems = Array.from(labelsList.querySelectorAll<HTMLLIElement>('.label-item'));
        const total = labelItems.length;
        const countsByName = new Map<string, TCount>();

        for (const li of labelItems) {
            const name = (li.querySelector<HTMLElement>('.title')?.textContent || '').trim();
            const dot = li.querySelector<HTMLElement>('.dot');
            let color: string | undefined;
            if (dot) {
                const v = dot.style.getPropertyValue('--dot').trim();
                color = v || undefined;
            }
            if (!countsByName.has(name)) {
                let entry: TCount = { name, count: 1 };
                if (color) {
                    entry = { ...entry, color };
                }
                countsByName.set(name, entry);
            } else {
                const entry = countsByName.get(name);
                if (entry) {
                    entry.count += 1;
                    if (!entry.color && color) {
                        entry.color = color;
                    }
                }
            }
        }

        totalEl.textContent = String(total);
        typesEl.textContent = String(countsByName.size);

        listEl.textContent = '';
        const sorted = Array.from(countsByName.values()).sort(
            (a, b) => b.count - a.count || a.name.localeCompare(b.name)
        );
        for (const row of sorted) {
            const li = document.createElement('li');
            const dot = document.createElement('span');
            dot.className = 'dot';
            if (row.color) {
                (dot as HTMLElement).style.setProperty('--dot', row.color);
            }
            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = row.name;
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = String(row.count);
            li.appendChild(dot);
            li.appendChild(name);
            li.appendChild(count);
            listEl.appendChild(li);
        }
    };

    const observer = new MutationObserver(() => {
        update();
    });
    observer.observe(labelsList, { childList: true, subtree: true });

    labelsList.addEventListener('click', (ev: Event) => {
        const target = ev.target as HTMLElement | null;
        if (!target) {
            return;
        }
        const btn = target.closest('button.delete');
        if (btn) {
            const li = btn.closest('li.label-item');
            if (li && li.parentElement) {
                li.parentElement.removeChild(li);
                update();
            }
        }
    });

    update();
}
