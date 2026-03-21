// ============================================
// TRACK MAP MODULE
// Interactive Leaflet map for storm track data
// Eyewall Refined Center + sidebar detail panel
// ============================================

let trackMap = null;
let trackData = [];
let trackLineSegments = [];
let trackMarkerRefs = [];
let activeFilter = 'min_pressure_hpa';
let activePoint = null;             // currently selected track point
let sidebarProductA = 'Enthalpy Fluxes - Radial';
let sidebarProductB = 'Enthalpy Fluxes - Tangential';

// === FILTER DEFINITIONS ===
const FILTERS = {
    min_pressure_hpa: {
        label: 'Min Pressure',
        unit: 'hPa',
        icon: 'fas fa-compress-arrows-alt',
        extract: p => p.diagnostics.min_pressure_hpa,
        invert: true,
        formatVal: v => v.toFixed(1)
    },
    max_enthalpy_wm2: {
        label: 'Max Enthalpy',
        unit: 'W/m²',
        icon: 'fas fa-fire',
        extract: p => p.diagnostics.max_enthalpy_wm2,
        invert: false,
        formatVal: v => v.toFixed(0)
    },
    max_lh_wm2: {
        label: 'Latent Heat Flux',
        unit: 'W/m²',
        icon: 'fas fa-water',
        extract: p => p.diagnostics.max_lh_wm2,
        invert: false,
        formatVal: v => v.toFixed(0)
    },
    max_hfx_wm2: {
        label: 'Sensible Heat Flux',
        unit: 'W/m²',
        icon: 'fas fa-temperature-high',
        extract: p => p.diagnostics.max_hfx_wm2,
        invert: false,
        formatVal: v => v.toFixed(0)
    },
    offset_km: {
        label: 'Center Offset',
        unit: 'km',
        icon: 'fas fa-arrows-alt-h',
        extract: p => p.offset_km,
        invert: false,
        formatVal: v => v.toFixed(1)
    }
};

// 2D products from catalog that sidebar can display
const SIDEBAR_PRODUCTS = [
    'Enthalpy Fluxes - Surface',
    'Enthalpy Fluxes - Horizontal',
    'Enthalpy Fluxes - Lat xsec',
    'Enthalpy Fluxes - Lon xsec',
    'Radial Profile',
    'Enthalpy Fluxes - Radial',
    'Enthalpy Fluxes - Tangential',
    'Simulated Radar - Reflectivity',
    'Wind Speed (10m)'
];

// === COLOR RAMP ===
function intensityColor(t) {
    t = Math.max(0, Math.min(1, t));
    if (t < 0.5) {
        const s = t / 0.5;
        return `rgb(239, ${Math.round(68 + 90 * s)}, ${Math.round(68 - 57 * s)})`;
    } else {
        const s = (t - 0.5) / 0.5;
        return `rgb(${Math.round(245 - 229 * s)}, ${Math.round(158 + 27 * s)}, ${Math.round(11 + 118 * s)})`;
    }
}

function normalizeValue(value, minV, maxV, invert) {
    if (maxV === minV) return 0.5;
    let t = (value - minV) / (maxV - minV);
    if (invert) t = 1 - t;
    if (!invert) t = 1 - t;
    return t;
}

function intensityRadius(t) {
    return 6 + (1 - t) * 6;
}

