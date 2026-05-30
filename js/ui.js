/*
=================================================================
檔案名稱: ui.js
功    用: 介面互動邏輯控制
版本: 3.2 (修正月份選單、美食模式提示、互斥、懸浮亮燈)
=================================================================
*/

// ========== 全域變數 ==========
let isCruise = true;
let cruiseInt, resumeTimeout, curIdx = 0;
let showHk = false, showDom = false;
let showTraLines = false, showHsrLines = false;
let showTraStations = false, showHsrStations = false;
let activeMenu = null;
let hoverTimeout = null;
let allCountiesList = [];

// 美食模式開關
let isFoodMode = false;

// ========== 自動判斷環境（本機 vs 線上）==========
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 照片路徑
const photoBasePath = isLocal ? 'web_photos_small/' : 'https://cdn.jsdelivr.net/gh/hderys/taiwan-photos/';
const largePhotoBasePath = isLocal ? 'web_photos_large/' : 'https://cdn.jsdelivr.net/gh/hderys/taiwan-photos/';

const bgm = document.getElementById("bgm-audio");

// ========== 收藏景點 ==========
let favoriteSpots = [];

try {
    const saved = localStorage.getItem('taiwan_favorite_spots');
    if (saved) {
        favoriteSpots = JSON.parse(saved);
    }
} catch(e) { favoriteSpots = []; }

function updateFavoriteUI() {
    const countSpan = document.getElementById('favorite-count');
    if (countSpan) countSpan.innerText = favoriteSpots.length;
    
    const listContainer = document.getElementById('favorite-list');
    if (listContainer) {
        if (favoriteSpots.length === 0) {
            listContainer.innerHTML = '<div class="empty-favorite">⭐ 收藏的景點會顯示在這裡</div>';
        } else {
            listContainer.innerHTML = favoriteSpots.map((spot, idx) => `
                <div class="favorite-item" 
                     onmouseover="previewCounty('${spot.county}')" 
                     onmouseout="clearPreview()"
                     onclick="openFavoriteSpot(${idx})">
                    <span>📸 ${spot.title}</span>
                    <span class="remove" onclick="event.stopPropagation(); removeFavoriteSpot(${idx})">✖</span>
                </div>
            `).join('');
        }
    }
    
    document.querySelectorAll('.thumb-card').forEach(card => {
        const star = card.querySelector('.favorite-star');
        if (star) {
            const county = star.dataset.county;
            const idx = parseInt(star.dataset.idx);
            const isFav = favoriteSpots.some(s => s.county === county && s.photoIndex === idx);
            star.innerHTML = isFav ? '⭐' : '☆';
        }
    });
}

function addFavoriteSpot(countyName, photoIndex, photoTitle) {
    if (!favoriteSpots.some(spot => spot.county === countyName && spot.photoIndex === photoIndex)) {
        favoriteSpots.push({
            county: countyName,
            photoIndex: photoIndex,
            title: photoTitle
        });
        localStorage.setItem('taiwan_favorite_spots', JSON.stringify(favoriteSpots));
        updateFavoriteUI();
        showToast(`✅ 已收藏「${photoTitle}」`);
    } else {
        showToast(`📌 「${photoTitle}」已在收藏中`);
    }
}

function removeFavoriteSpot(index) {
    const title = favoriteSpots[index].title;
    favoriteSpots.splice(index, 1);
    localStorage.setItem('taiwan_favorite_spots', JSON.stringify(favoriteSpots));
    updateFavoriteUI();
    showToast(`🗑️ 已移除「${title}」`);
}

function openFavoriteSpot(index) {
    const spot = favoriteSpots[index];
    if (spot) {
        const panel = document.getElementById('favorite-panel');
        if (panel) panel.classList.remove('show');
        
        const previewDiv = document.getElementById('favorite-preview');
        const previewImg = document.getElementById('preview-img');
        const previewTitle = document.getElementById('preview-title');
        
        if (previewDiv && previewImg && previewTitle) {
            const photo = photoData[spot.county][spot.photoIndex];
            if (photo) {
                previewImg.src = `${photoBasePath}small${photo.i}.webp`;
            } else {
                previewImg.src = `${photoBasePath}small${spot.photoIndex + 1}.jpg`;
            }
            previewTitle.innerText = spot.title;
            previewDiv.style.display = 'block';
            
            setTimeout(() => {
                previewDiv.style.display = 'none';
            }, 5000);
        }
        
        const countyPath = d3.select(`#path-${spot.county}`);
        if (countyPath.node()) {
            clearAllHighlights();
            countyPath.classed("active", true);
            d3.selectAll(`.label-${spot.county}`).classed("label-visible", true);
            
            if(subIslands[spot.county]) {
                subIslands[spot.county].forEach(isl => d3.selectAll(`.label-${isl}`).classed("label-visible", true));
            }
            
            const cnameEl = document.getElementById("cname");
            if (cnameEl) cnameEl.innerText = spot.county;
            
            showToast(`📍 ${spot.county} - ${spot.title}`);
        }
    }
}

function toggleFavoritePanel() {
    const panel = document.getElementById('favorite-panel');
    if (panel) panel.classList.toggle('show');
}

