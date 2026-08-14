// ============================================
// TROPICAL CYCLONE RI CASE STUDIES
// Modern JavaScript Controller
// ============================================

// === STATE ===
let catalog = {};              // Loaded from JSON
let images1 = [];              // Primary product
let images2 = [];              // Secondary product (optional)
let current = 0;
let playing = false;
let speed = 1;
let timer = null;
let preservedIndex = 0;
let activeDropdown = null;
let selectedStorm = '';
let selectedProduct1 = '';
let selectedProduct2 = '';
let mobileShowingPlayer = false;

// Make catalog globally accessible for trackmap.js
window.catalog = catalog;

// Analysis lightbox state
let lightboxProduct = null;
let lightboxIndex = 0;
let lightboxStorm = '';

// Overlay states for each viewer
let overlayState = {
    primary: { wind: false, rings: false, model: 'cpl' },
    compare: { wind: false, rings: false, model: 'cpl' },
    single: { wind: false, rings: false, model: 'cpl' }
};

// === DOM ELEMENTS ===
const els = {
    // Views
    slide1:      document.getElementById('current-slide-1'),
    slide2:      document.getElementById('current-slide-2'),
    single:      document.getElementById('current-slide'),
    dualView:    document.getElementById('dual-view'),
    singleView:  document.getElementById('single-view'),
    placeholder: document.getElementById('placeholder'),

    // Close buttons
    closePlayer: document.getElementById('close-player'),
    closePlayer2: document.getElementById('close-player-2'),
    closePlayerSingle: document.getElementById('close-player-single'),

    // Frame titles
    frameTitle1: document.getElementById('frame-title-1'),
    frameTitle2: document.getElementById('frame-title-2'),
    frameTitleSingle: document.getElementById('frame-title-single'),

    // Progress
    progress:        document.getElementById('progress-fill'),
    thumb:           document.getElementById('progress-thumb'),
    slider:          document.getElementById('progress-slider'),
    progressWrapper: document.getElementById('progress-wrapper'),

    // Player controls
    playerControls:   document.getElementById('player-controls'),
    siteTitle:        document.getElementById('site-title'),
    mobileNavToggle:  document.getElementById('mobile-nav-toggle'),
    navButtons:       document.querySelector('.nav-buttons'),
    playPause:      document.getElementById('play-pause'),
    prevBtn:        document.getElementById('prev'),
    nextBtn:        document.getElementById('next'),
    speedSlider:    document.getElementById('speed'),
    speedValue:     document.getElementById('speed-value'),
    loopCheckbox:   document.getElementById('loop'),

    // Counters
    status:  document.getElementById('status'),
    count:   document.getElementById('image-count'),
    curNum:  document.getElementById('current-num'),

    // Navigation buttons
    stormBtn:    document.getElementById('storm-btn'),
    product1Btn: document.getElementById('product1-btn'),
    product2Btn: document.getElementById('product2-btn'),
    view3dBtn:   document.getElementById('view3d-btn'),
    analysisBtn: document.getElementById('analysis-btn'),

    // Navigation values
    stormValue:    document.getElementById('storm-value'),
    product1Value: document.getElementById('product1-value'),
    product2Value: document.getElementById('product2-value'),
    view3dValue:   document.getElementById('view3d-value'),

    // Dropdown menus
    stormMenu:    document.getElementById('storm-menu'),
    product1Menu: document.getElementById('product1-menu'),
    product2Menu: document.getElementById('product2-menu'),
    view3dMenu:   document.getElementById('view3d-menu'),

    // Dropdown options containers
    stormOptions:    document.getElementById('storm-options'),
    product1Options: document.getElementById('product1-options'),
    product2Options: document.getElementById('product2-options'),
    view3dOptions:   document.getElementById('view3d-options'),

    // About panel
    about:        document.getElementById('about-panel'),
    aboutOverlay: document.getElementById('about-overlay'),
    aboutBtn:     document.getElementById('about-btn'),
    closeAbout:   document.getElementById('close-about'),

    // Analysis overlay
    analysisOverlay:   document.getElementById('analysis-overlay'),
    analysisGrid:      document.getElementById('analysis-grid'),
    analysisTitle:     document.getElementById('analysis-title'),
    closeAnalysis:     document.getElementById('close-analysis'),

    // Lightbox
    lightboxOverlay:   document.getElementById('lightbox-overlay'),
    lightboxImage:     document.getElementById('lightbox-image'),
    lightboxLabel:     document.getElementById('lightbox-label'),
    lightboxPrevBtn:   document.getElementById('lightbox-prev'),
    lightboxNextBtn:   document.getElementById('lightbox-next'),
    closeLightbox:     document.getElementById('close-lightbox'),

    // 3D Viewer
    viewer3dOverlay:   document.getElementById('viewer-3d-overlay'),
    viewer3dIframe:    document.getElementById('viewer-3d-iframe'),
    viewer3dLabel:     document.getElementById('viewer-3d-label'),
    viewer3dFrameNum:  document.getElementById('viewer-3d-frame-num'),
    close3dViewer:     document.getElementById('close-3d-viewer'),
    viewer3dLoader:    document.getElementById('viewer-3d-loader'),

    // Overlay controls
    overlayControls1:    document.getElementById('overlay-controls-1'),
    overlayControls2:    document.getElementById('overlay-controls-2'),
    overlayControlsSingle: document.getElementById('overlay-controls-single'),
    windVectors1:        document.getElementById('wind-vectors-1'),
    radialRings1:        document.getElementById('radial-rings-1'),
    windVectors2:        document.getElementById('wind-vectors-2'),
    radialRings2:        document.getElementById('radial-rings-2'),
    windVectorsSingle:   document.getElementById('wind-vectors-single'),
    radialRingsSingle:   document.getElementById('radial-rings-single'),
    modelCpl1:      document.getElementById('model-cpl-1'),
    modelUncpl1:    document.getElementById('model-uncpl-1'),
    modelSpray1:    document.getElementById('model-spray-1'),
    modelCpl2:      document.getElementById('model-cpl-2'),
    modelUncpl2:    document.getElementById('model-uncpl-2'),
    modelSpray2:    document.getElementById('model-spray-2'),
    modelCplSingle:   document.getElementById('model-cpl-single'),
    modelUncplSingle: document.getElementById('model-uncpl-single'),
    modelSpraySingle: document.getElementById('model-spray-single')
};

