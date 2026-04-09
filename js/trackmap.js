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
window.sidebar2DFilters = new Set();

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
    'Streamlines with Radial and Tangent Winds',
    'Enthalpy Fluxes - Radial',
    'Enthalpy Fluxes - Tangential',
    'Simulated Radar - Reflectivity',
    'Wind Speed (10m)'
];

// 3D sidebar product options (static preview images)
const SIDEBAR_3D_PRODUCTS = [
    '3d_Enthalpy Flux Isosurface',
    '3d_Thetae',
    '3d_Radar',
    '3d_Windspeed'
];

// Diagnostics sidebar product options (single full-width image, opens in 2D player)
const SIDEBAR_DIAGNOSTICS_PRODUCTS = [
    'Enthalpy Inflow Profile (Azimuthal)',
    'Enthalpy Radial Profile (Azimuthal)'
];

let currentSidebarMode = '2d';
let sidebar3DProduct = SIDEBAR_3D_PRODUCTS[0];
let sidebar3DFrame = 50; // current frame for 3D panel
let sidebarDiagnosticsProduct = 'Azimuthal Profile';

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
    // Try to use catalog first, fallback to hardcoded patterns
    if (window.catalog && window.catalog[stormName] && window.catalog[stormName][productName]) {
        const productConfig = window.catalog[stormName][productName];
        const stormLower = stormName.toLowerCase();
        
        let pattern;
        if (productConfig.patterns) {
            pattern = productConfig.patterns.base;
        } else if (productConfig.pattern) {
            pattern = productConfig.pattern;
        } else {
            console.warn('No pattern found for product in catalog');
            return '';
        }
        
        return pattern
            .replace(/{storm}/g, stormLower)
            .replace(/{frame}/g, frame);
    }
    
    // Fallback to hardcoded patterns
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

function buildSidebar3DImageUrl(productName, frame) {
    const stormName = 'Ian';
    const config = window.catalog?.[stormName]?.[productName];
    if (config) {
        const stormLower = stormName.toLowerCase();
        const f = frame || 50;

        // Prefer per-frame thumbnail if available
        if (config.thumbnailPattern) {
            return config.thumbnailPattern
                .replace(/{storm}/g, stormLower)
                .replace(/{frame}/g, f);
        }

        // Fall back to single static image
        if (config.staticImage) {
            return config.staticImage;
        }
    }

    const fallback = {
        '3d_Enthalpy Flux Isosurface': 'images/static/3d/3d_enthalpy_flux.png',
        '3d_Thetae': 'images/static/3d/3d_potential_temp.png',
        '3d_Radar': 'images/static/3d/3d_radar.png',
        '3d_Windspeed': 'images/static/3d/3d_wind.png'
    };
    return fallback[productName] || '';
}

// ===========================
//  SIDEBAR PANEL LOGIC
// ===========================

// Track the currently highlighted marker
let activeMarkerRef = null;
let activeMarkerOriginalStyle = null;

function highlightActiveMarker(point) {
    // Reset previous highlight
    clearActiveMarkerHighlight();

    // Find the marker for this point
    const ref = trackMarkerRefs.find(r => r.point.timestep === point.timestep);
    if (!ref) return;

    activeMarkerRef = ref.marker;
    // Save original style
    activeMarkerOriginalStyle = {
        color: ref.marker.options.color,
        weight: ref.marker.options.weight,
        fillOpacity: ref.marker.options.fillOpacity,
        radius: ref.marker.options.radius
    };
    // Apply highlight
    ref.marker.setStyle({
        color: '#00d4ff',
        weight: 3,
        fillOpacity: 1
    });
    ref.marker.setRadius(activeMarkerOriginalStyle.radius + 3);
    ref.marker.bringToFront();
}

function clearActiveMarkerHighlight() {
    if (activeMarkerRef && activeMarkerOriginalStyle) {
        activeMarkerRef.setStyle({
            color: activeMarkerOriginalStyle.color,
            weight: activeMarkerOriginalStyle.weight,
            fillOpacity: activeMarkerOriginalStyle.fillOpacity
        });
        activeMarkerRef.setRadius(activeMarkerOriginalStyle.radius);
        activeMarkerRef = null;
        activeMarkerOriginalStyle = null;
    }
}