function showToast(message) {
    let toast = document.getElementById('toast-message');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-message';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            color: var(--accent);
            padding: 10px 20px;
            border-radius: 40px;
            font-size: 14px;
            z-index: 1000;
            transition: opacity 0.3s;
            pointer-events: none;
            white-space: nowrap;
            font-weight: bold;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

// ========== 選單控制 ==========
function buildDropdowns() {
    const taiwanDropdown = document.getElementById('dropdown-taiwan');
    taiwanDropdown.innerHTML = `
        <div class="vertical-item" style="background:#00d4ff; color:#000;" onmouseover="previewRegion('北臺灣')" onmouseout="clearPreview()" onclick="selectRegionAndClose('北臺灣')">
            <img src="images/north.png" alt="北" style="width:24px; height:24px;">
            <span style="font-weight:bold;">北臺灣</span>
        </div>
        <div class="vertical-item" style="background:#52ff52; color:#000;" onmouseover="previewRegion('中臺灣')" onmouseout="clearPreview()" onclick="selectRegionAndClose('中臺灣')">
            <img src="images/center.png" alt="中" style="width:24px; height:24px;">
            <span style="font-weight:bold;">中臺灣</span>
        </div>
        <div class="vertical-item" style="background:#ffbb33; color:#000;" onmouseover="previewRegion('南臺灣')" onmouseout="clearPreview()" onclick="selectRegionAndClose('南臺灣')">
            <img src="images/south.png" alt="南" style="width:24px; height:24px;">
            <span style="font-weight:bold;">南臺灣</span>
        </div>
        <div class="vertical-item" style="background:#ff66cc; color:#000;" onmouseover="previewRegion('東臺灣')" onmouseout="clearPreview()" onclick="selectRegionAndClose('東臺灣')">
            <img src="images/east.png" alt="東" style="width:24px; height:24px;">
            <span style="font-weight:bold;">東臺灣</span>
        </div>
        <div class="vertical-item" style="background:#cccccc; color:#000;" onmouseover="previewRegion('離島區域')" onmouseout="clearPreview()" onclick="selectRegionAndClose('離島區域')">
            <img src="images/west.png" alt="西" style="width:24px; height:24px;">
            <span style="font-weight:bold;">離島區域</span>
        </div>
        <div class="vertical-item" style="background:var(--gold); color:#000;" onmouseover="previewRegion('直轄市')" onmouseout="clearPreview()" onclick="selectRegionAndClose('直轄市')">
            <span>🏛️ 直轄市 (6都)</span>
        </div>
        <div class="vertical-item" style="background:var(--gold); color:#000;" onmouseover="previewRegion('市')" onmouseout="clearPreview()" onclick="selectRegionAndClose('市')">
            <span>🏘️ 省轄市 (3市)</span>
        </div>
        <div class="vertical-item" style="background:var(--gold); color:#000;" onmouseover="previewRegion('縣')" onmouseout="clearPreview()" onclick="selectRegionAndClose('縣')">
            <span>🏞️ 縣 (13縣)</span>
        </div>
    `;
    
    const transportDropdown = document.getElementById('dropdown-transport');
    transportDropdown.innerHTML = `
        <div class="vertical-item" style="background:#3399ff;" onclick="toggleAirports('hk')">✈️ 赴港航班機場</div>
        <div class="vertical-item" style="background:#66ccff;" onclick="toggleAirports('dom')">🛩️ 國內線機場</div>
        <div class="vertical-item" style="background:#0033aa;" onclick="toggleTra()">🚂 臺鐵 (TRA)</div>
        <div class="vertical-item" style="background:#ffaa33;" onclick="toggleHsr()">🚄 高鐵 (THSR)</div>
        <div class="vertical-item" style="background:#8b5cf6; color:#fff;" onclick="toggleMrt()">🚇 捷運 (MRT)</div>
    `;

    const foodDropdown = document.getElementById('dropdown-food');
    if (foodDropdown) {
        foodDropdown.innerHTML = `
            <div class="vertical-item" style="background:#ff6600; color:#fff; justify-content:center;" onclick="toggleFoodMode()">
                <span>🍜 美食模式</span>
            </div>
        `;
    }

    const monthlyDropdown = document.getElementById('dropdown-monthly');
    if (monthlyDropdown) {
        monthlyDropdown.innerHTML = `
            <div class="vertical-item" style="background:#9933ff; color:#fff; justify-content:center;" onclick="toggleMonthlyPanel()">
                <span>📅 選擇月份</span>
            </div>
        `;
    }
}

// ========== 美食模式 ==========
function toggleFoodMode() {
    isFoodMode = !isFoodMode;
    const foodBtn = document.querySelector('#menu-food .menu-trigger');
    
    // 如果開啟美食模式，關閉月份選單（互斥）
    if (isFoodMode) {
        const monthlyPanel = document.getElementById("monthly-panel");
        if (monthlyPanel) monthlyPanel.classList.remove("show");
        isMonthlyPanelOpen = false;
        foodBtn.classList.add("food-mode-active");
        showToast("🍜 美食模式開啟，點擊縣市只看美食照片");
    } else {
        foodBtn.classList.remove("food-mode-active");
        showToast("🍜 美食模式關閉");
    }
    
    // 重新整理目前縣市的照片
    const cnameEl = document.getElementById("cname");
    if (cnameEl && cnameEl.innerText !== "等待探索") {
        renderThumbs(cnameEl.innerText);
    }
}

// ========== 每月必去 ==========
let isMonthlyPanelOpen = false;

function toggleMonthlyPanel() {
    const panel = document.getElementById("monthly-panel");
    if (!panel) return;
    
    isMonthlyPanelOpen = !isMonthlyPanelOpen;
    if (isMonthlyPanelOpen) {
        panel.classList.add("show");
    } else {
        panel.classList.remove("show");
    }
}

function filterByMonth(month) {
    // 不關閉選單，只顯示該月份照片
    showMonthPhotos(month);
}

function showMonthPhotos(month) {
    const monthStr = `${month}月`;
    const allPhotos = [];
    
    // 收集所有縣市有該月份標籤的照片
    for (const [county, photos] of Object.entries(photoData)) {
        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            if (photo.tags && photo.tags.includes(monthStr)) {
                allPhotos.push({
                    county: county,
                    index: i,
                    photo: photo
                });
            }
        }
    }
    
    if (allPhotos.length === 0) {
        showToast(`📅 ${monthStr} 沒有推薦景點`);
        return;
    }
    
    // 顯示在右側面板
    displayMonthPhotos(allPhotos, monthStr);
}

function displayMonthPhotos(photos, monthStr) {
    const grid = document.getElementById("thumb-grid");
    const cname = document.getElementById("cname");
    
    cname.innerHTML = `📅 ${monthStr} 推薦景點<br><span style="font-size: 0.6em; color: var(--accent); font-weight: normal;">共 ${photos.length} 個景點</span>`;
    
    grid.innerHTML = photos.map(item => {
        const p = item.photo;
        const isFavorite = favoriteSpots.some(spot => spot.county === item.county && spot.photoIndex === item.index);
        return `
            <div class="thumb-card" style="position: relative;"
                 onmouseover="previewCounty('${item.county}')"
                 onmouseleave="clearPreview()">
                <img src="${photoBasePath}small${p.i}.webp" onerror="this.src='https://placehold.co/200x150?text=Photo'" onclick="openModalFromMonth('${item.county}', ${item.index})">
                <div class="favorite-star" 
                    data-county="${item.county}" 
                    data-idx="${item.index}"
                    onclick="event.stopPropagation(); addFavoriteSpot('${item.county}', ${item.index}, '${p.s.replace(/'/g, "\\'")}')" 
                    style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: 0.2s;">
                    ${isFavorite ? '⭐' : '☆'}
                </div>
                <p>${p.s}</p>
            </div>
        `;
    }).join("");
}

