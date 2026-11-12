/*
 * Guía de accidentes: filtro por categoría, desplegar/plegar todas,
 * apertura desde un enlace (#edc) e impresión con todas las fichas abiertas.
 */
(() => {
    'use strict';

    const items = [...document.querySelectorAll('.condition')];
    const chips = [...document.querySelectorAll('[data-filter]')];
    const toggleAll = document.getElementById('toggleAll');

    function applyFilter(filter) {
        chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter)));
        items.forEach((item) => {
            item.hidden = filter !== 'all' && !item.dataset.cat.split(' ').includes(filter);
        });
        updateToggleLabel();
    }

    function visibleItems() {
        return items.filter((item) => !item.hidden);
    }

    function updateToggleLabel() {
        const allOpen = visibleItems().every((item) => item.open);
        toggleAll.textContent = allOpen ? 'Plegar todas' : 'Desplegar todas';
    }

    chips.forEach((chip) => chip.addEventListener('click', () => applyFilter(chip.dataset.filter)));

    toggleAll.addEventListener('click', () => {
        const open = !visibleItems().every((item) => item.open);
        visibleItems().forEach((item) => { item.open = open; });
        updateToggleLabel();
    });

    items.forEach((item) => item.addEventListener('toggle', updateToggleLabel));

    // Abrir la ficha indicada en la URL (p. ej. accidentes.html#embolia)
    function openFromHash() {
        const target = location.hash && document.getElementById(location.hash.slice(1));
        if (target && target.classList.contains('condition')) {
            applyFilter('all');
            target.open = true;
            target.scrollIntoView({ block: 'start' });
        }
    }
    window.addEventListener('hashchange', openFromHash);
    openFromHash();

    // Impresión: se abren todas las fichas y después se restaura el estado
    let openBeforePrint = [];
    window.addEventListener('beforeprint', () => {
        openBeforePrint = items.map((item) => item.open);
        items.forEach((item) => { item.open = true; item.hidden = false; });
    });
    window.addEventListener('afterprint', () => {
        items.forEach((item, i) => { item.open = openBeforePrint[i]; });
        applyFilter(chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.dataset.filter || 'all');
    });
    document.getElementById('printGuide').addEventListener('click', () => window.print());

    updateToggleLabel();
})();
