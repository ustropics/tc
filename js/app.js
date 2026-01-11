// ============================================
// TROPICAL CYCLONE RI CASE STUDIES
// Modern JavaScript Controller
// ============================================

// === CONFIG ===
const CATALOG_URL = 'json/catalog.json';
const IMAGES_BASE = 'json';

// === STATE ===
let catalog = {};
let images1 = [];          // Primary product
let images2 = [];          // Secondary product (optional)
let current = 0;
let playing = false;
let speed = 1;
let timer = null;
let preservedIndex = 0;

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

    // Selects
    year:   document.getElementById('year-filter'),
    prod1:  document.getElementById('product-filter'),
    prod2:  document.getElementById('product-filter-2'),
    view3d: document.getElementById('view-3d-filter'),

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
    close3dViewer:     document.getElementById('close-3d-viewer')
};

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

// === LOAD CATALOG ===
async function loadCatalog() {
    try {
        updateStatus('Loading catalog...', 'loading');
        const res = await fetch(CATALOG_URL);
        if (!res.ok) throw new Error('Catalog not found');
        catalog = await res.json();

        // Populate Year dropdown (now Cyclone dropdown)
        els.year.innerHTML = '<option value="">Select Cyclone</option>';
        Object.keys(catalog).sort().reverse().forEach(cyclone => {
            const opt = document.createElement('option');
            opt.value = cyclone;
            opt.textContent = cyclone;
            els.year.appendChild(opt);
        });

        updateStatus('Select cyclone and product', 'success');
    } catch (err) {
        console.error(err);
        updateStatus('Failed to load catalog', 'error');
    }
}

// === CYCLONE/YEAR CHANGE ===
els.year.onchange = () => {
    const year = els.year.value;
    [els.prod1, els.prod2, els.view3d].forEach(sel => {
        if (sel === els.view3d) {
            sel.innerHTML = '<option value="">Select 3D View</option>';
        } else if (sel === els.prod2) {
            sel.innerHTML = '<option value="">Select 2nd Product</option><option value="none">None</option>';
        } else {
            sel.innerHTML = '<option value="">Select Product</option>';
        }
        sel.disabled = !year;
    });

    if (year && catalog[year]) {
        // Populate product dropdowns
        const products = Object.keys(catalog[year]).filter(p => !p.startsWith('3d_')).sort();
        [els.prod1, els.prod2].forEach(sel => {
            products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
            });
        });
        
        // Populate 3D views dropdown
        const views3d = Object.keys(catalog[year]).filter(p => p.startsWith('3d_')).sort();
        views3d.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            // Clean up the display name (remove 3d_ prefix, replace underscores)
            opt.textContent = v.replace('3d_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            els.view3d.appendChild(opt);
        });
    }
    preservedIndex = 0;
    resetPlayer();
};

// === PRODUCT 1 CHANGE ===
els.prod1.onchange = async () => {
    await loadProduct(1);
    syncProduct2Options();
    updateViewMode();
};

// === PRODUCT 2 CHANGE ===
els.prod2.onchange = async () => {
    const value = els.prod2.value;
    
    // Handle "None" selection - clear second image
    if (value === 'none' || value === '') {
        images2 = [];
        els.slide2.src = '';
        if (els.frameTitle2) els.frameTitle2.textContent = '--';
        updateViewMode();
        return;
    }
    
    await loadProduct(2);
    updateViewMode();
};

// === 3D VIEW STATE ===
let current3dView = null;
let view3dBaseUrl = '';

// === 3D VIEW CHANGE ===
els.view3d.onchange = () => {
    const year = els.year.value;
    const view = els.view3d.value;
    
    if (!year || !view || !catalog[year] || !catalog[year][view]) {
        current3dView = null;
        return;
    }
    
    current3dView = view;
    view3dBaseUrl = catalog[year][view];
    
    // Open the 3D viewer with current frame
    open3dViewer();
};

// === 3D VIEWER FUNCTIONS ===
function open3dViewer() {
    if (!current3dView || !view3dBaseUrl) return;
    
    // Get current frame number from images
    let frameNum = 50; // default
    if (images1.length > 0 && images1[current]) {
        // Extract frame number from image src (e.g., "ian_eflx_hor_min_50.png" -> 50)
        const match = images1[current].src.match(/_(\d+)\.(png|jpg|webp)$/i);
        if (match) {
            frameNum = parseInt(match[1], 10);
        }
    }
    
    // Build the iframe URL
    // view3dBaseUrl should be a pattern like "3d/ian_eflx_3d_isosurface_{frame}.html"
    const iframeUrl = view3dBaseUrl.replace('{frame}', frameNum);
    
    // Update UI
    els.viewer3dLabel.textContent = current3dView.replace('3d_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    els.viewer3dFrameNum.textContent = frameNum;
    els.viewer3dIframe.src = iframeUrl;
    
    // Show overlay
    els.viewer3dOverlay.classList.add('open');
    
    // Pause playback while 3D view is open
    if (playing) pause();
}

function close3dViewer() {
    els.viewer3dOverlay.classList.remove('open');
    els.viewer3dIframe.src = '';
    els.view3d.value = '';
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
    
    const iframeUrl = view3dBaseUrl.replace('{frame}', frameNum);
    els.viewer3dFrameNum.textContent = frameNum;
    els.viewer3dIframe.src = iframeUrl;
}

// Load a product (1 or 2)
async function loadProduct(which) {
    const year = els.year.value;
    const prodSel = which === 1 ? els.prod1 : els.prod2;
    const product = prodSel.value;
    const target = which === 1 ? images1 : images2;

    if (!year || !product) return;

    const filename = catalog[year][product];
    const url = `${IMAGES_BASE}/${filename}`;

    try {
        updateStatus(`Loading ${product}...`, 'loading');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`File not found: ${filename}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('No images');

        target.length = 0;
        target.push(...data);

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

        // Show player controls once we have data
        showPlayerControls();
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

// Sync Product 2 dropdown to match Product 1 options
function syncProduct2Options() {
    const selected1 = els.prod1.value;
    const options2 = els.prod2.options;
    for (let opt of options2) {
        // Don't disable "None" or the placeholder
        if (opt.value === 'none' || opt.value === '') {
            opt.disabled = false;
        } else {
            opt.disabled = opt.value === selected1;
        }
    }
    if (els.prod2.value === selected1) {
        els.prod2.value = '';
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
    els.placeholder.style.display = 'grid';
    els.curNum.textContent = '0';
    els.count.textContent = '0';
    updateProgress();
    updateSliderMax();
    hidePlayerControls();
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input/select
    if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    
    // Close 3D viewer on Escape
    if (e.key === 'Escape') {
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

// Remove duplicate escape handler

// === IMAGE PRELOADING ===
function preloadImages(imageArray) {
    imageArray.forEach(img => {
        const preload = new Image();
        preload.src = img.src;
    });
}

// Watch for product changes to preload
const originalLoadProduct = loadProduct;
loadProduct = async function(which) {
    await originalLoadProduct(which);
    // Preload images after loading
    if (which === 1 && images1.length > 0) {
        preloadImages(images1);
    } else if (which === 2 && images2.length > 0) {
        preloadImages(images2);
    }
};

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