function openModalFromMonth(county, index) {
    userInteractionStop();
    const p = photoData[county][index];
    const modalImg = document.getElementById("modal-img");
    const modalTitle = document.getElementById("modal-title");
    const modalOverlay = document.getElementById("modal-overlay");
    
    if (modalImg) modalImg.src = `${largePhotoBasePath}large${p.i}.webp`;
    if (modalTitle) {
        let monthText = "";
        if (p.tags) {
            const months = p.tags.filter(t => t.match(/\d月/));
            if (months.length > 0) {
                monthText = `<br><span style="font-size: 0.7em; color: var(--accent);">📅 適合月份：${months.join('、')}</span>`;
            }
        }
        modalTitle.innerHTML = `${p.s}${monthText}`;
    }
    if (modalOverlay) modalOverlay.style.display = "flex";
    ensurePhotoPanelOpen();
}

function showMenu(menuName) {
    if (activeMenu === menuName && document.querySelector(`#menu-${menuName} .menu-trigger`).classList.contains('locked')) return;
    
    const dropdown = document.getElementById(`dropdown-${menuName}`);
    const trigger = document.querySelector(`#menu-${menuName} .menu-trigger`);
    
    if (activeMenu && activeMenu !== menuName) {
        const prevDropdown = document.getElementById(`dropdown-${activeMenu}`);
        const prevTrigger = document.querySelector(`#menu-${activeMenu} .menu-trigger`);
        if (prevDropdown) prevDropdown.classList.remove("show");
        if (prevTrigger) prevTrigger.classList.remove("active");
    }
    
    if (dropdown) dropdown.classList.add("show");
    if (trigger) trigger.classList.add("active");
    activeMenu = menuName;
}

function hideMenu(menuName) {
    const trigger = document.querySelector(`#menu-${menuName} .menu-trigger`);
    if (trigger && trigger.classList.contains('locked')) return;
    
    const dropdown = document.getElementById(`dropdown-${menuName}`);
    if (dropdown) dropdown.classList.remove("show");
    if (trigger) trigger.classList.remove("active");
    if (activeMenu === menuName) activeMenu = null;
}

function toggleMenu(menuName) {
    const dropdown = document.getElementById(`dropdown-${menuName}`);
    const trigger = document.querySelector(`#menu-${menuName} .menu-trigger`);
    
    if (!dropdown || !trigger) return;
    
    if (activeMenu === menuName && trigger.classList.contains('locked')) {
        dropdown.classList.remove("show");
        trigger.classList.remove("active");
        trigger.classList.remove("locked");
        activeMenu = null;
    } else {
        if (activeMenu) {
            const prevDropdown = document.getElementById(`dropdown-${activeMenu}`);
            const prevTrigger = document.querySelector(`#menu-${activeMenu} .menu-trigger`);
            if (prevDropdown) prevDropdown.classList.remove("show");
            if (prevTrigger) {
                prevTrigger.classList.remove("active");
                prevTrigger.classList.remove("locked");
            }
        }
        dropdown.classList.add("show");
        trigger.classList.add("active");
        trigger.classList.add("locked");
        activeMenu = menuName;
    }
}

function setupHoverEvents() {
    const taiwanItem = document.getElementById('menu-taiwan');
    const transportItem = document.getElementById('menu-transport');
    const foodItem = document.getElementById('menu-food');
    const monthlyItem = document.getElementById('menu-monthly');
    
    if (taiwanItem) {
        taiwanItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            showMenu('taiwan');
        });
        taiwanItem.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('taiwan'), 200);
        });
    }
    
    if (transportItem) {
        transportItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            showMenu('transport');
        });
        transportItem.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('transport'), 200);
        });
    }
    
    if (foodItem) {
        foodItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            showMenu('food');
        });
        foodItem.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('food'), 200);
        });
    }
    
    if (monthlyItem) {
        monthlyItem.addEventListener('mouseenter', () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            showMenu('monthly');
        });
        monthlyItem.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('monthly'), 200);
        });
    }
    
    const taiwanDropdown = document.getElementById('dropdown-taiwan');
    const transportDropdown = document.getElementById('dropdown-transport');
    const foodDropdown = document.getElementById('dropdown-food');
    const monthlyDropdown = document.getElementById('dropdown-monthly');
    
    if (taiwanDropdown) {
        taiwanDropdown.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        taiwanDropdown.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('taiwan'), 200);
        });
    }
    
    if (transportDropdown) {
        transportDropdown.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        transportDropdown.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('transport'), 200);
        });
    }
    
    if (foodDropdown) {
        foodDropdown.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        foodDropdown.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('food'), 200);
        });
    }
    
    if (monthlyDropdown) {
        monthlyDropdown.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        monthlyDropdown.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => hideMenu('monthly'), 200);
        });
    }
}

let currentPreviewRegion = null;
let previewTimer = null;
let currentCountyIndex = -1;

