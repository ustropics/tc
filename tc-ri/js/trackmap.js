// ============================================
// TRACK MAP MODULE
// Interactive Leaflet map for storm track data
// Eyewall Refined Center + sidebar detail panel
// ============================================

let trackMap = null;
let trackData = [];           // flattened, all storms combined (each point tagged with _storm)
let trackDataByStorm = {};    // storm name -> that storm's point array
let trackLineSegments = [];
let trackMarkerRefs = [];
let trackMarkersLayer = null;
let currentTrackStorm = 'Ian';
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

// Derive sidebar product lists from the split catalogs loaded by app.js
function getSidebar2DProducts(storm = currentTrackStorm) {
    return (window.catalog2d && window.catalog2d[storm])
        ? Object.keys(window.catalog2d[storm]) : [];
}
function getSidebar3DProducts(storm = currentTrackStorm) {
    return (window.catalog3d && window.catalog3d[storm])
        ? Object.keys(window.catalog3d[storm]) : [];
}
function getSidebarDiagProducts(storm = currentTrackStorm) {
    return (window.catalogDiag && window.catalogDiag[storm])
        ? Object.keys(window.catalogDiag[storm]) : [];
}

// Only diagnostic-derived filters require a `diagnostics` block per track point.
// Storms without diagnostics (e.g. Harvey) fall back to offset_km only.
function hasDiagnostics(data) {
    return Array.isArray(data) && data.length > 0 && !!data[0].diagnostics;
}
function getActiveFilters() {
    return hasDiagnostics(trackData) ? FILTERS : { offset_km: FILTERS.offset_km };
}

function defaultMapSubtitle() {
    const stormData = trackDataByStorm[currentTrackStorm] || [];
    if (!stormData.length) return 'WRF Simulation &bull; Eyewall Refined Center';
    const start = formatDatetime(stormData[0].datetime);
    const end = formatDatetime(stormData[stormData.length - 1].datetime);
    return `WRF Simulation &bull; Eyewall Refined Center &bull; ${start} &ndash; ${end}`;
}

let currentSidebarMode = '2d';
let sidebar3DProduct = null; // set lazily from catalog
let sidebar3DFrame = 50; // current frame for 3D panel
let sidebarDiagnosticsProduct = 'Enthalpy Inflow Profile (Azimuthal)';

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
    const stormName = currentTrackStorm;
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

    // Find the marker for this point (reference match — timesteps repeat across storms)
    const ref = trackMarkerRefs.find(r => r.point === point);
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
        setText('ts-lhf', '–');
        setText('ts-hfx', '–');
        return;
    }

    const lat = point.eyewall_refined_center.lat;
    const lon = point.eyewall_refined_center.lon;
    const d = point.diagnostics;

    setText('ts-timestep', `T${point.timestep}`);
    setText('ts-datetime', formatDatetime(point.datetime));
    setText('ts-lat', `${lat.toFixed(3)}°N`);
    setText('ts-lon', `${Math.abs(lon).toFixed(3)}°W`);
    setText('ts-pressure', d ? `${d.min_pressure_hpa.toFixed(1)} hPa` : '–');
    setText('ts-enthalpy', d ? `${d.max_enthalpy_wm2.toFixed(0)} W/m²` : '–');
    setText('ts-lhf', d ? `${d.max_lh_wm2.toFixed(0)} W/m²` : '–');
    setText('ts-hfx', d ? `${d.max_hfx_wm2.toFixed(0)} W/m²` : '–');
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
    if (pressureEl) pressureEl.textContent = d ? d.min_pressure_hpa.toFixed(1) : '\u2013';
    if (enthalpyEl) enthalpyEl.textContent = d ? d.max_enthalpy_wm2.toFixed(0) : '\u2013';
    if (lhEl) lhEl.textContent = d ? d.max_lh_wm2.toFixed(0) : '\u2013';
    if (hfxEl) hfxEl.textContent = d ? d.max_hfx_wm2.toFixed(0) : '\u2013';

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
        subtitleEl.innerHTML = defaultMapSubtitle();
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
        if (!sidebarDiagnosticsProduct) {
            if (img1) img1.src = '';
            if (img2) img2.src = '';
            if (label1) label1.textContent = '';
            if (label2) label2.textContent = '';
            return;
        }
        const url = buildImageUrl(sidebarDiagnosticsProduct, currentTrackStorm, frame);
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
        if (!sidebar3DProduct) {
            if (img1) img1.src = '';
            if (img2) img2.src = '';
            if (label1) label1.textContent = '';
            if (label2) label2.textContent = '';
            return;
        }
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

    if (!sidebarProductA && !sidebarProductB) {
        if (img1) img1.src = '';
        if (img2) img2.src = '';
        if (label1) label1.textContent = '';
        if (label2) label2.textContent = '';
        return;
    }

    const url1 = sidebarProductA ? buildImageUrl(sidebarProductA, currentTrackStorm, frame) : '';
    const url2 = sidebarProductB ? buildImageUrl(sidebarProductB, currentTrackStorm, frame) : '';

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
    if (label1) label1.textContent = sidebarProductA ? sidebarProductA.replace('Enthalpy Fluxes - ', '') : '';
    if (label2) label2.textContent = sidebarProductB ? sidebarProductB.replace('Enthalpy Fluxes - ', '') : '';
}

