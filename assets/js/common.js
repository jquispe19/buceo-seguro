/*
 * Elementos comunes a todas las páginas: barra de emergencia, cabecera,
 * navegación y pie. Cada página indica cuál es con <body data-page="...">.
 */
(() => {
    'use strict';

    const AUTHOR = 'John Quispe Carrió';

    const PAGES = [
        { id: 'inicio', href: 'index.html', label: 'Inicio' },
        { id: 'condiciones', href: 'condiciones.html', label: 'Condiciones del mar' },
        { id: 'calculadora', href: 'calculadora.html', label: 'Calculadora' },
        { id: 'accidentes', href: 'accidentes.html', label: 'Accidentes y actuación' },
    ];

    const current = document.body.dataset.page;

    const logo = `
        <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#13315c" stroke="#7fd1e6" stroke-width="2"/>
            <path d="M7 24c3-2.5 6-2.5 9 0s6 2.5 9 0 6-2.5 8 0" fill="none" stroke="#7fd1e6" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M7 30c3-2.5 6-2.5 9 0s6 2.5 9 0 6-2.5 8 0" fill="none" stroke="#2389a8" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="24" cy="12" r="2.2" fill="#fff"/><circle cx="28" cy="7.5" r="1.4" fill="#fff"/><circle cx="20" cy="16" r="1.2" fill="#fff"/>
        </svg>`;

    const emergencyBar = `
        <div class="emergency-bar" role="region" aria-label="Teléfonos de emergencia">
            <div class="container">
                <span>Emergencia de buceo:</span>
                <a href="tel:112">112</a>
                <a href="tel:+390642115685">DAN Europe +39 06 4211 5685</a>
                <a href="tel:900202202">Salvamento Marítimo 900 202 202</a>
                <span>VHF canal 16</span>
            </div>
        </div>`;

    const header = `
        <a class="skip-link" href="#main">Saltar al contenido</a>
        ${emergencyBar}
        <header class="site-header">
            <div class="container">
                <a class="brand" href="index.html">${logo}<span class="brand-name">Buceo <span>Seguro</span></span></a>
                <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mainNav">Menú</button>
                <nav class="main-nav" id="mainNav" aria-label="Principal">
                    <ul>
                        ${PAGES.map((p) => `<li><a href="${p.href}"${p.id === current ? ' aria-current="page"' : ''}>${p.label}</a></li>`).join('')}
                    </ul>
                </nav>
            </div>
        </header>`;

    const footer = `
        <footer class="site-footer">
            <div class="container">
                <div class="grid grid-3">
                    <div>
                        <h2>Buceo Seguro</h2>
                        <p class="mb-0">Divulgación sobre seguridad en el buceo recreativo: planificación, condiciones del mar,
                        gases respirables y prevención de accidentes.</p>
                    </div>
                    <div>
                        <h2>Secciones</h2>
                        <ul>${PAGES.map((p) => `<li><a href="${p.href}">${p.label}</a></li>`).join('')}</ul>
                    </div>
                    <div>
                        <h2>En caso de accidente</h2>
                        <ul>
                            <li>Emergencias: <a href="tel:112">112</a></li>
                            <li>DAN Europe (24 h): <a href="tel:+390642115685">+39 06 4211 5685</a></li>
                            <li>Salvamento Marítimo: <a href="tel:900202202">900 202 202</a> · VHF 16</li>
                        </ul>
                    </div>
                </div>
                <div class="footer-legal">
                    <p>Contenido elaborado por <strong>${AUTHOR}</strong>, instructor de buceo SSI.
                    La información de esta web es <strong>divulgativa y educativa</strong>: no sustituye la formación de una
                    agencia certificadora, el criterio de un profesional en el lugar de inmersión, tu ordenador de buceo ni
                    la valoración de un médico. Bucea siempre dentro de los límites de tu formación y experiencia.</p>
                    <p class="mb-0">Web personal de un instructor SSI: no es una web oficial de SSI y no tiene relación con DAN
                    ni con Salvamento Marítimo. Información sobre cursos en <a href="https://www.divessi.com/es/advanced-training/scuba-diving" target="_blank" rel="noopener">divessi.com</a>.
                    Datos meteorológicos y marinos: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>
                    (CC BY 4.0). Mapa: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.
                    © ${new Date().getFullYear()} ${AUTHOR}.</p>
                </div>
            </div>
        </footer>`;

    document.body.insertAdjacentHTML('afterbegin', header);
    document.body.insertAdjacentHTML('beforeend', footer);

    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('mainNav');
    toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
    });
})();