function previewRegion(regionName) {
    if (cruiseInt) {
        clearInterval(cruiseInt);
        cruiseInt = null;
    }
    
    if (previewTimer) clearTimeout(previewTimer);
    currentPreviewRegion = regionName;
    
    d3.selectAll(".county").each(function() {
        const currentClass = d3.select(this).attr("class");
        if (!currentClass || (!currentClass.includes("active") && !currentClass.includes("favorite"))) {
            d3.select(this).attr("class", "county");
        }
    });
    d3.selectAll(".county-label").classed("label-visible", false);
    
    const kinmenBtn = d3.select("#btn-Kinmen");
    const lienchiangBtn = d3.select("#btn-Lienchiang");
    const penghuBtn = d3.select("#btn-Penghu");
    if (!kinmenBtn.classed("locked")) kinmenBtn.style("background", "").style("color", "");
    if (!lienchiangBtn.classed("locked")) lienchiangBtn.style("background", "").style("color", "");
    if (!penghuBtn.classed("locked")) penghuBtn.style("background", "").style("color", "");
    
    const showIslands = !["直轄市", "市", "縣"].includes(regionName);
    if(regionName === "離島區域") {
        d3.select("#btn-Lienchiang").style("background", uiConfig.accentColor).style("color", "#000");
        d3.select("#btn-Kinmen").style("background", uiConfig.accentColor).style("color", "#000");
        d3.select("#btn-Penghu").style("background", uiConfig.accentColor).style("color", "#000");
    }
    groups[regionName].forEach(c => {
        d3.select(`#path-${c}`).classed(groupStyles[regionName], true);
        d3.selectAll(`.label-${c}`).classed("label-visible", true);
        if (showIslands && subIslands[c]) {
            subIslands[c].forEach(isl => d3.selectAll(`.label-${isl}`).classed("label-visible", true));
        }
    });
    
    if (regionName === "離島區域") {
        d3.select("#fantasy-path-連江縣").classed(groupStyles[regionName], true);
        d3.select("#fantasy-matsu-label").classed("label-visible", true);
        if (window.fantasyExtraLabelElements) {
            window.fantasyExtraLabelElements.forEach(el => {
                el.classed("label-visible", true);
            });
        }
    }
}

function previewCounty(countyName) {
    if (cruiseInt) {
        clearInterval(cruiseInt);
        cruiseInt = null;
    }
    
    d3.selectAll(".county").each(function() {
        const currentClass = d3.select(this).attr("class");
        if (!currentClass || (!currentClass.includes("active") && !currentClass.includes("favorite"))) {
            d3.select(this).attr("class", "county");
        }
    });
    d3.selectAll(".county-label").classed("label-visible", false);
    
    d3.select(`#path-${countyName}`).classed("reg-system", true);
    d3.selectAll(`.label-${countyName}`).classed("label-visible", true);
    
    if (countyName === "金門縣") {
        d3.select("#btn-Kinmen").style("background", uiConfig.accentColor).style("color", "#000");
    } else if (countyName === "連江縣") {
        d3.select("#btn-Lienchiang").style("background", uiConfig.accentColor).style("color", "#000");
    } else if (countyName === "澎湖縣") {
        d3.select("#btn-Penghu").style("background", uiConfig.accentColor).style("color", "#000");
    }
}

function clearPreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        const hoveredItem = document.querySelector('.vertical-item:hover');
        if (hoveredItem) {
            const img = hoveredItem.querySelector('img');
            let regionName = null;
            if (img) {
                const alt = img.getAttribute('alt');
                if (alt === '北') regionName = '北臺灣';
                else if (alt === '中') regionName = '中臺灣';
                else if (alt === '南') regionName = '南臺灣';
                else if (alt === '東') regionName = '東臺灣';
                else if (alt === '西') regionName = '離島區域';
            }
            if (regionName) {
                previewRegion(regionName);
            }
            return;
        }
        
        d3.selectAll(".county").each(function() {
            const currentClass = d3.select(this).attr("class");
            if (!currentClass || (!currentClass.includes("active") && !currentClass.includes("favorite"))) {
                d3.select(this).attr("class", "county");
            }
        });
        d3.selectAll(".county-label").classed("label-visible", false);
        
        const kinmenBtn = d3.select("#btn-Kinmen");
        const lienchiangBtn = d3.select("#btn-Lienchiang");
        const penghuBtn = d3.select("#btn-Penghu");
        
        if (!kinmenBtn.classed("locked")) kinmenBtn.style("background", "").style("color", "");
        if (!lienchiangBtn.classed("locked")) lienchiangBtn.style("background", "").style("color", "");
        if (!penghuBtn.classed("locked")) penghuBtn.style("background", "").style("color", "");
        
        currentPreviewRegion = null;
        
        if (isCruise && !cruiseInt) {
            cruiseInt = setInterval(runStep, uiConfig.cruiseInterval);
        }
    }, 50);
}

function selectRegionAndClose(regionName) {
    clearAllHighlights();
    if (groups[regionName]) {
        highlightGroup(regionName);
    }
    
    if (activeMenu) {
        const dropdown = document.getElementById(`dropdown-${activeMenu}`);
        const trigger = document.querySelector(`#menu-${activeMenu} .menu-trigger`);
        if (dropdown) dropdown.classList.remove("show");
        if (trigger) {
            trigger.classList.remove("active");
            trigger.classList.remove("locked");
        }
        activeMenu = null;
    }
}

function clearAllHighlights() {
    d3.selectAll(".county").attr("class", "county");
    d3.selectAll(".county-label").classed("label-visible", false);
    d3.select("#btn-Kinmen").style("background", "").style("color", "");
    d3.select("#btn-Lienchiang").style("background", "").style("color", "");
    d3.select("#btn-Penghu").style("background", "").style("color", "");
    
    d3.select("#fantasy-path-連江縣").classed("reg-islands", false);
    d3.select("#fantasy-matsu-label").classed("label-visible", false);
    if (window.fantasyExtraLabelElements) {
        window.fantasyExtraLabelElements.forEach(el => {
            el.classed("label-visible", false);
        });
    }
}

// ========== 照片面板控制 ==========
function togglePhotoPanel() {
    const panel = document.getElementById("photoPanel");
    const handleText = document.getElementById("panel-handle-text");
    const body = document.body;
    if (!panel) return;
    
    panel.classList.toggle("open");
    
    if (panel.classList.contains("open")) {
        body.classList.add("panel-open");
        if (handleText) handleText.innerHTML = "📷 收起照片";
    } else {
        body.classList.remove("panel-open");
        if (handleText) handleText.innerHTML = "📷 展開照片";
    }
}

function ensurePhotoPanelOpen() {
    const panel = document.getElementById("photoPanel");
    const body = document.body;
    if (!panel) return;
    if (!panel.classList.contains("open")) {
        panel.classList.add("open");
        body.classList.add("panel-open");
    }
}