// === LOAD CATALOG ===
async function loadCatalog() {
    console.log('loadCatalog called');
    try {
        updateStatus('Loading catalog...', 'loading');
        const [res2d, res3d, resDiag, resAnalysis] = await Promise.all([
            fetch('json/catalog_2d.json'),
            fetch('json/catalog_3d.json'),
            fetch('json/catalog_diag.json'),
            fetch('json/catalog_analysis.json')
        ]);
        if (!res2d.ok || !res3d.ok || !resDiag.ok || !resAnalysis.ok) {
            throw new Error('Failed to fetch one or more catalog files');
        }
        const [cat2d, cat3d, catDiag, catAnalysis] = await Promise.all([
            res2d.json(), res3d.json(), resDiag.json(), resAnalysis.json()
        ]);

        // Expose each catalog separately for trackmap.js
        window.catalog2d       = cat2d;
        window.catalog3d       = cat3d;
        window.catalogDiag     = catDiag;
        window.catalogAnalysis = catAnalysis;

        // Merge into a single catalog for backward-compatible lookups
        catalog = {};
        for (const storm of new Set([...Object.keys(cat2d), ...Object.keys(cat3d), ...Object.keys(catDiag), ...Object.keys(catAnalysis)])) {
            catalog[storm] = {
                ...(cat2d[storm]       || {}),
                ...(cat3d[storm]       || {}),
                ...(catDiag[storm]     || {}),
                ...(catAnalysis[storm] || {})
            };
        }
        window.catalog = catalog;

        console.log('Catalogs loaded:', Object.keys(catalog));
        updateStatus('Catalog loaded', 'success');
        populateStormMenu();
    } catch (error) {
        console.error('Failed to load catalog:', error);
        updateStatus('Failed to load catalog', 'error');
    }
}

// === UTILITIES ===
function updateStatus(message, type = 'info') {
    // Status toast removed — log to console instead
    console.log(`[${type}] ${message}`);
}

// Determine which pattern to use based on overlay state
function getPatternKey(viewerType) {
    const state = overlayState[viewerType];
    if (state.wind && state.rings) return 'full';
    if (state.wind) return 'wind';
    if (state.rings) return 'rings';
    return 'base';
}

// Generate image array from pattern with overlay support
function generateImageArray(productConfig, stormName, viewerType = 'primary') {
    const images = [];
    const stormLower = stormName.toLowerCase();
    const model = overlayState[viewerType]?.model || 'cpl';

    // Determine which pattern to use
    let pattern;
    if (productConfig.hasOverlays && productConfig.patterns) {
        const patternKey = getPatternKey(viewerType);
        pattern = productConfig.patterns[patternKey];
    } else if (productConfig.patterns && productConfig.patterns.base) {
        // No overlays but uses patterns object (e.g. diagnostics with only a base pattern)
        pattern = productConfig.patterns.base;
    } else if (productConfig.pattern) {
        pattern = productConfig.pattern;
    } else {
        console.warn('No pattern found for product');
        return images;
    }

    for (let frame = productConfig.frameStart; frame <= productConfig.frameEnd; frame++) {
        const src = pattern
            .replace(/{storm}/g, stormLower)
            .replace(/{model}/g, model)
            .replace(/{frame}/g, frame);

        const title = productConfig.titlePattern
            .replace(/{storm}/g, stormName)
            .replace(/{frame}/g, frame);
        
        images.push({ src, title });
    }
    
    return images;
}

// === SHOW/HIDE PLAYER CONTROLS ===
function isMobile() {
    return window.innerWidth <= 767;
}

function showPlayerControls() {
    els.progressWrapper.style.display = 'block';
    if (isMobile()) {
        // Mobile: default to player controls visible
        els.siteTitle.style.display = 'none';
        els.playerControls.style.display = 'flex';
        els.navButtons.style.display = 'none';
        els.mobileNavToggle.style.display = 'flex';
        mobileShowingPlayer = true;
        els.mobileNavToggle.querySelector('i').className = 'fas fa-chevron-left';
    } else {
        els.siteTitle.style.display = 'none';
        els.playerControls.style.display = 'flex';
    }
}

function hidePlayerControls() {
    els.siteTitle.style.display = 'flex';
    els.playerControls.style.display = 'none';
    els.progressWrapper.style.display = 'none';
    els.mobileNavToggle.style.display = 'none';
    els.navButtons.style.display = '';
    mobileShowingPlayer = false;
}

// === OVERLAY CONTROLS VISIBILITY ===
function updateOverlayControlsVisibility(viewerType, product) {
    let controlsEl;
    switch (viewerType) {
        case 'primary':
            controlsEl = els.overlayControls1;
            break;
        case 'compare':
            controlsEl = els.overlayControls2;
            break;
        case 'single':
            controlsEl = els.overlayControlsSingle;
            break;
    }
    
    if (!controlsEl) return;
    
    // Check if product supports overlays
    if (product && selectedStorm && catalog[selectedStorm] && catalog[selectedStorm][product]) {
        const productConfig = catalog[selectedStorm][product];
        if (productConfig.hasOverlays) {
            controlsEl.style.display = 'flex';
            return;
        }
    }
    
    controlsEl.style.display = 'none';
}