// === FORMAT DATETIME ===
function formatDatetime(dtStr) {
    const d = new Date(dtStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}  ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

// === IMAGE URL BUILDER ===
function buildImageUrl(productName, stormName, frame) {
    // Look up from catalog (loaded separately by app.js), or use hardcoded patterns
    const storm = stormName.toLowerCase();
    const patterns = {
        'Enthalpy Fluxes - Surface':        `images/${storm}/eflx_sfc_min/${storm}_eflx_sfc_min_${frame}.png`,
        'Enthalpy Fluxes - Horizontal':     `images/${storm}/eflx_hor_min/${storm}_eflx_hor_min_${frame}.png`,
        'Enthalpy Fluxes - Lat xsec':       `images/${storm}/eflx_xsec_lat/${storm}_eflx_xsec_lat_${frame}.png`,
        'Enthalpy Fluxes - Lon xsec':       `images/${storm}/eflx_xsec_lon/${storm}_eflx_xsec_lon_${frame}.png`,
        'Radial Profile':                    `images/${storm}/inflow_profile/${storm}_inflow_profile_${frame}.png`,
        'Enthalpy Fluxes - Radial':         `images/${storm}/eflx_radial_min/${storm}_eflx_radial_min_${frame}.png`,
        'Enthalpy Fluxes - Tangential':     `images/${storm}/eflx_tan_min/${storm}_eflx_tan_min_${frame}.png`,
        'Simulated Radar - Reflectivity':   `images/${storm}/radar_min/${storm}_radar_min_${frame}.png`,
        'Wind Speed (10m)':                 `images/${storm}/wind_min/${storm}_wind_sfc_min_0${frame}.png`
    };
    return patterns[productName] || '';
}

// ===========================
//  SIDEBAR PANEL LOGIC
// ===========================

function openSidebar(point) {
    activePoint = point;
    const sb = document.getElementById('track-sidebar');
    if (!sb) return;

    // Populate header
    document.getElementById('ts-storm-name').textContent = 'IAN';
    document.getElementById('ts-timestep').textContent = `T${point.timestep}`;
    document.getElementById('ts-datetime').textContent = formatDatetime(point.datetime);

    // Populate position
    document.getElementById('ts-lat').textContent = `${point.eyewall_refined_center.lat.toFixed(3)}°N`;
    document.getElementById('ts-lon').textContent = `${Math.abs(point.eyewall_refined_center.lon).toFixed(3)}°W`;

    // Populate diagnostics
    const d = point.diagnostics;
    document.getElementById('ts-pressure').textContent = `${d.min_pressure_hpa.toFixed(1)} hPa`;
    document.getElementById('ts-enthalpy').textContent = `${d.max_enthalpy_wm2.toFixed(0)} W/m²`;
    document.getElementById('ts-lh').textContent = `${d.max_lh_wm2.toFixed(0)} W/m²`;
    document.getElementById('ts-hfx').textContent = `${d.max_hfx_wm2.toFixed(0)} W/m²`;
    document.getElementById('ts-offset').textContent = `${point.offset_km.toFixed(1)} km`;

    // Update images
    updateSidebarImages(point);

    // Show
    sb.classList.add('open');

    // Let Leaflet recalculate into the smaller space
    if (trackMap) {
        setTimeout(() => trackMap.invalidateSize({ animate: true }), 420);
    }
}

function closeSidebar() {
    const sb = document.getElementById('track-sidebar');
    if (sb) sb.classList.remove('open');
    activePoint = null;

    // Let Leaflet reclaim the space
    if (trackMap) {
        setTimeout(() => trackMap.invalidateSize({ animate: true }), 420);
    }
}

function updateSidebarImages(point) {
    if (!point) return;
    const frame = point.timestep;

    const img1 = document.getElementById('ts-img1');
    const img2 = document.getElementById('ts-img2');
    const label1 = document.getElementById('ts-img1-label');
    const label2 = document.getElementById('ts-img2-label');

    if (img1) img1.src = buildImageUrl(sidebarProductA, 'Ian', frame);
    if (img2) img2.src = buildImageUrl(sidebarProductB, 'Ian', frame);
    if (label1) label1.textContent = sidebarProductA.replace('Enthalpy Fluxes - ', '');
    if (label2) label2.textContent = sidebarProductB.replace('Enthalpy Fluxes - ', '');
}

function initSidebarControls() {
    // Close button
    const closeBtn = document.getElementById('close-track-sidebar');
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const sb = document.getElementById('track-sidebar');
            if (sb && sb.classList.contains('open')) {
                closeSidebar();
                e.stopPropagation();
            }
        }
    });

    // Populate product selectors
    const selA = document.getElementById('ts-product-a');
    const selB = document.getElementById('ts-product-b');

    if (selA && selB) {
        SIDEBAR_PRODUCTS.forEach(name => {
            const optA = document.createElement('option');
            optA.value = name;
            optA.textContent = name;
            if (name === sidebarProductA) optA.selected = true;
            selA.appendChild(optA);

            const optB = document.createElement('option');
            optB.value = name;
            optB.textContent = name;
            if (name === sidebarProductB) optB.selected = true;
            selB.appendChild(optB);
        });

        selA.addEventListener('change', (e) => {
            sidebarProductA = e.target.value;
            if (activePoint) updateSidebarImages(activePoint);
        });

        selB.addEventListener('change', (e) => {
            sidebarProductB = e.target.value;
            if (activePoint) updateSidebarImages(activePoint);
        });
    }
}

// ===========================
//  FILTER SYSTEM
// ===========================

function applyFilter(filterKey) {
    activeFilter = filterKey;
    const f = FILTERS[filterKey];
    const values = trackData.map(f.extract);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    trackMarkerRefs.forEach(({ marker, point }) => {
        const val = f.extract(point);
        const t = normalizeValue(val, minV, maxV, f.invert);
        const color = intensityColor(t);
        const radius = intensityRadius(t);
        marker.setStyle({ fillColor: color, radius: radius });
        marker.unbindTooltip();
        marker.bindTooltip(`T${point.timestep}`, {
            permanent: false,
            direction: 'top',
            offset: [0, -radius - 4],
            className: 'tc-tooltip'
        });
    });

    trackLineSegments.forEach((line, i) => {
        const v1 = f.extract(trackData[i]);
        const v2 = f.extract(trackData[i + 1]);
        const avg = (v1 + v2) / 2;
        const t = normalizeValue(avg, minV, maxV, f.invert);
        line.setStyle({ color: intensityColor(t) });
    });

    updateLegend(filterKey, minV, maxV);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterKey);
    });
}

