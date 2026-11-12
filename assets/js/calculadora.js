/*
 * Calculadora Nitrox: MOD, ppO2, EAD, mejor mezcla y % SNC.
 * Modelo simplificado: agua salada (10 m = 1 bar).
 */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const num = (id) => parseFloat($(id).value.replace(',', '.'));
    const fmt = (value, decimals = 1) => value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const floorTo = (value, step) => Math.floor(value / step) * step;

    const pressureAt = (depth) => depth / 10 + 1;

    // Límites de exposición única al oxígeno de NOAA (ppO2 en bar => minutos)
    const NOAA_LIMITS = [
        [0.6, 720], [0.7, 570], [0.8, 450], [0.9, 360], [1.0, 300], [1.1, 240],
        [1.2, 210], [1.3, 180], [1.4, 150], [1.5, 120], [1.6, 45],
    ];

    function noaaLimit(ppo2) {
        if (ppo2 < 0.5) return Infinity;
        const rounded = Math.ceil(ppo2 * 10 - 1e-9) / 10; // redondeo hacia arriba (conservador)
        const row = NOAA_LIMITS.find(([p]) => p >= rounded);
        return row ? row[1] : null; // null = por encima de 1,6 bar
    }

    // -----------------------------------------------------------------------
    // Componentes de salida
    // -----------------------------------------------------------------------
    function result(label, value, note = '', status = '') {
        return `<div class="result${status ? ` is-${status}` : ''}">
            <div class="result-label">${label}</div>
            <div class="result-value">${value}</div>
            ${note ? `<div class="result-note">${note}</div>` : ''}
        </div>`;
    }

    const ICONS = {
        danger: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        ok: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    };

    function alertBox(type, title, text) {
        return `<div class="notice notice-${type}"><svg viewBox="0 0 24 24">${ICONS[type]}</svg>
            <div><strong>${title}</strong><p>${text}</p></div></div>`;
    }

    function invalid(container, message) {
        $(container).innerHTML = alertBox('info', 'Revisa los datos', message);
    }

    function markInvalid(ids, isInvalid) {
        ids.forEach((id) => $(id).setAttribute('aria-invalid', String(isInvalid(id))));
    }

    // -----------------------------------------------------------------------
    // Nitrox
    // -----------------------------------------------------------------------
    function calcNitrox() {
        const o2 = num('nxO2');
        const ppo2Max = num('nxPpo2');
        const depth = num('nxDepth');
        const time = num('nxTime');

        markInvalid(['nxO2', 'nxDepth', 'nxTime'], (id) => {
            const v = num(id);
            if (id === 'nxO2') return !(v >= 21 && v <= 40);
            if (id === 'nxDepth') return !(v >= 0 && v <= 60);
            return !(v > 0 && v <= 300);
        });

        if (!(o2 >= 21 && o2 <= 40) || !(depth >= 0 && depth <= 60) || !(time > 0 && time <= 300)) {
            $('nxResults').innerHTML = '';
            invalid('nxAlerts', 'El oxígeno debe estar entre 21 y 40 %, la profundidad entre 0 y 60 m y el tiempo entre 1 y 300 minutos.');
            return;
        }

        const fo2 = o2 / 100;
        const p = pressureAt(depth);
        const mod = floorTo((ppo2Max / fo2 - 1) * 10, 1);
        const modContingency = floorTo((1.6 / fo2 - 1) * 10, 1);
        const ppo2 = fo2 * p;
        const ead = Math.max(0, ((1 - fo2) * (depth + 10)) / 0.79 - 10);
        const bestMix = Math.min(40, Math.floor((ppo2Max / p) * 100));
        const limit = noaaLimit(ppo2);
        const cns = limit === null ? null : (limit === Infinity ? 0 : (time / limit) * 100);

        const overMod = depth > mod;
        const ppo2Status = ppo2 > 1.6 ? 'danger' : ppo2 > 1.4 ? 'warn' : 'ok';
        const cnsStatus = cns === null || cns >= 100 ? 'danger' : cns >= 80 ? 'warn' : 'ok';

        $('nxResults').innerHTML = [
            result('MOD a ' + fmt(ppo2Max) + ' bar', `${fmt(mod, 0)} m`, `Contingencia (1,6 bar): ${fmt(modContingency, 0)} m`, overMod ? 'danger' : ''),
            result('ppO₂ a ' + fmt(depth, 0) + ' m', `${fmt(ppo2, 2)} bar`, `Presión absoluta: ${fmt(p, 1)} bar`, ppo2Status),
            result('EAD', `${fmt(ead, 1)} m`, `Equivale a bucear con aire a esa profundidad`),
            result('Mejor mezcla', bestMix < 21 ? 'Aire' : `EAN${bestMix}`, `Para ${fmt(depth, 0)} m con ppO₂ ${fmt(ppo2Max)} bar`),
            result('% SNC', cns === null ? '> límite' : `${fmt(cns, 0)} %`, limit === Infinity ? 'Exposición despreciable' : limit ? `Límite NOAA: ${limit} min` : 'ppO₂ por encima de 1,6 bar', cnsStatus),
        ].join('');

        const alerts = [];
        if (overMod) {
            alerts.push(alertBox('danger', 'Profundidad por encima de la MOD',
                `Con EAN${o2} y ppO₂ máxima de ${fmt(ppo2Max)} bar no debes superar los ${fmt(mod, 0)} m. Reduce la profundidad o usa una mezcla con menos oxígeno.`));
        }
        if (ppo2 > 1.6) {
            alerts.push(alertBox('danger', 'ppO₂ superior a 1,6 bar',
                'Riesgo elevado de toxicidad del oxígeno en el sistema nervioso central, con posibles convulsiones bajo el agua, que pueden provocar un ahogamiento. Nunca planifiques por encima de 1,6 bar.'));
        } else if (ppo2 > 1.4) {
            alerts.push(alertBox('warn', 'ppO₂ entre 1,4 y 1,6 bar',
                'El límite de trabajo habitual en buceo recreativo es 1,4 bar. El margen hasta 1,6 bar se reserva para contingencias.'));
        }
        if (depth > 40) {
            alerts.push(alertBox('danger', 'Fuera de los límites del buceo recreativo',
                'El buceo recreativo se limita a 40 m. Más allá se requiere formación técnica, otras mezclas y procedimientos de descompresión.'));
        } else if (depth > 30) {
            alerts.push(alertBox('warn', 'Inmersión profunda',
                'Entre 30 y 40 m se necesita formación específica de buceo profundo. La narcosis y el consumo de gas aumentan de forma notable.'));
        } else if (depth > 18) {
            alerts.push(alertBox('info', 'Comprueba tu certificación',
                'El nivel de entrada (Open Water) está limitado a 18 m. Para ir más allá necesitas una certificación avanzada.'));
        }
        if (cns !== null && cns >= 80) {
            alerts.push(alertBox(cns >= 100 ? 'danger' : 'warn', 'Exposición al oxígeno elevada',
                `El % SNC de esta inmersión es ${fmt(cns, 0)} %. Recuerda que se acumula si haces varias inmersiones. Reduce el tiempo o la ppO₂.`));
        }
        if (!alerts.length) {
            alerts.push(alertBox('ok', 'Parámetros dentro de los límites recreativos',
                'Recuerda analizar tu botella antes de bucear, etiquetarla con el % de O₂ y la MOD, y configurar la mezcla en tu ordenador.'));
        }
        $('nxAlerts').innerHTML = alerts.join('');
    }

    // -----------------------------------------------------------------------
    // Cálculo en vivo
    // -----------------------------------------------------------------------
    $('formNitrox').addEventListener('input', calcNitrox);
    $('formNitrox').addEventListener('submit', (e) => e.preventDefault());

    calcNitrox();
})();