// ========== 搜尋功能 ==========
function searchCounty() {
    const input = document.getElementById('search-input');
    const resultsDiv = document.getElementById('search-results');
    if (!input || !resultsDiv) return;
    const keyword = input.value.trim();
    
    if (keyword === '') {
        resultsDiv.classList.remove('show');
        return;
    }
    
    if (!allCountiesNames || allCountiesNames.length === 0) {
        console.warn('縣市名稱列表尚未準備完成');
        resultsDiv.innerHTML = '<div class="search-result-item">⏳ 地圖載入中，請稍後...</div>';
        resultsDiv.classList.add('show');
        return;
    }
    
    const matches = allCountiesNames.filter(name => name.includes(keyword));
    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(name => 
            `<div class="search-result-item" onclick="goToCounty('${name}')">📍 ${name}</div>`
        ).join('');
        resultsDiv.classList.add('show');
    } else {
        resultsDiv.innerHTML = '<div class="search-result-item">😢 找不到縣市</div>';
        resultsDiv.classList.add('show');
    }
}

function goToCounty(countyName) {
    const input = document.getElementById('search-input');
    const resultsDiv = document.getElementById('search-results');
    if (input) input.value = '';
    if (resultsDiv) resultsDiv.classList.remove('show');
    const countyPath = d3.select(`#path-${countyName}`);
    if (countyPath.node()) {
        userInteractionStop();
        selectCounty(countyName, countyPath);
        ensurePhotoPanelOpen();
    }
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-area')) {
        const resultsDiv = document.getElementById('search-results');
        if (resultsDiv) resultsDiv.classList.remove('show');
    }
});

// ========== 交通開關 ==========
function toggleTra() {
    showTraLines = !showTraLines;
    showTraStations = !showTraStations;
    d3.selectAll("#railways .tra-line").style("display", showTraLines ? "block" : "none");
    d3.selectAll(".tra-stations").style("display", showTraStations ? "block" : "none");
    d3.selectAll(".tra-stations .tra-station").style("display", showTraStations ? "block" : "none");
    d3.selectAll(".tra-stations circle").style("display", showTraStations ? "block" : "none");
}

function toggleHsr() {
    showHsrLines = !showHsrLines;
    showHsrStations = !showHsrStations;
    d3.selectAll("#railways .hsr-line").style("display", showHsrLines ? "block" : "none");
    d3.selectAll(".hsr-stations").style("display", showHsrStations ? "block" : "none");
    d3.selectAll(".hsr-stations .hsr-station").style("display", showHsrStations ? "block" : "none");
    d3.selectAll(".hsr-dots").style("display", showHsrLines ? "block" : "none");
    d3.selectAll(".hsr-stations circle").style("display", showHsrStations ? "block" : "none");
}

function toggleAirports(type) {
    if(type === 'hk') {
        showHk = !showHk;
        d3.selectAll(".ap-hk *").classed("airport-visible label-visible", showHk);
    } else {
        showDom = !showDom;
        d3.selectAll(".ap-dom *").classed("airport-visible label-visible", showDom);
    }
}

// ========== 縣市選擇 ==========
function selectCounty(name, el) {
    clearAllHighlights();
    if(el) el.classed("active", true);
    if (name === "金門縣") {
        d3.select("#btn-Kinmen").style("background", uiConfig.accentColor).style("color", "#000");
    } else if (name === "連江縣") {
        d3.select("#btn-Lienchiang").style("background", uiConfig.accentColor).style("color", "#000");
    } else if (name === "澎湖縣") {
        d3.select("#btn-Penghu").style("background", uiConfig.accentColor).style("color", "#000");
    }
    d3.selectAll(`.label-${name}`).classed("label-visible", true);
    if(subIslands[name]) {
        subIslands[name].forEach(isl => d3.selectAll(`.label-${isl}`).classed("label-visible", true));
    }
    renderThumbs(name);
}

function clickIsland(n, b) {
    userInteractionStop();
    if (n === "連江縣") {
        selectCounty(n, d3.select("#fantasy-path-連江縣"));
        if (window.fantasyExtraLabelElements) {
            window.fantasyExtraLabelElements.forEach(el => {
                el.classed("label-visible", true);
            });
        }
    } else {
        selectCounty(n, d3.select(`#path-${n}`));
    }
    ensurePhotoPanelOpen();
    d3.select(b).style("background", uiConfig.accentColor).style("color", "#000");
}

function hoverIsland(countyName) {
    d3.selectAll(".county").attr("class", "county");
    d3.selectAll(".county-label").classed("label-visible", false);
    
    if (countyName === "連江縣") {
        d3.select("#fantasy-path-連江縣").classed("active", true);
        d3.select("#fantasy-matsu-label").classed("label-visible", true);
        if (window.fantasyExtraLabelElements) {
            window.fantasyExtraLabelElements.forEach(el => el.classed("label-visible", true));
        }
    } else {
        d3.select(`#path-${countyName}`).classed("active", true);
        d3.selectAll(`.label-${countyName}`).classed("label-visible", true);
        if (window.subIslands && window.subIslands[countyName]) {
            window.subIslands[countyName].forEach(isl => d3.selectAll(`.label-${isl}`).classed("label-visible", true));
        }
    }
    
    d3.select(`#btn-${countyName === '連江縣' ? 'Lienchiang' : countyName === '金門縣' ? 'Kinmen' : 'Penghu'}`).style("background", "var(--accent)").style("color", "#000");
}

function clearIslandHover() {
    const activeCounty = d3.select(".county.active");
    if (activeCounty.empty()) {
        d3.selectAll(".county").attr("class", "county");
        d3.selectAll(".county-label").classed("label-visible", false);
        d3.select("#fantasy-path-連江縣").classed("active", false);
        d3.select("#fantasy-matsu-label").classed("label-visible", false);
        if (window.fantasyExtraLabelElements) {
            window.fantasyExtraLabelElements.forEach(el => el.classed("label-visible", false));
        }
    }
    
    const btnKinmen = d3.select("#btn-Kinmen");
    const btnLienchiang = d3.select("#btn-Lienchiang");
    const btnPenghu = d3.select("#btn-Penghu");
    
    if (!btnKinmen.classed("locked")) btnKinmen.style("background", "").style("color", "");
    if (!btnLienchiang.classed("locked")) btnLienchiang.style("background", "").style("color", "");
    if (!btnPenghu.classed("locked")) btnPenghu.style("background", "").style("color", "");
}