function updateSidebarTimestepDetails(point) {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    if (!point) {
        setText('ts-timestep', '–');
        setText('ts-datetime', '–');
        setText('ts-lat', '–');
        setText('ts-lon', '–');
        setText('ts-pressure', '–');
        setText('ts-enthalpy', '–');
        return;
    }

    const lat = point.eyewall_refined_center.lat;
    const lon = point.eyewall_refined_center.lon;
    const d = point.diagnostics;

    setText('ts-timestep', `T${point.timestep}`);
    setText('ts-datetime', formatDatetime(point.datetime));
    setText('ts-lat', `${lat.toFixed(3)}°N`);
    setText('ts-lon', `${Math.abs(lon).toFixed(3)}°W`);
    setText('ts-pressure', `${d.min_pressure_hpa.toFixed(1)} hPa`);
    setText('ts-enthalpy', `${d.max_enthalpy_wm2.toFixed(0)} W/m²`);
}

function updateSidebarToggleIcon(isOpen) {
    const toggle = document.getElementById('sidebar-toggle');
    if (!toggle) return;
    const icon = toggle.querySelector('i');
    if (!icon) return;

    if (isOpen) {
        icon.className = 'fas fa-chevron-right';
        toggle.classList.add('active');
    } else {
        icon.className = 'fas fa-bars';
        toggle.classList.remove('active');
    }
}

function openSidebar(point) {
    console.log('openSidebar called with point:', point);
    activePoint = point;
    const sb = document.getElementById('track-sidebar');
    console.log('sidebar element:', sb);
    if (!sb) return;

    // Update map header subtitle with timestep + datetime
    const subtitleEl = document.getElementById('map-subtitle');
    if (subtitleEl) {
        subtitleEl.innerHTML = `T${point.timestep} &bull; ${formatDatetime(point.datetime)} &bull; Eyewall Refined Center`;
    }

    // Populate map header stats
    const latEl = document.getElementById('map-stat-lat');
    const lonEl = document.getElementById('map-stat-lon');
    const pressureEl = document.getElementById('map-stat-pressure');
    const enthalpyEl = document.getElementById('map-stat-enthalpy');
    const lhEl = document.getElementById('map-stat-lh');
    const hfxEl = document.getElementById('map-stat-hfx');

    if (latEl) latEl.textContent = `${point.eyewall_refined_center.lat.toFixed(3)}\u00B0N`;
    if (lonEl) lonEl.textContent = `${Math.abs(point.eyewall_refined_center.lon).toFixed(3)}\u00B0W`;

    const d = point.diagnostics;
    if (pressureEl) pressureEl.textContent = d.min_pressure_hpa.toFixed(1);
    if (enthalpyEl) enthalpyEl.textContent = d.max_enthalpy_wm2.toFixed(0);
    if (lhEl) lhEl.textContent = d.max_lh_wm2.toFixed(0);
    if (hfxEl) hfxEl.textContent = d.max_hfx_wm2.toFixed(0);

    // Update timestep detail card in sidebar
    updateSidebarTimestepDetails(point);

    // Update images
    updateSidebarImages(point);

    // Highlight active marker on map
    highlightActiveMarker(point);

    // Update toggle icon
    updateSidebarToggleIcon(true);

    // Show
    sb.classList.add('open');
    const main = document.getElementById('main-container');
    if (main) main.classList.add('sidebar-open');

    // Let Leaflet recalculate into the smaller space
    if (trackMap) {
        setTimeout(() => trackMap.invalidateSize({ animate: true }), 420);
    }
}

function closeSidebar() {
    const sb = document.getElementById('track-sidebar');
    if (sb) sb.classList.remove('open');
    const main = document.getElementById('main-container');
    if (main) main.classList.remove('sidebar-open');
    activePoint = null;

    // Clear marker highlight
    clearActiveMarkerHighlight();

    // Update toggle icon
    updateSidebarToggleIcon(false);

    // Reset map header to default
    const subtitleEl = document.getElementById('map-subtitle');
    if (subtitleEl) {
        subtitleEl.innerHTML = 'WRF Simulation &bull; Eyewall Refined Center &bull; 2022-09-28 02Z &ndash; 2022-09-29 00Z';
    }

    const dash = '\u2013';
    const statIds = ['map-stat-lat', 'map-stat-lon', 'map-stat-pressure', 'map-stat-enthalpy', 'map-stat-lh', 'map-stat-hfx'];
    statIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = dash;
    });
    updateSidebarTimestepDetails(null);
    // Let Leaflet reclaim the space
    if (trackMap) {
        setTimeout(() => trackMap.invalidateSize({ animate: true }), 420);
    }
}