// === DROPDOWN MENU SYSTEM ===
function closeAllDropdowns() {
    document.querySelectorAll('.nav-dropdown').forEach(menu => {
        menu.classList.remove('open');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    activeDropdown = null;
}

function toggleDropdown(btn, menu) {
    const isOpen = menu.classList.contains('open');
    closeAllDropdowns();
    
    if (!isOpen && !btn.disabled) {
        menu.classList.add('open');
        btn.classList.add('active');
        activeDropdown = menu;
    }
}

function createDropdownItem(value, label, icon = null) {
    const item = document.createElement('button');
    item.className = 'dropdown-item';
    item.dataset.value = value;
    
    if (icon) {
        item.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
    } else {
        item.innerHTML = `<span>${label}</span>`;
    }
    
    return item;
}

// === POPULATE MENUS ===
function populateStormMenu() {
    els.stormOptions.innerHTML = '';
    
    Object.keys(catalog).sort().reverse().forEach(storm => {
        const item = createDropdownItem(storm, storm, 'fas fa-hurricane');
        item.onclick = () => selectStorm(storm);
        els.stormOptions.appendChild(item);
    });
    
    updateStatus('Select storm and product', 'success');
}

function populateProductMenus() {
    els.product1Options.innerHTML = '';
    els.product2Options.innerHTML = '';
    els.view3dOptions.innerHTML = '';
    
    if (!selectedStorm) return;

    // Pull products directly from the split catalogs
    let products2d = (window.catalog2d && window.catalog2d[selectedStorm])
        ? Object.keys(window.catalog2d[selectedStorm]).sort() : [];
    const products3d = (window.catalog3d && window.catalog3d[selectedStorm])
        ? Object.keys(window.catalog3d[selectedStorm]).sort() : [];
    
    // Filter 2D products based on active sidebar filters
    if (window.sidebar2DFilters && window.sidebar2DFilters.size > 0) {
        const cat2d = (window.catalog2d && window.catalog2d[selectedStorm]) || {};
        products2d = products2d.filter(product => {
            const productConfig = cat2d[product];
            return productConfig && productConfig.filters && productConfig.filters.some(f => window.sidebar2DFilters.has(f));
        });
    }
    
    // Check if current selections are still valid
    if (selectedProduct1 && !products2d.includes(selectedProduct1)) {
        selectedProduct1 = '';
        els.product1Value.textContent = 'Select';
    }
    if (selectedProduct2 && selectedProduct2 !== 'none' && !products2d.includes(selectedProduct2)) {
        selectedProduct2 = '';
        els.product2Value.textContent = 'None';
    }
    
    // Populate primary product menu
    products2d.forEach(product => {
        const item = createDropdownItem(product, product, 'fas fa-image');
        item.onclick = () => selectProduct1(product);
        els.product1Options.appendChild(item);
    });
    
    // Populate secondary product menu (with "None" option)
    const noneItem = createDropdownItem('none', 'None (Single View)', 'fas fa-minus-circle');
    noneItem.onclick = () => selectProduct2('none');
    els.product2Options.appendChild(noneItem);
    
    products2d.forEach(product => {
        const item = createDropdownItem(product, product, 'fas fa-image');
        item.onclick = () => selectProduct2(product);
        els.product2Options.appendChild(item);
    });
    
    // Populate 3D view menu
    products3d.forEach(product => {
        const displayName = product.replace('3d_', '').replace(/_/g, ' ');
        const item = createDropdownItem(product, displayName, 'fas fa-cube');
        item.onclick = () => select3dView(product);
        els.view3dOptions.appendChild(item);
    });
}

// Make populateProductMenus globally accessible
window.populateProductMenus = populateProductMenus;

// === SELECTION HANDLERS ===
function selectStorm(storm) {
    // Carry the same product selection(s) over to the new storm if they
    // exist there, so switching storms stays in the image player on the
    // first timestep instead of dropping back to the placeholder map view.
    const prevProduct1 = selectedProduct1;
    const prevProduct2 = selectedProduct2;
    const canKeepProduct1 = !!(prevProduct1 && catalog[storm] && catalog[storm][prevProduct1]);
    const canKeepProduct2 = !!(prevProduct2 && catalog[storm] && catalog[storm][prevProduct2]);

    selectedStorm = storm;
    selectedProduct1 = '';
    selectedProduct2 = '';

    // Reset overlay states
    overlayState = {
        primary: { wind: false, rings: false, model: 'cpl' },
        compare: { wind: false, rings: false, model: 'cpl' },
        single: { wind: false, rings: false, model: 'cpl' }
    };
    resetOverlayCheckboxes();

    els.stormValue.textContent = storm;
    els.product1Value.textContent = 'Select';
    els.product2Value.textContent = 'None';
    els.view3dValue.textContent = 'Select';

    // Enable product buttons
    els.product1Btn.disabled = false;
    els.product2Btn.disabled = false;
    els.view3dBtn.disabled = false;
    if (els.analysisBtn) els.analysisBtn.disabled = false;

    populateProductMenus();
    closeAllDropdowns();

    preservedIndex = 0;

    if (canKeepProduct1) {
        selectedProduct1 = prevProduct1;
        els.product1Value.textContent = truncateText(prevProduct1, 15);
        loadProduct(1);
        updateOverlayControlsVisibility('primary', prevProduct1);
        updateOverlayControlsVisibility('single', prevProduct1);
    }

    if (canKeepProduct2) {
        selectedProduct2 = prevProduct2;
        els.product2Value.textContent = truncateText(prevProduct2, 15);
        loadProduct(2);
        updateOverlayControlsVisibility('compare', prevProduct2);
    }

    if (canKeepProduct1 || canKeepProduct2) {
        updateViewMode();
    } else {
        resetPlayer();
    }

    if (window.switchTrackMapStorm) window.switchTrackMapStorm(storm);
}

function selectProduct1(product) {
    selectedProduct1 = product;
    els.product1Value.textContent = truncateText(product, 15);
    
    closeAllDropdowns();
    loadProduct(1);
    updateViewMode();
    
    // Update overlay controls visibility
    updateOverlayControlsVisibility('primary', product);
    updateOverlayControlsVisibility('single', product);
}

function selectProduct2(product) {
    if (product === 'none' || product === '') {
        selectedProduct2 = '';
        els.product2Value.textContent = 'None';
        images2 = [];
        if (els.frameTitle2) els.frameTitle2.textContent = '--';
        updateOverlayControlsVisibility('compare', null);
        closeAllDropdowns();
        updateViewMode();
        return;
    }
    
    selectedProduct2 = product;
    els.product2Value.textContent = truncateText(product, 15);
    
    closeAllDropdowns();
    loadProduct(2);
    updateViewMode();
    
    // Update overlay controls visibility
    updateOverlayControlsVisibility('compare', product);
}

function select3dView(view) {
    closeAllDropdowns();
    open3dViewer(view);
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '...';
}

// === OVERLAY CHECKBOX HANDLERS ===
function resetOverlayCheckboxes() {
    if (els.windVectors1) els.windVectors1.checked = false;
    if (els.radialRings1) els.radialRings1.checked = false;
    if (els.windVectors2) els.windVectors2.checked = false;
    if (els.radialRings2) els.radialRings2.checked = false;
    if (els.windVectorsSingle) els.windVectorsSingle.checked = false;
    if (els.radialRingsSingle) els.radialRingsSingle.checked = false;
    if (els.modelCpl1) els.modelCpl1.checked = true;
    if (els.modelCpl2) els.modelCpl2.checked = true;
    if (els.modelCplSingle) els.modelCplSingle.checked = true;
}

function handleOverlayChange(viewerType, overlayType, checked) {
    overlayState[viewerType][overlayType] = checked;
    
    // Reload images with new overlay state
    if (viewerType === 'primary' || viewerType === 'single') {
        if (selectedProduct1) {
            reloadProductImages(1, viewerType === 'single' ? 'single' : 'primary');
        }
    } else if (viewerType === 'compare') {
        if (selectedProduct2) {
            reloadProductImages(2, 'compare');
        }
    }
}

function reloadProductImages(which, viewerType) {
    const product = which === 1 ? selectedProduct1 : selectedProduct2;
    if (!selectedStorm || !product || !catalog[selectedStorm] || !catalog[selectedStorm][product]) return;
    
    const productConfig = catalog[selectedStorm][product];
    if (!productConfig || productConfig.type !== '2d') return;
    
    const generatedImages = generateImageArray(productConfig, selectedStorm, viewerType);
    
    if (which === 1) {
        images1 = generatedImages;
    } else {
        images2 = generatedImages;
    }
    
    // Update current frame display
    show(current);
}

// === 3D VIEW STATE ===
let current3dView = null;
let view3dBaseUrl = '';

// === 3D VIEWER FUNCTIONS ===
function showLoader3d() {
    if (els.viewer3dLoader) {
        els.viewer3dLoader.classList.add('visible');
    }
}

function hideLoader3d() {
    if (els.viewer3dLoader) {
        els.viewer3dLoader.classList.remove('visible');
    }
}

function open3dViewer(view, frameOverride = null) {
    let stormName = selectedStorm || 'Ian';
    if (!catalog[stormName] || !catalog[stormName][view]) {
        console.warn('3D view not found:', { stormName, view });
        return;
    }

    if (selectedStorm !== stormName) {
        // Keep global selected storm in sync for player state and product menus
        if (typeof selectStorm === 'function') {
            selectStorm(stormName);
        } else {
            selectedStorm = stormName;
        }
    }

    current3dView = view;
    const productConfig = catalog[stormName][view];
    view3dBaseUrl = productConfig.pattern;

    // Determine frame to use (explicit override > player frame) from current context
    let frameNum = 50; // fallback

    if (frameOverride !== null && frameOverride !== undefined) {
        frameNum = Number(frameOverride);
    } else if (images1.length > 0 && images1[current]) {
        const match = images1[current].src.match(/_(\d+)\.(png|jpg|webp)$/i);
        if (match) {
            frameNum = parseInt(match[1], 10);
        }
    }

    // Build the iframe URL - replace {frame} and {storm} placeholders
    const stormLower = selectedStorm.toLowerCase();
    let iframeUrl = view3dBaseUrl.replace(/{frame}/g, frameNum);
    iframeUrl = iframeUrl.replace(/{storm}/g, stormLower);

    // Update UI
    els.viewer3dLabel.textContent = view.replace('3d_', '').replace(/_/g, ' ');
    els.viewer3dFrameNum.textContent = frameNum;
    els.view3dValue.textContent = truncateText(view.replace('3d_', '').replace(/_/g, ' '), 10);

    // Show loading animation before loading iframe
    showLoader3d();

    // Set up load event listener for iframe
    els.viewer3dIframe.onload = function() {
        hideLoader3d();
    };

    els.viewer3dIframe.src = iframeUrl;

    // Show overlay
    els.viewer3dOverlay.classList.add('open');

    // Pause playback while 3D view is open
    if (playing) pause();
}

function close3dViewer() {
    hideLoader3d();
    els.viewer3dOverlay.classList.remove('open');
    els.viewer3dIframe.src = '';
    els.view3dValue.textContent = 'Select';
    current3dView = null;
}

function update3dViewerFrame() {
    if (!els.viewer3dOverlay.classList.contains('open')) return;
    if (!current3dView || !view3dBaseUrl) return;

    // Determine frame from current 3D sidebar selection or 2D playback
    let frameNum = sidebar3DFrame || 50;
    if (images1.length > 0 && images1[current]) {
        const match = images1[current].src.match(/_(\d+)\.(png|jpg|webp)$/i);
        if (match) {
            frameNum = parseInt(match[1], 10);
        }
    }

    // Replace both {frame} and {storm} placeholders
    const stormLower = selectedStorm.toLowerCase();
    let iframeUrl = view3dBaseUrl.replace(/{frame}/g, frameNum);
    iframeUrl = iframeUrl.replace(/{storm}/g, stormLower);

    els.viewer3dFrameNum.textContent = frameNum;

    // Show loading while frame loads
    showLoader3d();
    els.viewer3dIframe.onload = function() {
        hideLoader3d();
    };

    els.viewer3dIframe.src = iframeUrl;
}

// Load a product (1 or 2)
function loadProduct(which) {
    const product = which === 1 ? selectedProduct1 : selectedProduct2;
    const target = which === 1 ? images1 : images2;
    const viewerType = which === 1 ? 'primary' : 'compare';

    if (!selectedStorm || !product) return;
    
    const productConfig = catalog[selectedStorm][product];
    
    if (!productConfig || productConfig.type !== '2d') {
        console.warn(`Product ${product} not found or not a 2D product`);
        return;
    }

    try {
        updateStatus(`Loading ${product}...`, 'loading');
        
        // Generate images array from pattern with overlay support
        const generatedImages = generateImageArray(productConfig, selectedStorm, viewerType);
        
        if (generatedImages.length === 0) {
            throw new Error('No images generated');
        }

        target.length = 0;
        target.push(...generatedImages);

        // Clamp current index
        current = Math.min(preservedIndex, target.length - 1);
        preservedIndex = current;

        updateSliderMax();
        show(current);
        els.count.textContent = target.length;
        updateStatus(`Loaded ${target.length} frames`, 'success');

        // Update frame title
        if (which === 1 && els.frameTitle1) {
            els.frameTitle1.textContent = product;
        } else if (which === 2 && els.frameTitle2) {
            els.frameTitle2.textContent = product;
        }
        
        // Update single view title too
        if (which === 1 && els.frameTitleSingle) {
            els.frameTitleSingle.textContent = product;
        }

        // Show player controls once we have data
        showPlayerControls();
        
        // Preload images
        preloadImages(target);
        
    } catch (err) {
        console.warn(err);
        target.length = 0;
        preservedIndex = 0;
        if (images1.length === 0 && images2.length === 0) {
            resetPlayer();
        }
        updateStatus(`No data for ${product}`, 'error');
    }
}

// === VIEW MODE ===
function updateViewMode() {
    const has1 = images1.length > 0;
    const has2 = images2.length > 0;

    if (has1 && has2) {
        els.dualView.style.display = 'flex';
        els.singleView.style.display = 'none';
        els.placeholder.style.display = 'none';
    } else if (has1) {
        els.dualView.style.display = 'none';
        els.singleView.style.display = 'flex';
        els.single.src = images1[current]?.src || '';
        els.placeholder.style.display = 'none';
    } else {
        resetPlayer();
    }
}

// === PLAYER ===
function resetPlayer() {
    // Capture the current frame's timestep before clearing state
    let restoreTimestep = null;
    if (selectedProduct1 && selectedStorm && catalog[selectedStorm] && catalog[selectedStorm][selectedProduct1]) {
        const frameStart = catalog[selectedStorm][selectedProduct1].frameStart || 0;
        restoreTimestep = frameStart + preservedIndex;
    }

    images1 = [];
    images2 = [];
    current = 0;
    pause();
    els.slide1.src = '';
    els.slide2.src = '';
    els.single.src = '';
    els.dualView.style.display = 'none';
    els.singleView.style.display = 'none';
    els.placeholder.style.display = 'flex';
    els.curNum.textContent = '0';
    els.count.textContent = '0';
    updateProgress();
    updateSliderMax();
    hidePlayerControls();
    
    // Hide overlay controls
    if (els.overlayControls1) els.overlayControls1.style.display = 'none';
    if (els.overlayControls2) els.overlayControls2.style.display = 'none';
    if (els.overlayControlsSingle) els.overlayControlsSingle.style.display = 'none';
    
    // Refresh map size when returning to placeholder
    if (typeof trackMap !== 'undefined' && trackMap) {
        setTimeout(() => trackMap.invalidateSize(), 100);
    }

    // Re-open sidebar with the timestep that was being viewed
    if (restoreTimestep !== null && typeof trackData !== 'undefined' && typeof openSidebar === 'function') {
        const matchingPoint = trackData.find(p => p.timestep === restoreTimestep);
        if (matchingPoint) {
            setTimeout(() => openSidebar(matchingPoint), 150);
        }
    }
}

function show(idx) {
    if (images1.length === 0 && images2.length === 0) return;

    const maxLen = Math.max(images1.length, images2.length);
    
    // Handle wraparound for negative and positive values
    if (idx < 0) {
        idx = maxLen + idx;
    }
    
    current = idx;
    if (images1.length > 0) current = idx % images1.length;
    if (images2.length > 0 && images2.length !== images1.length) {
        // If lengths differ, clamp to shorter
        current = idx % Math.min(images1.length, images2.length);
    }

    preservedIndex = current;

    // Update images
    if (images1.length > 0) {
        els.slide1.src = images1[current]?.src || '';
    }
    if (images2.length > 0) {
        els.slide2.src = images2[current]?.src || '';
    }
    if (images1.length > 0 && images2.length === 0) {
        els.single.src = images1[current]?.src || '';
    }

    els.curNum.textContent = current + 1;
    updateProgress();
    updateViewMode();
}

function next() { 
    show(current + 1); 
    if (playing) restart(); 
}

function prev() { 
    show(current - 1); 
    if (playing) restart(); 
}

function toggle() { 
    playing ? pause() : play(); 
}

function play() {
    if (Math.max(images1.length, images2.length) < 2) return;
    playing = true;
    els.playPause.classList.add('playing');
    start();
}

function pause() {
    playing = false;
    els.playPause.classList.remove('playing');
    clearInterval(timer);
}

function start() {
    clearInterval(timer);
    const delay = 1000 / speed;
    timer = setInterval(() => {
        const maxIdx = Math.max(images1.length, images2.length) - 1;
        if (!els.loopCheckbox.checked && current >= maxIdx) {
            pause(); 
            return;
        }
        show(current + 1);
    }, delay);
}

function restart() { 
    if (playing) start(); 
}

function updateProgress() {
    const len = Math.max(images1.length, images2.length);
    if (len <= 1) {
        els.progress.style.width = '0%';
        els.thumb.style.left = '0%';
        return;
    }
    const pct = (current / (len - 1)) * 100;
    els.progress.style.width = pct + '%';
    els.thumb.style.left = pct + '%';
    els.slider.value = current;
}

function updateSliderMax() {
    const len = Math.max(images1.length, images2.length);
    els.slider.max = Math.max(0, len - 1);
}

// === EVENT LISTENERS ===

// Navigation button clicks
els.stormBtn.onclick = () => toggleDropdown(els.stormBtn, els.stormMenu);
els.product1Btn.onclick = () => toggleDropdown(els.product1Btn, els.product1Menu);
els.product2Btn.onclick = () => toggleDropdown(els.product2Btn, els.product2Menu);
els.view3dBtn.onclick = () => toggleDropdown(els.view3dBtn, els.view3dMenu);

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-btn-wrapper')) {
        closeAllDropdowns();
    }
});