function highlightGroup(gName) {
    if (!groups[gName]) return;
    const showIslands = !["直轄市", "市", "縣"].includes(gName);
    if(gName === "離島區域") {
        d3.select("#btn-Lienchiang").style("background", uiConfig.accentColor).style("color", "#000");
        d3.select("#btn-Kinmen").style("background", uiConfig.accentColor).style("color", "#000");
        d3.select("#btn-Penghu").style("background", uiConfig.accentColor).style("color", "#000");
    }
    groups[gName].forEach(c => {
        d3.select(`#path-${c}`).classed(groupStyles[gName], true);
        d3.selectAll(`.label-${c}`).classed("label-visible", true);
        if (showIslands && subIslands[c]) {
            subIslands[c].forEach(isl => d3.selectAll(`.label-${isl}`).classed("label-visible", true));
        }
    });
    
    if (gName === "離島區域") {
        d3.select("#fantasy-path-連江縣").classed(groupStyles[gName], true);
        d3.select("#fantasy-matsu-label").classed("label-visible", true);
        if (window.fantasyExtraLabelElements) {
            window.fantasyExtraLabelElements.forEach(el => {
                el.classed("label-visible", true);
            });
        }
    }
}

// ========== 巡航模式 ==========
function userInteractionStop() {
    if (!isCruise) return;
    clearInterval(cruiseInt);
    clearTimeout(resumeTimeout);
    const cruiseDot = document.getElementById("cruise-dot");
    const cruiseText = document.getElementById("cruise-text");
    if (cruiseDot) cruiseDot.style.background = "#ff4444";
    if (cruiseText) cruiseText.innerHTML = "手動";
    resumeTimeout = setTimeout(() => {
        if (isCruise) startCruise();
    }, uiConfig.manualResumeTime);
}

function startCruise() {
    clearInterval(cruiseInt);
    const cruiseDot = document.getElementById("cruise-dot");
    const cruiseText = document.getElementById("cruise-text");
    if (cruiseDot) cruiseDot.style.background = uiConfig.accentColor;
    if (cruiseText) cruiseText.innerHTML = "巡航中";
    ensurePhotoPanelOpen();
    
    if (!cruiseList || cruiseList.length === 0) {
        console.warn('巡航列表尚未準備完成，等待資料載入...');
        return;
    }
    
    cruiseInt = setInterval(runStep, uiConfig.cruiseInterval);
}

function runStep() {
    if (!cruiseList || cruiseList.length === 0) {
        console.warn('巡航列表尚未準備完成，跳過本次巡航');
        return;
    }
    
    const itm = cruiseList[curIdx];
    if(itm.t === 'm') {
        selectCounty(itm.n, d3.select(`#path-${itm.n}`));
    } else {
        clearAllHighlights();
        d3.select(`#${itm.id}`).style("background", uiConfig.accentColor).style("color", "#000");
        renderThumbs(itm.n);
    }
    curIdx = (curIdx + 1) % cruiseList.length;
}

function toggleCruiseMaster() {
    isCruise = !isCruise;
    if (isCruise) {
        startCruise();
    } else {
        clearInterval(cruiseInt);
        const cruiseText = document.getElementById("cruise-text");
        if (cruiseText) cruiseText.innerHTML = "停止";
        cruiseInt = null;
    }
}

// ========== 照片顯示 ==========
function renderThumbs(name) {
    const grid = document.getElementById("thumb-grid");
    const cname = document.getElementById("cname");
    if (!grid) return;
    let photos = photoData[name] || [];
    
    // 美食模式篩選
    if (isFoodMode) {
        photos = photos.filter(p => p.tags && p.tags.includes("美食"));
    }
    
    // 設定標題
    if (cname) {
        if (isFoodMode) {
            cname.innerHTML = `${name}<br><span style="font-size: 0.6em; color: var(--accent);">🍜 美食模式中</span>`;
        } else {
            cname.innerText = name;
        }
    }
    
    grid.innerHTML = photos.map((p, i) => {
        const isFavorite = favoriteSpots.some(spot => spot.county === name && spot.photoIndex === i);
        return `
            <div class="thumb-card" style="position: relative;">
                <img src="${photoBasePath}small${p.i}.webp" onerror="this.src='https://placehold.co/200x150?text=Photo'" onclick="openModal('${name}', ${i})">
                <div class="favorite-star" 
                    data-county="${name}" 
                    data-idx="${i}"
                    onclick="event.stopPropagation(); addFavoriteSpot('${name}', ${i}, '${p.s.replace(/'/g, "\\'")}')" 
                    style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: 0.2s;">
                    ${isFavorite ? '⭐' : '☆'}
                </div>
                <p>${p.s}</p>
            </div>
        `;
    }).join("");
    
    if (window.innerWidth <= 768) {
        const gridEl = document.getElementById("thumb-grid");
        if (gridEl) {
            let isDown = false;
            let startX;
            let scrollLeft;
            
            const onMouseDown = (e) => {
                isDown = true;
                gridEl.style.cursor = 'grabbing';
                startX = e.pageX - gridEl.offsetLeft;
                scrollLeft = gridEl.scrollLeft;
            };
            
            const onMouseLeave = () => {
                isDown = false;
                gridEl.style.cursor = 'grab';
            };
            
            const onMouseUp = () => {
                isDown = false;
                gridEl.style.cursor = 'grab';
            };
            
            const onMouseMove = (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - gridEl.offsetLeft;
                const walk = (x - startX) * 2;
                gridEl.scrollLeft = scrollLeft - walk;
            };
            
            gridEl.addEventListener('mousedown', onMouseDown);
            gridEl.addEventListener('mouseleave', onMouseLeave);
            gridEl.addEventListener('mouseup', onMouseUp);
            gridEl.addEventListener('mousemove', onMouseMove);
            gridEl.style.cursor = 'grab';
        }
    }

    const totalSpan = document.getElementById("total-count");
    if (totalSpan) totalSpan.innerText = Object.values(photoData).flat().length;
}