function updateSidebarImages(point) {
    console.log('updateSidebarImages called with point:', point);
    if (!point) return;
    const frame = point.timestep;
    console.log('frame:', frame);

    const img1 = document.getElementById('ts-img1');
    const img2 = document.getElementById('ts-img2');
    const label1 = document.getElementById('ts-img1-label');
    const label2 = document.getElementById('ts-img2-label');

    if (currentSidebarMode === 'diagnostics') {
        const url = buildImageUrl(sidebarDiagnosticsProduct, 'Ian', frame);
        console.log('Sidebar diagnostics image:', { sidebarDiagnosticsProduct, frame, url, catalogLoaded: !!window.catalog });
        if (img1) {
            img1.src = url;
            img1.onload = () => console.log('Loaded diagnostics image:', url);
            img1.onerror = () => console.error('Failed to load diagnostics image:', url);
        }
        if (img2) {
            img2.src = '';
        }
        if (label1) label1.textContent = sidebarDiagnosticsProduct;
        if (label2) label2.textContent = '';
        return;
    }

    if (currentSidebarMode === '3d') {
        sidebar3DFrame = frame;
        const url = buildSidebar3DImageUrl(sidebar3DProduct, frame);

        console.log('Sidebar 3D image:', { sidebar3DProduct, frame, url, catalogLoaded: !!window.catalog });

        if (img1) {
            img1.src = url;
            img1.onerror = () => console.error('Failed to load 3D image:', url);
        }
        if (img2) {
            img2.src = '';
        }
        if (label1) label1.textContent = sidebar3DProduct.replace('3d_', '').replace(/_/g, ' ');
        if (label2) label2.textContent = '';
        return;
    }

    const url1 = buildImageUrl(sidebarProductA, 'Ian', frame);
    const url2 = buildImageUrl(sidebarProductB, 'Ian', frame);

    console.log('Sidebar images:', { sidebarProductA, sidebarProductB, frame, url1, url2, catalogLoaded: !!window.catalog });

    if (img1) {
        console.log('Setting img1 src to:', url1);
        img1.src = url1;
        img1.onerror = () => console.error('Failed to load image 1:', url1);
    }
    if (img2) {
        console.log('Setting img2 src to:', url2);
        img2.src = url2;
        img2.onerror = () => console.error('Failed to load image 2:', url2);
    }
    if (label1) label1.textContent = sidebarProductA.replace('Enthalpy Fluxes - ', '');
    if (label2) label2.textContent = sidebarProductB.replace('Enthalpy Fluxes - ', '');
}

