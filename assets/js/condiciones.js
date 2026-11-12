/*
 * Condiciones del mar con la API gratuita de Open-Meteo (sin clave):
 *   - Marine API: oleaje, mar de fondo, corriente y temperatura del agua
 *   - Forecast API: viento, rachas, tiempo, visibilidad, UV, sol
 *   - Geocoding API: búsqueda de localidades
 */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const fmt = (value, decimals = 1) => value == null ? '—'
        : value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    const SPOTS = [
        { name: 'Illes Medes (Girona)', lat: 42.047, lon: 3.226 },
        { name: 'Cap de Creus (Girona)', lat: 42.319, lon: 3.322 },
        { name: 'Islas Columbretes (Castellón)', lat: 39.897, lon: 0.686 },
        { name: 'Isla de Tabarca (Alicante)', lat: 38.163, lon: -0.473 },
        { name: 'Cabo de Palos – Islas Hormigas (Murcia)', lat: 37.652, lon: -0.652 },
        { name: 'Cabo de Gata (Almería)', lat: 36.718, lon: -2.193 },
        { name: 'Illa del Toro (Mallorca)', lat: 39.461, lon: 2.480 },
        { name: 'La Restinga – El Hierro', lat: 27.633, lon: -17.983 },
        { name: 'Islas Cíes (Pontevedra)', lat: 42.219, lon: -8.915 },
    ];

    const WMO = {
        0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nuboso', 3: 'Cubierto',
        45: 'Niebla', 48: 'Niebla con escarcha',
        51: 'Llovizna débil', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada intensa',
        61: 'Lluvia débil', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
        71: 'Nieve débil', 73: 'Nieve', 75: 'Nieve fuerte', 77: 'Granos de nieve',
        80: 'Chubascos débiles', 81: 'Chubascos', 82: 'Chubascos violentos', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve fuertes',
        95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte',
    };

    const LEVEL_TEXT = { ok: 'Favorable', warn: 'Precaución', danger: 'Desfavorable', none: 'Sin datos' };
    const RANK = { none: -1, ok: 0, warn: 1, danger: 2 };

    // -----------------------------------------------------------------------
    // Escalas y conversiones
    // -----------------------------------------------------------------------
    function compass(deg) {
        if (deg == null) return '';
        const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
        return points[Math.round(deg / 22.5) % 16];
    }

    // Flecha que apunta hacia donde va (los datos indican de dónde viene)
    const arrow = (deg) => deg == null ? '' : `<span class="arrow" style="transform: rotate(${deg + 180}deg)" aria-hidden="true">↑</span>`;

    function douglas(h) {
        if (h == null) return '';
        if (h <= 0) return 'Calma';
        if (h <= 0.1) return 'Calma rizada';
        if (h <= 0.5) return 'Rizada';
        if (h <= 1.25) return 'Marejadilla';
        if (h <= 2.5) return 'Marejada';
        if (h <= 4) return 'Fuerte marejada';
        if (h <= 6) return 'Mar gruesa';
        return 'Mar muy gruesa o superior';
    }

    function beaufort(kmh) {
        if (kmh == null) return '';
        const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
        const names = ['Calma', 'Ventolina', 'Flojito', 'Flojo', 'Bonancible', 'Fresquito', 'Fresco', 'Frescachón', 'Temporal', 'Temporal fuerte', 'Temporal duro', 'Temporal muy duro', 'Temporal huracanado'];
        const force = limits.findIndex((limit) => kmh <= limit);
        const f = force === -1 ? 12 : force;
        return `Fuerza ${f} · ${names[f]}`;
    }

    function wetsuit(sst) {
        if (sst == null) return '';
        if (sst >= 26) return 'Orientativo: licra o neopreno de 3 mm';
        if (sst >= 22) return 'Orientativo: neopreno de 3 a 5 mm';
        if (sst >= 18) return 'Orientativo: neopreno de 5 a 7 mm';
        if (sst >= 14) return 'Orientativo: 7 mm o traje semiseco';
        return 'Orientativo: traje seco';
    }

    // -----------------------------------------------------------------------
    // Valoración (semáforo)
    // -----------------------------------------------------------------------
    function rate(value, warnFrom, dangerFrom) {
        if (value == null) return 'none';
        if (dangerFrom != null && value >= dangerFrom) return 'danger';
        if (value >= warnFrom) return 'warn';
        return 'ok';
    }

    function weatherLevel(code, visibility) {
        if (code == null) return 'none';
        if (code >= 95) return 'danger';
        if ([45, 48, 65, 67, 82].includes(code) || (visibility != null && visibility < 1000)) return 'warn';
        return 'ok';
    }

    function evaluate({ wave, wind, gust, current, code, visibility, sst }) {
        const checks = [
            { level: rate(wave, 0.51, 1.26), warn: `Oleaje de ${fmt(wave)} m: entradas y salidas del agua más difíciles y posible mareo en superficie.`, danger: `Oleaje de ${fmt(wave)} m (${douglas(wave).toLowerCase()}): condiciones peligrosas para entrar y salir del agua.` },
            { level: rate(wind, 20, 39), warn: `Viento de ${fmt(wind, 0)} km/h: el mar puede empeorar durante la inmersión.`, danger: `Viento de ${fmt(wind, 0)} km/h: riesgo para la embarcación y para la recogida en superficie.` },
            { level: rate(gust, 40, 55), warn: `Rachas de ${fmt(gust, 0)} km/h.`, danger: `Rachas muy fuertes de ${fmt(gust, 0)} km/h.` },
            { level: rate(current, 0.9, 1.81), warn: `Corriente superficial de ${fmt(current)} km/h: planifica la inmersión contra la corriente al inicio y lleva una boya de señalización.`, danger: `Corriente de ${fmt(current)} km/h: demasiado fuerte para el buceo recreativo salvo una deriva planificada con guía local.` },
            { level: weatherLevel(code, visibility), warn: `${WMO[code] || 'Visibilidad reducida'}: dificulta la localización de buceadores en superficie.`, danger: `${WMO[code]}: riesgo de rayos. No permanezcas en el agua ni en una embarcación al descubierto.` },
            { level: sst == null ? 'none' : sst < 14 ? 'warn' : 'ok', warn: `Agua a ${fmt(sst)} °C: riesgo de hipotermia. Usa protección térmica adecuada y acorta la inmersión.` },
        ];
        const level = checks.reduce((worst, c) => RANK[c.level] > RANK[worst] ? c.level : worst, 'none');
        const reasons = checks.filter((c) => c.level === 'warn' || c.level === 'danger').map((c) => c[c.level]);
        return { level: level === 'none' ? 'none' : level, reasons };
    }

    // -----------------------------------------------------------------------
    // Peticiones
    // -----------------------------------------------------------------------
    async function getJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status} al consultar ${new URL(url).hostname}`);
        return res.json();
    }

    function fetchMarine(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7,
            current: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
            hourly: 'wave_height',
            daily: 'wave_height_max,wave_period_max,wave_direction_dominant',
        });
        return getJson(`https://marine-api.open-meteo.com/v1/marine?${params}`);
    }

    function fetchWeather(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7, wind_speed_unit: 'kmh',
            current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index',
            hourly: 'wind_speed_10m,wind_gusts_10m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max',
        });
        return getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    }

    // -----------------------------------------------------------------------
    // Mapa
    // -----------------------------------------------------------------------
    const map = L.map('map', { scrollWheelZoom: false }).setView([39.5, -3], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 14,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const marker = L.circleMarker([0, 0], { radius: 9, color: '#0b2545', weight: 3, fillColor: '#2389a8', fillOpacity: .9 });

    map.on('click', (e) => load(e.latlng.lat, e.latlng.lng, 'Punto seleccionado en el mapa'));

    // -----------------------------------------------------------------------
    // Renderizado
    // -----------------------------------------------------------------------
    let chart = null;

    function metric(label, value, sub, level) {
        return `<div class="card metric">
            <div class="metric-head"><span class="metric-label">${label}</span>${level ? `<span class="badge badge-${level}">${LEVEL_TEXT[level]}</span>` : ''}</div>
            <div class="metric-value">${value}</div>
            <div class="metric-sub">${sub || '&nbsp;'}</div>
        </div>`;
    }

    const time = (iso) => iso ? iso.slice(11, 16) : '—';

    function render(marine, weather) {
        const m = marine.current;
        const w = weather.current;

        if (m.wave_height == null && m.sea_surface_temperature == null) {
            $('conditions').hidden = true;
            $('status').innerHTML = `<div class="notice notice-info"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <div><strong>No hay datos marinos para este punto</strong><p>Parece que el punto está en tierra o en una zona sin cobertura del modelo. Haz clic en el mar, cerca de la costa.</p></div></div>`;
            return;
        }

        const verdict = evaluate({
            wave: m.wave_height, wind: w.wind_speed_10m, gust: w.wind_gusts_10m, current: m.ocean_current_velocity,
            code: w.weather_code, visibility: w.visibility, sst: m.sea_surface_temperature,
        });

        const titles = {
            ok: 'Condiciones favorables',
            warn: 'Bucea con precaución',
            danger: 'Condiciones desfavorables: no se recomienda bucear',
            none: 'Datos insuficientes',
        };
        const intro = {
            ok: 'Los parámetros disponibles están dentro de los márgenes habituales del buceo recreativo. Sigue las indicaciones del centro de buceo y comprueba el estado del mar en el lugar.',
            warn: 'Algunas condiciones exigen experiencia, una buena planificación y la valoración del guía local:',
            danger: 'Al menos uno de los parámetros supera los márgenes razonables para el buceo recreativo:',
            none: 'No se han podido obtener todos los datos necesarios para valorar las condiciones.',
        };
        const level = verdict.level;
        $('verdict').className = `verdict verdict-${level === 'none' ? 'warn' : level} mb-3`;
        $('verdict').innerHTML = `<div class="verdict-light" aria-hidden="true"></div>
            <div><h3>${titles[level]}</h3><p class="mb-0">${intro[level]}</p>
            ${verdict.reasons.length ? `<ul>${verdict.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}</div>`;

        const daily = weather.daily;
        $('metrics').innerHTML = [
            metric('Oleaje', `${fmt(m.wave_height)} m`, `${douglas(m.wave_height)} · ${fmt(m.wave_period)} s · del ${compass(m.wave_direction)} ${arrow(m.wave_direction)}`, rate(m.wave_height, 0.51, 1.26)),
            metric('Mar de fondo', `${fmt(m.swell_wave_height)} m`, m.swell_wave_height == null ? 'Sin datos' : `${fmt(m.swell_wave_period)} s · del ${compass(m.swell_wave_direction)} ${arrow(m.swell_wave_direction)}`),
            metric('Viento', `${fmt(w.wind_speed_10m, 0)} km/h`, `${beaufort(w.wind_speed_10m)} · del ${compass(w.wind_direction_10m)} ${arrow(w.wind_direction_10m)}`, rate(w.wind_speed_10m, 20, 39)),
            metric('Rachas', `${fmt(w.wind_gusts_10m, 0)} km/h`, beaufort(w.wind_gusts_10m), rate(w.wind_gusts_10m, 40, 55)),
            metric('Corriente superficial', `${fmt(m.ocean_current_velocity)} km/h`, m.ocean_current_velocity == null ? 'Sin datos' : `≈ ${fmt(m.ocean_current_velocity / 1.852)} nudos · hacia el ${compass((m.ocean_current_direction + 180) % 360)}`, rate(m.ocean_current_velocity, 0.9, 1.81)),
            metric('Temperatura del agua', `${fmt(m.sea_surface_temperature)} °C`, wetsuit(m.sea_surface_temperature), m.sea_surface_temperature == null ? '' : m.sea_surface_temperature < 14 ? 'warn' : 'ok'),
            metric('Tiempo', `${fmt(w.temperature_2m, 0)} °C`, `${WMO[w.weather_code] || '—'} · visibilidad ${w.visibility == null ? '—' : fmt(w.visibility / 1000, 0) + ' km'}`, weatherLevel(w.weather_code, w.visibility)),
            metric('Sol y radiación UV', `UV ${fmt(w.uv_index, 0)}`, `Amanecer ${time(daily.sunrise[0])} · ocaso ${time(daily.sunset[0])}`),
        ].join('');

        renderChart(marine.hourly, weather.hourly, w.time);
        renderForecast(marine.daily, weather.daily);

        $('status').innerHTML = `<p class="small muted">Datos de Open-Meteo actualizados: ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
            (hora local del punto: ${time(w.time)}). La dirección del oleaje y del viento indica de dónde vienen.</p>`;
        $('conditions').hidden = false;
    }

    function renderChart(marineHourly, weatherHourly, localNow) {
        const windByTime = new Map(weatherHourly.time.map((t, i) => [t, weatherHourly.wind_speed_10m[i]]));
        const nowKey = localNow.slice(0, 13); // hora actual en la zona horaria del punto
        let start = marineHourly.time.findIndex((t) => t.slice(0, 13) >= nowKey);
        if (start < 0) start = 0;
        const times = marineHourly.time.slice(start, start + 48);

        const labels = times.map((t) => {
            const d = new Date(t);
            return d.toLocaleDateString('es-ES', { weekday: 'short' }) + ' ' + t.slice(11, 13) + 'h';
        });
        const waves = marineHourly.wave_height.slice(start, start + 48);
        const winds = times.map((t) => windByTime.get(t) ?? null);

        if (chart) chart.destroy();
        chart = new Chart($('chart'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Ola (m)', data: waves, borderColor: '#2389a8', backgroundColor: 'rgba(35,137,168,.15)', fill: true, tension: .35, yAxisID: 'y', pointRadius: 0, borderWidth: 2 },
                    { label: 'Viento (km/h)', data: winds, borderColor: '#0b2545', borderDash: [5, 4], tension: .35, yAxisID: 'y1', pointRadius: 0, borderWidth: 2 },
                ],
            },
            options: {
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
                    y: { beginAtZero: true, title: { display: true, text: 'Altura de ola (m)' } },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Viento (km/h)' } },
                },
            },
        });
    }

    function renderForecast(md, wd) {
        const rows = wd.time.map((day, i) => {
            const v = evaluate({
                wave: md.wave_height_max?.[i], wind: wd.wind_speed_10m_max[i], gust: wd.wind_gusts_10m_max[i],
                code: wd.weather_code[i], current: null, visibility: null, sst: null,
            });
            const date = new Date(`${day}T12:00`);
            const label = i === 0 ? 'Hoy' : date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            return `<tr>
                <td>${label.charAt(0).toUpperCase() + label.slice(1)}</td>
                <td>${WMO[wd.weather_code[i]] || '—'}</td>
                <td class="num">${fmt(md.wave_height_max?.[i])} m</td>
                <td class="num">${fmt(md.wave_period_max?.[i])} s</td>
                <td class="num">${fmt(wd.wind_speed_10m_max[i], 0)} km/h</td>
                <td class="num">${fmt(wd.wind_gusts_10m_max[i], 0)} km/h</td>
                <td class="num">${fmt(wd.temperature_2m_min[i], 0)}–${fmt(wd.temperature_2m_max[i], 0)} °C</td>
                <td><span class="badge badge-${v.level}">${LEVEL_TEXT[v.level]}</span></td>
            </tr>`;
        });
        $('forecast').tBodies[0].innerHTML = rows.join('');
    }

    // -----------------------------------------------------------------------
    // Carga de una ubicación
    // -----------------------------------------------------------------------
    let requestId = 0;

    async function load(lat, lon, name, meta = '') {
        const id = ++requestId;
        lat = Number(lat.toFixed(4));
        lon = Number(lon.toFixed(4));
        $('placeName').textContent = name;
        $('placeMeta').textContent = `${meta ? meta + ' · ' : ''}${fmt(lat, 4)}, ${fmt(lon, 4)}`;
        $('status').innerHTML = '<p class="muted"><span class="loader"></span> Consultando las condiciones…</p>';
        marker.setLatLng([lat, lon]).addTo(map);
        map.setView([lat, lon], Math.max(map.getZoom(), 9));

        try {
            localStorage.setItem('buceo:lastPlace', JSON.stringify({ lat, lon, name, meta }));
        } catch (e) { /* almacenamiento no disponible */ }

        try {
            const [marine, weather] = await Promise.all([fetchMarine(lat, lon), fetchWeather(lat, lon)]);
            if (id !== requestId) return; // llegó una consulta más reciente
            render(marine, weather);
        } catch (err) {
            if (id !== requestId) return;
            $('conditions').hidden = true;
            $('status').innerHTML = `<div class="notice notice-danger"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                <div><strong>No se han podido obtener los datos</strong><p>${err.message}. Comprueba tu conexión e inténtalo de nuevo.</p></div></div>`;
        }
    }

    // Puntos predefinidos
    $('spotList').innerHTML = SPOTS.map((s, i) => `<button type="button" class="chip" data-spot="${i}">${s.name}</button>`).join('');
    $('spotList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-spot]');
        if (!btn) return;
        const s = SPOTS[btn.dataset.spot];
        load(s.lat, s.lon, s.name, 'Punto de buceo');
    });

    // Buscador
    $('searchForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = $('searchInput').value.trim();
        if (query.length < 2) return;
        $('searchResults').innerHTML = '<span class="muted small"><span class="loader"></span> Buscando…</span>';
        try {
            const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: 6, language: 'es' })}`);
            const results = data.results || [];
            if (!results.length) {
                $('searchResults').innerHTML = '<span class="muted small">No se han encontrado localidades con ese nombre.</span>';
                return;
            }
            $('searchResults').innerHTML = results.map((r, i) =>
                `<button type="button" class="chip" data-result="${i}">${r.name}${r.admin2 ? `, ${r.admin2}` : r.admin1 ? `, ${r.admin1}` : ''} (${r.country_code})</button>`).join('');
            $('searchResults').onclick = (ev) => {
                const btn = ev.target.closest('[data-result]');
                if (!btn) return;
                const r = results[btn.dataset.result];
                load(r.latitude, r.longitude, r.name, [r.admin2 || r.admin1, r.country].filter(Boolean).join(', '));
            };
        } catch (err) {
            $('searchResults').innerHTML = `<span class="small" style="color: var(--danger)">Error en la búsqueda: ${err.message}</span>`;
        }
    });

    // Ubicación inicial: la última consultada o las Illes Medes
    let initial = SPOTS[0];
    let initialMeta = 'Punto de buceo';
    try {
        const saved = JSON.parse(localStorage.getItem('buceo:lastPlace'));
        if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
            initial = saved;
            initialMeta = saved.meta;
        }
    } catch (e) { /* sin datos guardados */ }
    load(initial.lat, initial.lon, initial.name, initialMeta);
})();