function openModal(c, i) {
    userInteractionStop();
    const p = photoData[c][i];
    const modalImg = document.getElementById("modal-img");
    const modalTitle = document.getElementById("modal-title");
    const modalOverlay = document.getElementById("modal-overlay");
    
    if (modalImg) modalImg.src = `${largePhotoBasePath}large${p.i}.webp`;
    if (modalTitle) {
        let monthText = "";
        if (p.tags) {
            const months = p.tags.filter(t => t.match(/\d月/));
            if (months.length > 0) {
                monthText = `<br><span style="font-size: 0.7em; color: var(--accent);">📅 適合月份：${months.join('、')}</span>`;
            }
        }
        modalTitle.innerHTML = `${p.s}${monthText}`;
    }
    if (modalOverlay) modalOverlay.style.display = "flex";
    ensurePhotoPanelOpen();
}

function closeModal() {
    const modalOverlay = document.getElementById("modal-overlay");
    if (modalOverlay) modalOverlay.style.display = "none";
}

// ========== 音樂控制 ==========
function toggleMusic() {
    const musicBtn = document.getElementById("music-toggle");
    if (!musicBtn || !bgm) return;
    if (bgm.paused) {
        bgm.play();
        musicBtn.innerText = musicConfig.playIcon;
        musicBtn.classList.add("playing");
    } else {
        bgm.pause();
        musicBtn.innerText = musicConfig.stopIcon;
        musicBtn.classList.remove("playing");
    }
}

// ========== 主題切換 ==========
function toggleTheme() {
    const html = document.documentElement;
    const themeBtn = document.querySelector('.theme-toggle');
    if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        if (themeBtn) {
            themeBtn.innerHTML = '☀️';
            themeBtn.style.background = 'rgba(255,255,255,0.9)';
        }
    } else {
        html.setAttribute('data-theme', 'dark');
        if (themeBtn) {
            themeBtn.innerHTML = '🌙';
            themeBtn.style.background = 'rgba(0,0,0,0.7)';
        }
    }
}

// ========== 鍵盤控制 ==========
function initKeyboardControl() {
    function setupKeyboard() {
        if (!allCountiesNames || allCountiesNames.length === 0) {
            console.log('等待縣市資料載入...');
            return false;
        }
        
        allCountiesList = [...allCountiesNames];
        console.log('✅ 鍵盤控制已啟用，共 ' + allCountiesList.length + ' 個縣市');
        
        const neighbors = {
            "基隆市": { N: "連江縣", S: "臺北市", E: "新北市", W: "新北市" },
            "臺北市": { N: "基隆市", S: "新北市", E: "基隆市", W: "新北市" },
            "新北市": { N: "臺北市", S: "桃園市", E: "宜蘭縣", W: "桃園市" },
            "桃園市": { N: "新北市", S: "新竹縣", E: "新北市", W: "新竹縣" },
            "新竹縣": { N: "桃園市", S: "苗栗縣", E: "宜蘭縣", W: "新竹市" },
            "新竹市": { N: "桃園市", S: "苗栗縣", E: "新竹縣", W: "苗栗縣" },
            "苗栗縣": { N: "新竹市", S: "臺中市", E: "新竹縣", W: "金門縣" },
            "臺中市": { N: "苗栗縣", S: "彰化縣", E: "南投縣", W: "澎湖縣" },
            "彰化縣": { N: "臺中市", S: "雲林縣", E: "南投縣", W: "澎湖縣" },
            "南投縣": { N: "臺中市", S: "高雄市", E: "花蓮縣", W: "彰化縣" },
            "雲林縣": { N: "彰化縣", S: "嘉義縣", E: "南投縣", W: "澎湖縣" },
            "嘉義縣": { N: "嘉義市", S: "臺南市", E: "南投縣", W: "嘉義市" },
            "嘉義市": { N: "雲林縣", S: "嘉義縣", E: "嘉義縣", W: "嘉義縣" },
            "臺南市": { N: "嘉義縣", S: "高雄市", E: "高雄市", W: "澎湖縣" },
            "高雄市": { N: "臺南市", S: "屏東縣", E: "屏東縣", W: "臺南市" },
            "屏東縣": { N: "高雄市", S: "臺東縣", E: "臺東縣", W: "高雄市" },
            "宜蘭縣": { N: "新北市", S: "花蓮縣", E: "花蓮縣", W: "新北市" },
            "花蓮縣": { N: "宜蘭縣", S: "臺東縣", E: "臺東縣", W: "南投縣" },
            "臺東縣": { N: "花蓮縣", S: "屏東縣", E: "花蓮縣", W: "屏東縣" },
            "澎湖縣": { E: "臺中市", W: "金門縣", N: "連江縣", S: "臺南市" },
            "金門縣": { E: "澎湖縣", W: null, N: "連江縣", S: "澎湖縣" },
            "連江縣": { S: "基隆市", N: null, W: "金門縣", E: "基隆市" }
        };
        
        function findNearestCounty(currentCountyName, targetDirection) {
            if (neighbors[currentCountyName] && neighbors[currentCountyName][targetDirection]) {
                return neighbors[currentCountyName][targetDirection];
            }
            return null;
        }
        
        document.addEventListener('keydown', function(e) {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            
            let currentCounty = null;
            d3.selectAll(".county.active").each(function() {
                const id = d3.select(this).attr("id");
                if (id) {
                    if (id === 'fantasy-path-連江縣') {
                        currentCounty = '連江縣';
                    } else if (id.startsWith('path-')) {
                        currentCounty = id.replace('path-', '');
                    }
                }
            });
            
            if (!currentCounty) {
                const cnameEl = document.getElementById('cname');
                if (cnameEl && cnameEl.innerText !== '等待探索') {
                    currentCounty = cnameEl.innerText;
                }
            }
            
            if (!currentCounty) return;
            
            let direction = null;
            switch(e.key) {
                case 'ArrowUp': direction = 'N'; break;
                case 'ArrowDown': direction = 'S'; break;
                case 'ArrowLeft': direction = 'W'; break;
                case 'ArrowRight': direction = 'E'; break;
                default: return;
            }
            
            e.preventDefault();
            userInteractionStop();
            
            const newCounty = findNearestCounty(currentCounty, direction);
            
            if (newCounty && newCounty !== currentCounty) {
                if (newCounty === "連江縣") {
                    const fantasyPath = d3.select("#fantasy-path-連江縣");
                    if (fantasyPath.node()) {
                        selectCounty(newCounty, fantasyPath);
                        if (window.fantasyExtraLabelElements) {
                            window.fantasyExtraLabelElements.forEach(el => {
                                el.classed("label-visible", true);
                            });
                        }
                    } else {
                        const countyPath = d3.select(`#path-${newCounty}`);
                        if (countyPath.node()) selectCounty(newCounty, countyPath);
                    }
                } else {
                    const countyPath = d3.select(`#path-${newCounty}`);
                    if (countyPath.node()) selectCounty(newCounty, countyPath);
                }
                ensurePhotoPanelOpen();
                showToast(`📍 ${newCounty}`);
            }
        });
        
        return true;
    }
    
    if (!setupKeyboard()) {
        window.addEventListener('taiwanMapDataReady', function onReady() {
            setupKeyboard();
            window.removeEventListener('taiwanMapDataReady', onReady);
        });
    }
}