// Playback controls
els.playPause.onclick = toggle;
els.prevBtn.onclick = prev;
els.nextBtn.onclick = next;

// Speed control
els.speedSlider.oninput = (e) => {
    speed = parseFloat(e.target.value);
    els.speedValue.textContent = speed.toFixed(1) + 'x';
    if (playing) start();
};

// Progress slider
els.slider.addEventListener('input', (e) => {
    const idx = parseInt(e.target.value, 10);
    show(idx);
    if (playing) restart();
});

// About Panel
els.aboutBtn.onclick = () => {
    els.about.classList.add('open');
    els.aboutOverlay.classList.add('open');
};

els.closeAbout.onclick = () => {
    els.about.classList.remove('open');
    els.aboutOverlay.classList.remove('open');
};

els.aboutOverlay.onclick = () => {
    els.about.classList.remove('open');
    els.aboutOverlay.classList.remove('open');
};

// 3D Viewer close
els.close3dViewer.onclick = close3dViewer;

// Analysis overlay
if (els.analysisBtn) els.analysisBtn.onclick = openAnalysisOverlay;
if (els.closeAnalysis) els.closeAnalysis.onclick = closeAnalysisOverlay;
if (els.analysisOverlay) {
    els.analysisOverlay.addEventListener('click', (e) => {
        if (e.target === els.analysisOverlay) closeAnalysisOverlay();
    });
}

