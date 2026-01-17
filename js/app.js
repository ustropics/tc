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

// Overlay states for each viewer
let overlayState = {
    primary: { wind: false, rings: false },
    compare: { wind: false, rings: false },
    single: { wind: false, rings: false }
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
    playerControls: document.getElementById('player-controls'),
    siteTitle:      document.getElementById('site-title'),
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
    radialRingsSingle:   document.getElementById('radial-rings-single')
};

// === LOAD CATALOG ===
async function loadCatalog() {
    try {
        updateStatus('Loading catalog...', 'loading');
        const response = await fetch('json/catalog.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        catalog = await response.json();
        updateStatus('Catalog loaded', 'success');
        populateStormMenu();
    } catch (error) {
        console.error('Failed to load catalog:', error);
        updateStatus('Failed to load catalog', 'error');
    }
}

// === UTILITIES ===
function updateStatus(message, type = 'info') {
    const statusEl = els.status;
    const icon = statusEl.querySelector('i');
    const text = statusEl.querySelector('span');
    
    text.textContent = message;
    
    // Update icon based on type
    icon.className = 'fas';
    switch(type) {
        case 'loading':
            icon.classList.add('fa-spinner', 'fa-spin');
            break;
        case 'success':
            icon.classList.add('fa-check-circle');
            break;
        case 'error':
            icon.classList.add('fa-exclamation-circle');
            break;
        default:
            icon.classList.add('fa-info-circle');
    }
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
    
    // Determine which pattern to use
    let pattern;
    if (productConfig.hasOverlays && productConfig.patterns) {
        const patternKey = getPatternKey(viewerType);
        pattern = productConfig.patterns[patternKey];
    } else if (productConfig.pattern) {
        pattern = productConfig.pattern;
    } else {
        console.warn('No pattern found for product');
        return images;
    }
    
    for (let frame = productConfig.frameStart; frame <= productConfig.frameEnd; frame++) {
        const src = pattern
            .replace(/{storm}/g, stormLower)
            .replace(/{frame}/g, frame);
        
        const title = productConfig.titlePattern
            .replace(/{storm}/g, stormName)
            .replace(/{frame}/g, frame);
        
        images.push({ src, title });
    }
    
    return images;
}

// === SHOW/HIDE PLAYER CONTROLS ===
function showPlayerControls() {
    els.siteTitle.style.display = 'none';
    els.playerControls.style.display = 'flex';
    els.progressWrapper.style.display = 'block';
}

function hidePlayerControls() {
    els.siteTitle.style.display = 'flex';
    els.playerControls.style.display = 'none';
    els.progressWrapper.style.display = 'none';
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
    
    if (!selectedStorm || !catalog[selectedStorm]) return;
    
    const products = catalog[selectedStorm];
    
    // Separate 2D and 3D products
    const products2d = Object.keys(products).filter(p => !p.startsWith('3d_')).sort();
    const products3d = Object.keys(products).filter(p => p.startsWith('3d_')).sort();
    
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

// === SELECTION HANDLERS ===
function selectStorm(storm) {
    selectedStorm = storm;
    selectedProduct1 = '';
    selectedProduct2 = '';
    
    // Reset overlay states
    overlayState = {
        primary: { wind: false, rings: false },
        compare: { wind: false, rings: false },
        single: { wind: false, rings: false }
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
    
    populateProductMenus();
    closeAllDropdowns();
    
    preservedIndex = 0;
    resetPlayer();
}

function selectProduct1(product) {
    if (product === selectedProduct2) {
        // Swap - set product2 to none
        selectedProduct2 = '';
        els.product2Value.textContent = 'None';
        images2 = [];
        if (els.frameTitle2) els.frameTitle2.textContent = '--';
        updateOverlayControlsVisibility('compare', null);
    }
    
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
    
    if (product === selectedProduct1) {
        // Can't select same as primary
        closeAllDropdowns();
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

function open3dViewer(view) {
    if (!selectedStorm || !catalog[selectedStorm] || !catalog[selectedStorm][view]) return;
    
    current3dView = view;
    const productConfig = catalog[selectedStorm][view];
    view3dBaseUrl = productConfig.pattern;
    
    // Get current frame number from images
    let frameNum = 50; // default
    if (images1.length > 0 && images1[current]) {
        // Extract frame number from image src
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
    
    // Get current frame number
    let frameNum = 50;
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input/select
    if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    
    // Close dropdown on Escape
    if (e.key === 'Escape') {
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

// === INITIALIZATION ===
window.onload = () => {
    loadCatalog();
    resetPlayer();
    
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