function moveDirection(direction) {
    userInteractionStop();
    
    let currentCounty = null;
    d3.selectAll(".county.active").each(function() {
        const id = d3.select(this).attr("id");
        if (id && id.startsWith('path-')) {
            currentCounty = id.replace('path-', '');
        }
    });
    
    if (!currentCounty) {
        const cnameEl = document.getElementById('cname');
        if (cnameEl && cnameEl.innerText !== '等待探索') {
            currentCounty = cnameEl.innerText;
        }
    }
    
    if (!currentCounty) return;
    
    const neighbors = {
        "基隆市": { N: "連江縣", S: "臺北市", E: "新北市", W: "新北市" },
        "臺北市": { N: "基隆市", S: "新北市", E: "基隆市", W: "新北市" },
        "新北市": { N: "臺北市", S: "桃園市", E: "宜蘭縣", W: "桃園市" },
        "桃園市": { N: "新北市", S: "新竹縣", E: "新北市", W: "新竹縣" },
        "新竹縣": { N: "桃園市", S: "苗栗縣", E: "宜蘭縣", W: "新竹市" },
        "新竹市": { N: "桃園市", S: "苗栗縣", E: "新竹縣", W: "苗栗縣" },
        "苗栗縣": { N: "新竹市", S: "臺中市", E: "新竹縣", W: "金門縣" },
        "臺中市": { N: "苗栗縣", S: "彰化縣", E: "南投縣", W: "澎湖縣" },
        "彰化縣": { N: "臺中市", S: "雲林縣", E: "南投縣", W: "澎湖縣" },
        "南投縣": { N: "臺中市", S: "高雄市", E: "花蓮縣", W: "彰化縣" },
        "雲林縣": { N: "彰化縣", S: "嘉義縣", E: "南投縣", W: "澎湖縣" },
        "嘉義縣": { N: "嘉義市", S: "臺南市", E: "南投縣", W: "嘉義市" },
        "嘉義市": { N: "雲林縣", S: "嘉義縣", E: "嘉義縣", W: "嘉義縣" },
        "臺南市": { N: "嘉義縣", S: "高雄市", E: "高雄市", W: "澎湖縣" },
        "高雄市": { N: "臺南市", S: "屏東縣", E: "屏東縣", W: "臺南市" },
        "屏東縣": { N: "高雄市", S: "臺東縣", E: "臺東縣", W: "高雄市" },
        "宜蘭縣": { N: "新北市", S: "花蓮縣", E: "花蓮縣", W: "新北市" },
        "花蓮縣": { N: "宜蘭縣", S: "臺東縣", E: "臺東縣", W: "南投縣" },
        "臺東縣": { N: "花蓮縣", S: "屏東縣", E: "花蓮縣", W: "屏東縣" },
        "澎湖縣": { E: "臺中市", W: "金門縣", N: "連江縣", S: "臺南市" },
        "金門縣": { E: "澎湖縣", W: null, N: "連江縣", S: "澎湖縣" },
        "連江縣": { S: "基隆市", N: null, W: "金門縣", E: "基隆市" }
    };
    
    let newCounty = null;
    if (neighbors[currentCounty] && neighbors[currentCounty][direction]) {
        newCounty = neighbors[currentCounty][direction];
    }
    
    if (newCounty && newCounty !== currentCounty) {
        if (newCounty === "連江縣") {
            const fantasyPath = d3.select("#fantasy-path-連江縣");
            if (fantasyPath.node()) {
                selectCounty(newCounty, fantasyPath);
                if (window.fantasyExtraLabelElements) {
                    window.fantasyExtraLabelElements.forEach(el => {
                        el.classed("label-visible", true);
                    });
                }
            }
        } else {
            const countyPath = d3.select(`#path-${newCounty}`);
            if (countyPath.node()) selectCounty(newCounty, countyPath);
        }
        ensurePhotoPanelOpen();
        showToast(`📍 ${newCounty}`);
    }
}

// ========== 初始化 ==========
if (typeof musicConfig !== 'undefined') {
    const musicToggle = document.getElementById("music-toggle");
    if (musicToggle) musicToggle.innerText = musicConfig.stopIcon;
}
buildDropdowns();
setupHoverEvents();
updateFavoriteUI();
initKeyboardControl();

const panel = document.getElementById("photoPanel");
const body = document.body;
if (panel && !panel.classList.contains("open")) {
    panel.classList.add("open");
    body.classList.add("panel-open");
}

const handleText = document.getElementById("panel-handle-text");
if (panel && handleText) {
    if (panel.classList.contains("open")) {
        handleText.innerHTML = "📷 收起照片";
    } else {
        handleText.innerHTML = "📷 展開照片";
    }
}

if (typeof cruiseList !== 'undefined' && cruiseList && cruiseList.length > 0) {
    startCruise();
} else {
    window.addEventListener('taiwanMapDataReady', function onReady() {
        startCruise();
        window.removeEventListener('taiwanMapDataReady', onReady);
    });
}