// Lightbox
if (els.closeLightbox) els.closeLightbox.onclick = closeLightboxOverlay;
if (els.lightboxPrevBtn) els.lightboxPrevBtn.onclick = lightboxPrev;
if (els.lightboxNextBtn) els.lightboxNextBtn.onclick = lightboxNext;
if (els.lightboxOverlay) {
    els.lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === els.lightboxOverlay) closeLightboxOverlay();
    });
}

// Overlay checkbox event listeners
if (els.windVectors1) {
    els.windVectors1.addEventListener('change', (e) => {
        handleOverlayChange('primary', 'wind', e.target.checked);
    });
}
if (els.radialRings1) {
    els.radialRings1.addEventListener('change', (e) => {
        handleOverlayChange('primary', 'rings', e.target.checked);
    });
}
if (els.windVectors2) {
    els.windVectors2.addEventListener('change', (e) => {
        handleOverlayChange('compare', 'wind', e.target.checked);
    });
}
if (els.radialRings2) {
    els.radialRings2.addEventListener('change', (e) => {
        handleOverlayChange('compare', 'rings', e.target.checked);
    });
}
if (els.windVectorsSingle) {
    els.windVectorsSingle.addEventListener('change', (e) => {
        handleOverlayChange('single', 'wind', e.target.checked);
    });
}
if (els.radialRingsSingle) {
    els.radialRingsSingle.addEventListener('change', (e) => {
        handleOverlayChange('single', 'rings', e.target.checked);
    });
}

