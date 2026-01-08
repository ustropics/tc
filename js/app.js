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

// === DOM ===
const els = {
    slide1:   document.getElementById('current-slide-1'),
    slide2:   document.getElementById('current-slide-2'),
    single:   document.getElementById('current-slide'),
    dualView: document.getElementById('dual-view'),

    progress: document.getElementById('progress-fill'),
    thumb:    document.getElementById('progress-thumb'),
    slider:   document.getElementById('progress-slider'),
    progressWrapper: document.getElementById('progress-wrapper'),

    playerControls: document.getElementById('player-controls'),

    status:   document.getElementById('status'),
    count:    document.getElementById('image-count'),
    curNum:   document.getElementById('current-num'),

    year:     document.getElementById('year-filter'),
    prod1:    document.getElementById('product-filter'),
    prod2:    document.getElementById('product-filter-2'),

    about:    document.getElementById('about-panel'),
    aboutBtn: document.getElementById('about-btn'),
    closeAbout: document.getElementById('close-about'),
    placeholder: document.getElementById('placeholder')
};

// === SHOW/HIDE PLAYER CONTROLS ===
function showPlayerControls() {
    els.playerControls.style.display = 'flex';
    els.progressWrapper.style.display = 'block';
}

function hidePlayerControls() {
    els.playerControls.style.display = 'none';
    els.progressWrapper.style.display = 'none';
}

// === LOAD CATALOG ===
async function loadCatalog() {
    try {
        const res = await fetch(CATALOG_URL);
        if (!res.ok) throw new Error('Catalog not found');
        catalog = await res.json();

        // Populate Year dropdown
        els.year.innerHTML = '<option value="">Select Year</option>';
        Object.keys(catalog).sort().reverse().forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            els.year.appendChild(opt);
        });

        els.status.textContent = 'Select Year and Product';
    } catch (err) {
        console.error(err);
        els.status.textContent = 'Failed to load catalog';
    }
}

// === YEAR CHANGE ===
els.year.onchange = () => {
    const year = els.year.value;
    [els.prod1, els.prod2].forEach(sel => {
        sel.innerHTML = '<option value="">Select Product</option>';
        sel.disabled = !year;
    });

    if (year && catalog[year]) {
        const products = Object.keys(catalog[year]).sort();
        [els.prod1, els.prod2].forEach(sel => {
            products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
            });
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
    await loadProduct(2);
    updateViewMode();
};

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
        els.status.textContent = `Loading ${filename}...`;
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
        els.status.textContent = `Loaded ${target.length} images`;

        // Show player controls once we have data
        showPlayerControls();
    } catch (err) {
        console.warn(err);
        target.length = 0;
        preservedIndex = 0;
        if (images1.length === 0 && images2.length === 0) {
            resetPlayer();
        }
        els.status.textContent = `No data for ${product}`;
    }
}

// Sync Product 2 dropdown to match Product 1 options
function syncProduct2Options() {
    const selected1 = els.prod1.value;
    const options2 = els.prod2.options;
    for (let opt of options2) {
        opt.disabled = opt.value === selected1;
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
        els.single.style.display = 'none';
        els.placeholder.style.display = 'none';
    } else if (has1) {
        els.dualView.style.display = 'none';
        els.single.style.display = 'block';
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
    els.single.style.display = 'none';
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

function next() { show(current + 1); if (playing) restart(); }
function prev() { show(current - 1); if (playing) restart(); }

function toggle() { playing ? pause() : play(); }
function play() {
    if (Math.max(images1.length, images2.length) < 2) return;
    playing = true;
    document.getElementById('play-pause').classList.add('playing');
    start();
}
function pause() {
    playing = false;
    document.getElementById('play-pause').classList.remove('playing');
    clearInterval(timer);
}
function start() {
    clearInterval(timer);
    const delay = 1000 / speed;
    timer = setInterval(() => {
        if (!document.getElementById('loop').checked && current >= Math.min(images1.length, images2.length) - 1) {
            pause(); return;
        }
        next();
    }, delay);
}
function restart() { if (playing) start(); }

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

// === EVENTS ===
document.getElementById('play-pause').onclick = toggle;
document.getElementById('prev').onclick = prev;
document.getElementById('next').onclick = next;
document.getElementById('speed').oninput = (e) => {
    speed = parseFloat(e.target.value);
    document.getElementById('speed-value').textContent = speed.toFixed(1) + 'x';
    if (playing) start();
};

els.slider.addEventListener('input', (e) => {
    const idx = parseInt(e.target.value, 10);
    show(idx);
    if (playing) restart();
});

// About Panel
els.aboutBtn.onclick = () => els.about.classList.add('open');
els.closeAbout.onclick = () => els.about.classList.remove('open');
document.addEventListener('click', (e) => {
    if (els.about.classList.contains('open') && 
        !els.about.contains(e.target) && 
        e.target !== els.aboutBtn) {
        els.about.classList.remove('open');
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === ' ')          { e.preventDefault(); toggle(); }
});

// === START ===
window.onload = () => {
    loadCatalog();
    resetPlayer();
};