function populateSidebarSelectors() {
    const selA = document.getElementById('ts-product-a');
    const selB = document.getElementById('ts-product-b');

    if (!selA || !selB) return;

    selA.innerHTML = '';
    selB.innerHTML = '';

    if (currentSidebarMode === '3d') {
        const products3d = getSidebar3DProducts();
        if (!sidebar3DProduct) sidebar3DProduct = products3d[0] || null;
        products3d.forEach(product => {
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
        const diagProducts = getSidebarDiagProducts();
        if (!sidebarDiagnosticsProduct || !diagProducts.includes(sidebarDiagnosticsProduct)) {
            sidebarDiagnosticsProduct = diagProducts[0] || null;
        }
        diagProducts.forEach(product => {
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
    const allProducts2d = getSidebar2DProducts();
    let filteredProducts = allProducts2d;
    if (window.sidebar2DFilters && window.sidebar2DFilters.size > 0) {
        const stormCat = (window.catalog2d && window.catalog2d[currentTrackStorm]) || {};
        filteredProducts = allProducts2d.filter(product => {
            const cfg = stormCat[product];
            return cfg && cfg.filters && cfg.filters.some(f => window.sidebar2DFilters.has(f));
        });
    }

    // Check if current selections are still valid
    if (!sidebarProductA || !filteredProducts.includes(sidebarProductA)) {
        sidebarProductA = filteredProducts[0] || allProducts2d[0] || null;
    }
    if (!sidebarProductB || !filteredProducts.includes(sidebarProductB)) {
        sidebarProductB = filteredProducts[1] || allProducts2d[1] || null;
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

    // Update images if active point
    if (activePoint) updateSidebarImages(activePoint);
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
        sidebar3DProduct = sidebar3DProduct || getSidebar3DProducts()[0] || null;
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
                    window.selectBothProductsAndJumpToFrame(currentTrackStorm, sidebarDiagnosticsProduct, null, activePoint.timestep);
                    closeSidebar();
                }
                return;
            }

            console.log('Sidebar image clicked - opening both products:', sidebarProductA, sidebarProductB, activePoint?.timestep);
            if (activePoint && window.selectBothProductsAndJumpToFrame) {
                window.selectBothProductsAndJumpToFrame(currentTrackStorm, sidebarProductA, sidebarProductB, activePoint.timestep);
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
                window.selectBothProductsAndJumpToFrame(currentTrackStorm, sidebarProductA, sidebarProductB, activePoint.timestep);
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
    const activeSet = getActiveFilters();
    if (!activeSet[filterKey]) filterKey = Object.keys(activeSet)[0];
    activeFilter = filterKey;
    const f = activeSet[filterKey];
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

    trackLineSegments.forEach(({ line, p1, p2 }) => {
        const v1 = f.extract(p1);
        const v2 = f.extract(p2);
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
    Object.entries(getActiveFilters()).forEach(([key, f]) => {
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

// Derives the displayable timestep window for a storm from its 2D catalog
// entries (min frameStart / max frameEnd across all products). Returns null
// if the catalog isn't loaded yet or has no entries for this storm — callers
// should treat null as "no restriction."
function getStormFrameRange(storm) {
    const products = (window.catalog2d && window.catalog2d[storm]) || {};
    const configs = Object.values(products);
    if (configs.length === 0) return null;
    const start = Math.min(...configs.map(cfg => cfg.frameStart));
    const end = Math.max(...configs.map(cfg => cfg.frameEnd));
    return { start, end };
}

async function loadTrackDataForStorm(storm) {
    const response = await fetch(`json/${storm.toLowerCase()}.json`);
    if (!response.ok) throw new Error(`Failed to load track data for ${storm}`);
    const data = await response.json();
    const range = getStormFrameRange(storm);
    const filtered = range ? data.filter(p => p.timestep >= range.start && p.timestep <= range.end) : data;
    filtered.forEach(p => { p._storm = storm; });
    return filtered;
}

// Renders every loaded storm's track (trackDataByStorm) onto the map at once.
// Color scale (via activeFilter) is computed globally across all storms so
// intensity is comparable storm-to-storm; polylines never connect across a
// storm boundary.
function renderTrackLayer() {
    const activeSet = getActiveFilters();
    if (!activeSet[activeFilter]) activeFilter = Object.keys(activeSet)[0];
    const f = activeSet[activeFilter];
    const values = trackData.map(f.extract);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    const storms = Object.keys(trackDataByStorm);

    // === Track line segments (per-storm, never bridging storms) ===
    trackLineSegments = [];
    storms.forEach(storm => {
        const stormData = trackDataByStorm[storm];
        for (let i = 0; i < stormData.length - 1; i++) {
            const p1 = stormData[i];
            const p2 = stormData[i + 1];
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
            trackLineSegments.push({ line: seg, p1, p2 });
        }
    });

    // === Eyewall markers (all storms) ===
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

        // Click → switch active storm (if needed) and open sidebar
        marker.on('click', () => {
            console.log('Marker clicked for point:', point);
            if (point._storm && point._storm !== currentTrackStorm) {
                setActiveTrackStorm(point._storm, { skipAutoOpen: true });
            }
            openSidebar(point);
        });

        marker.bindTooltip(`${point._storm ? point._storm + ' ' : ''}T${point.timestep}`, {
            permanent: false,
            direction: 'top',
            offset: [0, -radius - 4],
            className: 'tc-tooltip'
        });

        markersLayer.addLayer(marker);
        trackMarkerRefs.push({ marker, point });
    });
    trackMarkersLayer = markersLayer;

    // Fit bounds across all storms
    const eyewallCoords = trackData.map(p => [p.eyewall_refined_center.lat, p.eyewall_refined_center.lon]);
    const bounds = L.latLngBounds(eyewallCoords);
    trackMap.fitBounds(bounds.pad(0.15));

    // Legend + filters
    updateLegend(activeFilter, minV, maxV);
    buildFilterControls();
}

async function initTrackMap() {
    console.log('initTrackMap called, L defined:', typeof L);
    const mapContainer = document.getElementById('track-map');
    if (!mapContainer || typeof L === 'undefined') {
        console.log('Map container or L not found:', { mapContainer, L: typeof L });
        return;
    }

    // Load every storm's track data up front so all tracks render at once.
    const storms = Object.keys(window.catalog2d || {});
    if (storms.length === 0) storms.push(currentTrackStorm);

    try {
        const results = await Promise.all(storms.map(loadTrackDataForStorm));
        trackDataByStorm = {};
        storms.forEach((storm, i) => { trackDataByStorm[storm] = results[i]; });
        trackData = storms.flatMap(storm => trackDataByStorm[storm]);
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
        zoomControl: false,
        attributionControl: true
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(trackMap);

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_29z8_1_dd56492c1a58674cb1190a74', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 14
    }).addTo(trackMap);

    renderTrackLayer();

    // Expose for external auto-selection
    window.openSidebar = openSidebar;
    window.trackData = trackData;
    window.trackDataByStorm = trackDataByStorm;
}

// All storms' tracks stay drawn on the map permanently — "switching storm"
// now only changes which storm the sidebar/product-viewer is focused on.
// Called both from the storm dropdown (via app.js selectStorm) and from
// clicking a track marker belonging to a different storm.
function setActiveTrackStorm(storm, { skipAutoOpen = false } = {}) {
    if (!trackMap || storm === currentTrackStorm || !trackDataByStorm[storm]) return;

    closeSidebar();
    currentTrackStorm = storm;

    // Reset sidebar product selections — old storm's product names may not
    // exist under the new storm's catalog entries.
    sidebarProductA = null;
    sidebarProductB = null;
    sidebar3DProduct = null;
    sidebarDiagnosticsProduct = null;

    refreshSidebarMode();

    const titleEl = document.getElementById('map-title');
    if (titleEl) titleEl.textContent = `Hurricane ${storm}`;

    // Callers that are about to open a specific point themselves (e.g. a
    // marker click) skip this — no point opening the first timestep just
    // to immediately replace it.
    if (skipAutoOpen) return;

    // Jump straight to the new storm's first timestep — but only when the
    // map view is actually showing. If the product comparison player is
    // open instead, leave it alone.
    const placeholderEl = document.getElementById('placeholder');
    const isMapViewActive = placeholderEl && placeholderEl.style.display !== 'none';
    const stormData = trackDataByStorm[storm];
    if (stormData.length > 0 && isMapViewActive) {
        openSidebar(stormData[0]);
    } else {
        const subtitleEl = document.getElementById('map-subtitle');
        if (subtitleEl) subtitleEl.innerHTML = defaultMapSubtitle();
    }
}
window.switchTrackMapStorm = setActiveTrackStorm;

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
        .replace(/{model}/g, 'cpl')
        .replace(/{frame}/g, frame);

    return src;
}