// Model radio event listeners (mutually exclusive via shared `name` per viewer)
[
    ['modelCpl1', 'primary', 'cpl'], ['modelUncpl1', 'primary', 'uncpl'], ['modelSpray1', 'primary', 'spray'],
    ['modelCpl2', 'compare', 'cpl'], ['modelUncpl2', 'compare', 'uncpl'], ['modelSpray2', 'compare', 'spray'],
    ['modelCplSingle', 'single', 'cpl'], ['modelUncplSingle', 'single', 'uncpl'], ['modelSpraySingle', 'single', 'spray'],
].forEach(([elKey, viewerType, model]) => {
    if (els[elKey]) {
        els[elKey].addEventListener('change', (e) => {
            if (e.target.checked) handleOverlayChange(viewerType, 'model', model);
        });
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input/select
    if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    
    // Close dropdown on Escape
    if (e.key === 'Escape') {
        if (els.lightboxOverlay && els.lightboxOverlay.classList.contains('open')) {
            closeLightboxOverlay();
            return;
        }
        if (els.analysisOverlay && els.analysisOverlay.classList.contains('open')) {
            closeAnalysisOverlay();
            return;
        }
        if (activeDropdown) {
            closeAllDropdowns();
            return;
        }
        if (els.viewer3dOverlay.classList.contains('open')) {
            close3dViewer();
            return;
        }
        els.about.classList.remove('open');
        els.aboutOverlay.classList.remove('open');
        return;
    }

    // Lightbox arrow navigation
    if (els.lightboxOverlay && els.lightboxOverlay.classList.contains('open')) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); lightboxPrev(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); lightboxNext(); return; }
        return;
    }

    // Don't allow playback controls when 3D viewer is open
    if (els.viewer3dOverlay.classList.contains('open')) return;

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            prev();
            break;
        case 'ArrowRight':
            e.preventDefault();
            next();
            break;
        case ' ':
            e.preventDefault();
            toggle();
            break;
    }
});