function updateLegend(filterKey, minV, maxV) {
    const f = FILTERS[filterKey];
    const titleEl = document.querySelector('.legend-title');
    const labelsEl = document.querySelector('.legend-labels');
    if (!titleEl || !labelsEl) return;

    titleEl.innerHTML = `<i class="${f.icon}"></i> ${f.label} (${f.unit})`;

    const midV = (minV + maxV) / 2;
    if (f.invert) {
        labelsEl.innerHTML = `<span>${f.formatVal(minV)}</span><span>${f.formatVal(midV)}</span><span>${f.formatVal(maxV)}</span>`;
    } else {
        labelsEl.innerHTML = `<span>${f.formatVal(maxV)}</span><span>${f.formatVal(midV)}</span><span>${f.formatVal(minV)}</span>`;
    }
}

function buildFilterControls() {
    const container = document.getElementById('map-filter-bar');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(FILTERS).forEach(([key, f]) => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (key === activeFilter ? ' active' : '');
        btn.dataset.filter = key;
        btn.innerHTML = `<i class="${f.icon}"></i><span>${f.label}</span>`;
        btn.addEventListener('click', () => applyFilter(key));
        container.appendChild(btn);
    });
}

// ===========================
//  MAP INITIALIZATION
// ===========================

async function initTrackMap() {
    const mapContainer = document.getElementById('track-map');
    if (!mapContainer || typeof L === 'undefined') return;

    // Load track data
    try {
        const response = await fetch('json/ian.json');
        if (!response.ok) throw new Error('Failed to load track data');
        trackData = await response.json();
    } catch (err) {
        console.error('Track data load error:', err);
        return;
    }

    // Init sidebar controls (selectors, close button)
    initSidebarControls();

    // Compute bounds from eyewall centers
    const eyewallCoords = trackData.map(p => [p.eyewall_refined_center.lat, p.eyewall_refined_center.lon]);
    const lats = eyewallCoords.map(c => c[0]);
    const lons = eyewallCoords.map(c => c[1]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

    // Create map
    trackMap = L.map('track-map', {
        center: [centerLat, centerLon],
        zoom: 7,
        zoomControl: true,
        attributionControl: true
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 14
    }).addTo(trackMap);

    // Filter ranges
    const f = FILTERS[activeFilter];
    const values = trackData.map(f.extract);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    // === Track line segments ===
    trackLineSegments = [];
    for (let i = 0; i < trackData.length - 1; i++) {
        const p1 = trackData[i];
        const p2 = trackData[i + 1];
        const avg = (f.extract(p1) + f.extract(p2)) / 2;
        const t = normalizeValue(avg, minV, maxV, f.invert);

        const seg = L.polyline(
            [
                [p1.eyewall_refined_center.lat, p1.eyewall_refined_center.lon],
                [p2.eyewall_refined_center.lat, p2.eyewall_refined_center.lon]
            ],
            {
                color: intensityColor(t),
                weight: 3.5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false
            }
        ).addTo(trackMap);
        trackLineSegments.push(seg);
    }

    // === Eyewall markers ===
    const markersLayer = L.layerGroup().addTo(trackMap);
    trackMarkerRefs = [];

    trackData.forEach((point) => {
        const val = f.extract(point);
        const t = normalizeValue(val, minV, maxV, f.invert);
        const color = intensityColor(t);
        const radius = intensityRadius(t);

        const marker = L.circleMarker(
            [point.eyewall_refined_center.lat, point.eyewall_refined_center.lon],
            {
                radius: radius,
                fillColor: color,
                fillOpacity: 0.85,
                color: 'rgba(255, 255, 255, 0.3)',
                weight: 1.5,
                className: 'track-marker-pressure'
            }
        );

        // Click → open sidebar (not popup)
        marker.on('click', () => openSidebar(point));

        marker.bindTooltip(`T${point.timestep}`, {
            permanent: false,
            direction: 'top',
            offset: [0, -radius - 4],
            className: 'tc-tooltip'
        });

        markersLayer.addLayer(marker);
        trackMarkerRefs.push({ marker, point });
    });

    // Fit bounds
    const bounds = L.latLngBounds(eyewallCoords);
    trackMap.fitBounds(bounds.pad(0.15));

    // Legend + filters
    updateLegend(activeFilter, minV, maxV);
    buildFilterControls();

    // Dismiss instruction on first sidebar open
    const origOpen = openSidebar;
    let instructionDismissed = false;
    // (handled inline — instruction hides after first click via CSS transition)
}

// === TOOLTIP STYLES ===
(function injectTooltipStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .tc-tooltip {
            background: rgba(10, 22, 40, 0.9) !important;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 212, 255, 0.3) !important;
            border-radius: 4px !important;
            padding: 2px 7px !important;
            font-family: var(--font-display) !important;
            font-size: 0.65rem !important;
            font-weight: 600 !important;
            letter-spacing: 0.06em !important;
            color: var(--accent-primary) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 10px rgba(0, 212, 255, 0.15) !important;
        }
        .tc-tooltip::before {
            border-top-color: rgba(10, 22, 40, 0.9) !important;
        }
    `;
    document.head.appendChild(style);
})();