function populateSidebarSelectors() {
    const selA = document.getElementById('ts-product-a');
    const selB = document.getElementById('ts-product-b');

    if (!selA || !selB) return;

    selA.innerHTML = '';
    selB.innerHTML = '';

    if (currentSidebarMode === '3d') {
        SIDEBAR_3D_PRODUCTS.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product.replace('3d_', '').replace(/_/g, ' ');
            if (product === sidebar3DProduct) {
                option.selected = true;
            }
            selA.appendChild(option);
        });

        // Hide second frame and its selector
        selB.style.display = 'none';
        const frame2 = document.querySelector('.ts-image-frame:nth-child(2)');
        if (frame2) frame2.style.display = 'none';
        const frame1 = document.querySelector('.ts-image-frame:nth-child(1)');
        if (frame1) frame1.style.display = 'flex';

        // Show first selector (already inside frame1)
        const selectors = document.querySelectorAll('.ts-image-selector');
        if (selectors[0]) selectors[0].style.display = 'block';
        if (selectors[1]) selectors[1].style.display = 'none';
        return;
    }

    if (currentSidebarMode === 'diagnostics') {
        // Show selector for diagnostics products (like 3D mode: single image + dropdown)
        SIDEBAR_DIAGNOSTICS_PRODUCTS.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            if (product === sidebarDiagnosticsProduct) {
                option.selected = true;
            }
            selA.appendChild(option);
        });

        selA.style.display = 'block';
        selB.style.display = 'none';
        const frame2 = document.querySelector('.ts-image-frame:nth-child(2)');
        if (frame2) frame2.style.display = 'none';
        const frame1 = document.querySelector('.ts-image-frame:nth-child(1)');
        if (frame1) frame1.style.display = 'flex';

        const selectors = document.querySelectorAll('.ts-image-selector');
        if (selectors[0]) selectors[0].style.display = 'block';
        if (selectors[1]) selectors[1].style.display = 'none';

        const label1 = document.getElementById('ts-img1-label');
        if (label1) label1.textContent = sidebarDiagnosticsProduct;
        return;
    }

    // 2D mode
    let filteredProducts = SIDEBAR_PRODUCTS;
    if (window.sidebar2DFilters && window.sidebar2DFilters.size > 0 && window.catalog && window.catalog['Ian']) {
        const catalog = window.catalog['Ian'];
        filteredProducts = SIDEBAR_PRODUCTS.filter(product => {
            const productConfig = catalog[product];
            return productConfig && productConfig.filters && productConfig.filters.some(f => window.sidebar2DFilters.has(f));
        });
    }

    // Check if current selections are still valid
    if (sidebarProductA && !filteredProducts.includes(sidebarProductA)) {
        sidebarProductA = filteredProducts[0] || SIDEBAR_PRODUCTS[0];
    }
    if (sidebarProductB && !filteredProducts.includes(sidebarProductB)) {
        sidebarProductB = filteredProducts[1] || SIDEBAR_PRODUCTS[1];
    }

    filteredProducts.forEach(product => {
        const optionA = document.createElement('option');
        optionA.value = product;
        optionA.textContent = product;
        if (product === sidebarProductA) optionA.selected = true;
        selA.appendChild(optionA);

        const optionB = document.createElement('option');
        optionB.value = product;
        optionB.textContent = product;
        if (product === sidebarProductB) optionB.selected = true;
        selB.appendChild(optionB);
    });
    selB.style.display = 'block';
    const frame2 = document.querySelector('.ts-image-frame:nth-child(2)');
    if (frame2) frame2.style.display = 'flex';
    const frame1 = document.querySelector('.ts-image-frame:nth-child(1)');
    if (frame1) frame1.style.display = 'flex';

    // Show both selectors
    const selectors = document.querySelectorAll('.ts-image-selector');
    if (selectors[0]) selectors[0].style.display = 'block';
    if (selectors[1]) selectors[1].style.display = 'block';
}

// Make populateSidebarSelectors globally accessible
window.populateSidebarSelectors = populateSidebarSelectors;