// === IMAGE PRELOADING ===
function preloadImages(imageArray) {
    imageArray.forEach(img => {
        const preload = new Image();
        preload.src = img.src;
    });
}

// === GLOBAL FUNCTIONS FOR EXTERNAL MODULES ===
window.selectProductAndJumpToFrame = async function(stormName, productName, frameNumber) {
    console.log('selectProductAndJumpToFrame called:', { stormName, productName, frameNumber, catalog: !!window.catalog });
    
    if (!stormName || !catalog[stormName] || !catalog[stormName][productName]) {
        console.warn(`Product ${productName} not found for storm ${stormName}`);
        return;
    }
    
    const productConfig = catalog[stormName][productName];
    if (productConfig.type !== '2d') {
        console.warn(`Product ${productName} is not a 2D product`);
        return;
    }
    
    // Set the storm if not already set
    if (selectedStorm !== stormName) {
        selectStorm(stormName);
    }
    
    // If this product is already selected, just jump to the frame
    if (selectedProduct1 === productName && images1.length > 0) {
        const frameIndex = frameNumber - productConfig.frameStart;
        const clampedIndex = Math.max(0, Math.min(frameIndex, images1.length - 1));
        console.log('Jumping to frame:', { frameNumber, frameIndex, clampedIndex });
        show(clampedIndex);
        return;
    }
    
    // Select the product as primary (this will load the images)
    console.log('Selecting product:', productName);
    selectProduct1(productName);
    
    // Wait a bit for the images to load, then jump to the frame
    setTimeout(() => {
        if (images1.length > 0) {
            const frameIndex = frameNumber - productConfig.frameStart;
            const clampedIndex = Math.max(0, Math.min(frameIndex, images1.length - 1));
            console.log('Jumping to frame after load:', { frameNumber, frameIndex, clampedIndex });
            show(clampedIndex);
        } else {
            console.warn('No images loaded after selecting product');
        }
    }, 100);
};

window.selectBothProductsAndJumpToFrame = async function(stormName, productA, productB, frameNumber) {
    console.log('selectBothProductsAndJumpToFrame called:', { stormName, productA, productB, frameNumber, catalog: !!window.catalog });
    
    if (!stormName || !catalog[stormName] || !catalog[stormName][productA]) {
        console.warn(`Product ${productA} not found for storm ${stormName}`);
        return;
    }
    
    // Set the storm if not already set
    if (selectedStorm !== stormName) {
        selectStorm(stormName);
    }
    
    // If productB is null/undefined/'none', use single-view mode
    if (!productB || productB === 'none') {
        console.log('Single-view mode for product:', productA);
        selectProduct1(productA);
        selectProduct2('none');
        
        setTimeout(() => {
            if (images1.length > 0) {
                const frameIndex = frameNumber - catalog[stormName][productA].frameStart;
                const clampedIndex = Math.max(0, Math.min(frameIndex, images1.length - 1));
                console.log('Jumping to frame (single):', { frameNumber, frameIndex, clampedIndex });
                show(clampedIndex);
            } else {
                console.warn('No images loaded after selecting product');
            }
        }, 100);
        return;
    }
    
    if (!catalog[stormName][productB]) {
        console.warn(`Product ${productB} not found for storm ${stormName}`);
        return;
    }
    
    // Select both products
    console.log('Selecting products:', productA, 'and', productB);
    selectProduct1(productA);
    selectProduct2(productB);
    
    // Wait for both products to load, then jump to the frame
    setTimeout(() => {
        if (images1.length > 0 && images2.length > 0) {
            const frameIndex = frameNumber - catalog[stormName][productA].frameStart;
            const clampedIndex = Math.max(0, Math.min(frameIndex, Math.min(images1.length, images2.length) - 1));
            console.log('Jumping to frame after loading both products:', { frameNumber, frameIndex, clampedIndex });
            show(clampedIndex);
        } else {
            console.warn('Not all images loaded after selecting products');
        }
    }, 200); // Slightly longer wait for both products
};

// === ANALYSIS SECTION ===

function openAnalysisOverlay() {
    if (!selectedStorm || !window.catalogAnalysis || !window.catalogAnalysis[selectedStorm]) return;
    renderAnalysisGrid(selectedStorm);
    els.analysisOverlay.classList.add('open');
}

function closeAnalysisOverlay() {
    els.analysisOverlay.classList.remove('open');
}

function resolveStaticPaths(productConfig, stormName) {
    const stormLower = stormName.toLowerCase();
    if (productConfig.type === 'static') {
        return productConfig.images.map(img => ({
            src: img.src.replace(/{storm}/g, stormLower),
            label: img.label
        }));
    }
    return [];
}

function renderAnalysisGrid(stormName) {
    const stormLower = stormName.toLowerCase();
    const products = window.catalogAnalysis[stormName];
    if (!products) return;

    if (els.analysisTitle) {
        els.analysisTitle.textContent = stormName + ' — Analysis';
    }

    els.analysisGrid.innerHTML = '';

    Object.entries(products).forEach(([name, config]) => {
        const card = document.createElement('div');
        card.className = 'analysis-card';

        let thumbSrc = '';
        let badgeText = '';

        if (config.type === 'static') {
            const images = resolveStaticPaths(config, stormName);
            thumbSrc = images[0]?.src || '';
            badgeText = images.length + ' chart' + (images.length !== 1 ? 's' : '');
        } else if (config.type === 'static-3d') {
            thumbSrc = config.staticImage || '';
            badgeText = '3D interactive';
        }

        card.innerHTML = `
            <div class="analysis-card-thumb">
                <img src="${thumbSrc}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.parentNode.classList.add('no-thumb')">
            </div>
            <div class="analysis-card-body">
                <div class="analysis-card-title">${name}</div>
                <div class="analysis-card-badge">${badgeText}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (config.type === 'static-3d') {
                closeAnalysisOverlay();
                const url = config.pattern.replace(/{storm}/g, stormLower);
                els.viewer3dLabel.textContent = name;
                els.viewer3dFrameNum.textContent = '70';
                showLoader3d();
                els.viewer3dIframe.onload = hideLoader3d;
                els.viewer3dIframe.src = url;
                els.viewer3dOverlay.classList.add('open');
            } else {
                openLightbox(name, config, stormName, 0);
            }
        });

        els.analysisGrid.appendChild(card);
    });
}

function openLightbox(productName, productConfig, stormName, startIndex) {
    lightboxProduct = productConfig;
    lightboxIndex = startIndex;
    lightboxStorm = stormName;

    const images = resolveStaticPaths(productConfig, stormName);
    if (!images.length) return;

    els.lightboxOverlay.dataset.productName = productName;
    showLightboxFrame(images, lightboxIndex);
    els.lightboxOverlay.classList.add('open');
}

function showLightboxFrame(images, idx) {
    if (!images || !images.length) return;
    idx = ((idx % images.length) + images.length) % images.length;
    lightboxIndex = idx;

    els.lightboxImage.src = images[idx].src;
    els.lightboxLabel.textContent = images[idx].label;

    els.lightboxPrevBtn.style.display = images.length > 1 ? '' : 'none';
    els.lightboxNextBtn.style.display = images.length > 1 ? '' : 'none';
}

function lightboxNext() {
    const images = resolveStaticPaths(lightboxProduct, lightboxStorm);
    showLightboxFrame(images, lightboxIndex + 1);
}

function lightboxPrev() {
    const images = resolveStaticPaths(lightboxProduct, lightboxStorm);
    showLightboxFrame(images, lightboxIndex - 1);
}

function closeLightboxOverlay() {
    els.lightboxOverlay.classList.remove('open');
    els.lightboxImage.src = '';
    lightboxProduct = null;
}

// === INITIALIZATION ===
window.onload = async () => {
    await loadCatalog();

    // Auto-select Ian on load
    if (catalog['Ian']) {
        selectStorm('Ian');
    }

    // Initialize track map on homepage, then auto-select first timestep
    if (typeof initTrackMap === 'function') {
        await initTrackMap();
        if (window.trackData && window.trackData.length > 0 && window.openSidebar) {
            window.openSidebar(window.trackData[0]);
        }
    }
    
    // Add event listeners for close buttons
    if (els.closePlayer) {
        els.closePlayer.addEventListener('click', resetPlayer);
    }
    if (els.closePlayer2) {
        els.closePlayer2.addEventListener('click', resetPlayer);
    }
    if (els.closePlayerSingle) {
        els.closePlayerSingle.addEventListener('click', resetPlayer);
    }
    
    // Add entrance animations
    document.querySelectorAll('.example-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 0.1}s`;
        card.classList.add('animate-in');
    });
};

// Add CSS for entrance animation
const style = document.createElement('style');
style.textContent = `
    .example-card.animate-in {
        animation: cardEnter 0.5s ease forwards;
        opacity: 0;
    }
    
    @keyframes cardEnter {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Sidebar toggle functionality
const sidebarToggle = document.getElementById('sidebar-toggle');
const trackSidebarEl = document.getElementById('track-sidebar');

els.mobileNavToggle.addEventListener('click', () => {
    mobileShowingPlayer = !mobileShowingPlayer;
    if (mobileShowingPlayer) {
        els.playerControls.style.display = 'flex';
        els.siteTitle.style.display = 'none';
        els.navButtons.style.display = 'none';
        els.mobileNavToggle.querySelector('i').className = 'fas fa-chevron-left';
    } else {
        els.playerControls.style.display = 'none';
        els.siteTitle.style.display = 'flex';
        els.navButtons.style.display = '';
        els.mobileNavToggle.querySelector('i').className = 'fas fa-chevron-right';
    }
});

sidebarToggle.addEventListener('click', () => {
    const isOpen = trackSidebarEl.classList.contains('open');
    if (isOpen) {
        // Use the trackmap closeSidebar if available
        if (typeof closeSidebar === 'function') {
            closeSidebar();
        } else {
            trackSidebarEl.classList.remove('open');
            const main = document.getElementById('main-container');
            if (main) main.classList.remove('sidebar-open');
        }
    } else {
        // Open sidebar — show last active point or just open empty
        if (typeof openSidebar === 'function' && activePoint) {
            openSidebar(activePoint);
        } else {
            trackSidebarEl.classList.add('open');
            const main = document.getElementById('main-container');
            if (main) main.classList.add('sidebar-open');
            if (typeof trackMap !== 'undefined' && trackMap) {
                setTimeout(() => trackMap.invalidateSize({ animate: true }), 420);
            }
        }
    }
});

// Close buttons for comparison modal
const closeButtons = document.querySelectorAll('.comparison-close');
closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const frame = button.closest('.comparison-frame');
        frame.style.display = 'none';
    });
});