function refreshSidebarMode() {
    const buttons = document.querySelectorAll('.ts-mode-btn');
    buttons.forEach(btn => {
        if (btn.dataset.mode === currentSidebarMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const tsImages = document.querySelector('.ts-images');
    if (tsImages) {
        tsImages.classList.toggle('mode-3d', currentSidebarMode === '3d' || currentSidebarMode === 'diagnostics');
    }

    const filterBar = document.getElementById('ts-filter-bar');
    if (filterBar) {
        filterBar.style.display = currentSidebarMode === '2d' ? 'flex' : 'none';
    }

    if (currentSidebarMode === '3d') {
        sidebar3DProduct = sidebar3DProduct || SIDEBAR_3D_PRODUCTS[0];
        populateSidebarSelectors();
        if (activePoint) updateSidebarImages(activePoint);
    } else if (currentSidebarMode === 'diagnostics') {
        populateSidebarSelectors();
        if (activePoint) updateSidebarImages(activePoint);
    } else {
        populateSidebarSelectors();
        if (activePoint) updateSidebarImages(activePoint);
    }
}

function initSidebarControls() {
    console.log('initSidebarControls called');
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

    // Click handlers for sidebar images to open player
    const img1 = document.getElementById('ts-img1');
    const img2 = document.getElementById('ts-img2');
    
    if (img1) {
        img1.addEventListener('click', () => {
            if (currentSidebarMode === '3d') {
                console.log('Sidebar 3D image clicked, opening 3D viewer:', sidebar3DProduct, 'frame', sidebar3DFrame);
                if (typeof open3dViewer === 'function') {
                    open3dViewer(sidebar3DProduct, sidebar3DFrame);
                }
                return;
            }

            if (currentSidebarMode === 'diagnostics') {
                console.log('Diagnostics image clicked, opening player:', sidebarDiagnosticsProduct, activePoint?.timestep);
                if (activePoint && window.selectBothProductsAndJumpToFrame) {
                    // Pass null as product2 to signal single-view mode in the player
                    window.selectBothProductsAndJumpToFrame('Ian', sidebarDiagnosticsProduct, null, activePoint.timestep);
                    closeSidebar();
                }
                return;
            }

            console.log('Sidebar image clicked - opening both products:', sidebarProductA, sidebarProductB, activePoint?.timestep);
            if (activePoint && window.selectBothProductsAndJumpToFrame) {
                window.selectBothProductsAndJumpToFrame('Ian', sidebarProductA, sidebarProductB, activePoint.timestep);
                closeSidebar();
            }
        });
        img1.style.cursor = 'pointer'; // Make it clear it's clickable
    }
    
    if (img2) {
        img2.addEventListener('click', () => {
            if (currentSidebarMode === '3d') {
                return;
            }
            console.log('Sidebar image clicked - opening both products:', sidebarProductA, sidebarProductB, activePoint?.timestep);
            if (activePoint && window.selectBothProductsAndJumpToFrame) {
                window.selectBothProductsAndJumpToFrame('Ian', sidebarProductA, sidebarProductB, activePoint.timestep);
                closeSidebar();
            }
        });
        img2.style.cursor = 'pointer'; // Make it clear it's clickable
    }

    // Populate product selectors
    const selA = document.getElementById('ts-product-a');
    const selB = document.getElementById('ts-product-b');

    if (selA && selB) {
        selA.addEventListener('change', (e) => {
            if (currentSidebarMode === '3d') {
                sidebar3DProduct = e.target.value;
            } else if (currentSidebarMode === 'diagnostics') {
                sidebarDiagnosticsProduct = e.target.value;
                const label1 = document.getElementById('ts-img1-label');
                if (label1) label1.textContent = sidebarDiagnosticsProduct;
            } else {
                sidebarProductA = e.target.value;
            }
            if (activePoint) updateSidebarImages(activePoint);
        });

        selB.addEventListener('change', (e) => {
            sidebarProductB = e.target.value;
            if (activePoint) updateSidebarImages(activePoint);
        });
    }

    // Mode buttons toggle
    const modeButtons = document.querySelectorAll('.ts-mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentSidebarMode = btn.dataset.mode || '2d';
            refreshSidebarMode();
        });
    });

    // 2D filter pill toggles
    const filterButtons = document.querySelectorAll('.ts-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterKey = btn.dataset.filter;
            if (!filterKey) return;
            const isActive = btn.classList.toggle('active');
            if (isActive) {
                window.sidebar2DFilters.add(filterKey);
            } else {
                window.sidebar2DFilters.delete(filterKey);
            }
            console.log('2D filter toggled:', filterKey, isActive);
            // Update product menus based on active filters
            if (window.populateProductMenus) window.populateProductMenus();
            if (window.populateSidebarSelectors) window.populateSidebarSelectors();
        });
    });

    // Initialize selector contents and images
    refreshSidebarMode();
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
    console.log('initTrackMap called, L defined:', typeof L);
    const mapContainer = document.getElementById('track-map');
    if (!mapContainer || typeof L === 'undefined') {
        console.log('Map container or L not found:', { mapContainer, L: typeof L });
        return;
    }

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
        marker.on('click', () => {
            console.log('Marker clicked for point:', point);
            openSidebar(point);
        });

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

// === UTILITY FUNCTIONS ===
function buildImageUrl(productName, stormName, frame) {
    // Access the catalog from the global scope (loaded by app.js)
    if (!window.catalog || !window.catalog[stormName] || !window.catalog[stormName][productName]) {
        console.warn(`Product ${productName} not found in catalog`);
        return `images/${stormName.toLowerCase()}/placeholder_${frame}.png`;
    }
    
    const productConfig = window.catalog[stormName][productName];
    const stormLower = stormName.toLowerCase();
    
    // Use the same logic as generateImageArray in app.js
    let pattern;
    if (productConfig.hasOverlays && productConfig.patterns) {
        pattern = productConfig.patterns.base; // Use base pattern for sidebar previews
    } else if (productConfig.patterns && productConfig.patterns.base) {
        // No overlays but uses patterns object (e.g. diagnostics with only a base pattern)
        pattern = productConfig.patterns.base;
    } else if (productConfig.pattern) {
        pattern = productConfig.pattern;
    } else {
        console.warn('No pattern found for product');
        return `images/${stormLower}/placeholder_${frame}.png`;
    }
    
    const src = pattern
        .replace(/{storm}/g, stormLower)
        .replace(/{frame}/g, frame);
    
    return src;
}