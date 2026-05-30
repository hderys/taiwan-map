// ========== 地圖核心設定 ==========
let proj = d3.geoMercator().center([121.0, 23.95]).scale(9200);
let path = d3.geoPath().projection(proj);
const svg = d3.select("#taiwan-map");

let allCountiesNames = [];
let cruiseList = [];
let currentZoom = null;
let currentTransform = null;

// ===== 幻想馬祖設定 =====
const fantasyMatsuLng = 119.5;
const fantasyMatsuLat = 24.42;
const originalMatsuCenterLng = 119.95;
const originalMatsuCenterLat = 26.15;
const deltaLng = fantasyMatsuLng - originalMatsuCenterLng;
const deltaLat = fantasyMatsuLat - originalMatsuCenterLat;
// =========================

// 馬祖附屬島嶼名稱列表（用於過濾真實馬祖）
const matsuSubIslands = ["南竿", "北竿", "東引", "西引", "東莒", "西莒"];

// 幻想馬祖附屬島嶼資料（直接使用平移後的經緯度）
const fantasySubIslandsData = [
    {n: "南竿", x: 119.93 + deltaLng, y: 26.15 + deltaLat, dx: -22, dy: 6},
    {n: "北竿", x: 119.98 + deltaLng, y: 26.22 + deltaLat, dx: 22, dy: -12},
    {n: "東引", x: 120.49 + deltaLng, y: 26.36 + deltaLat, dx: 28, dy: 0},
    {n: "西引", x: 120.47 + deltaLng, y: 26.37 + deltaLat, dx: -28, dy: 0},
    {n: "東莒", x: 119.97 + deltaLng, y: 25.96 + deltaLat, dx: 22, dy: 18},
    {n: "西莒", x: 119.93 + deltaLng, y: 25.97 + deltaLat, dx: -22, dy: 18}
];

// 手動計算幾何中心點（經緯度，不依賴 D3.js）
function computeCenter(geometry) {
    let sumX = 0, sumY = 0, count = 0;
    
    function traverse(coords) {
        if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            sumX += coords[0];
            sumY += coords[1];
            count++;
        } else if (Array.isArray(coords)) {
            coords.forEach(traverse);
        }
    }
    
    if (geometry.type === "Polygon") {
        geometry.coordinates.forEach(ring => traverse(ring));
    } else if (geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => traverse(ring));
        });
    }
    
    return count > 0 ? [sumX / count, sumY / count] : [0, 0];
}

// 台灣範圍邊界
const taiwanBounds = {
    west: 118.0,
    east: 122.0,
    north: 25.3,
    south: 21.9
};

// 偏移量定義
const traOffsets = {
    "臺北": { dx: 0, dy: -12 }, "板橋": { dx: 0, dy: 5 }, "桃園": { dx: 0, dy: 5 },
    "中壢": { dx: -3, dy: -5 }, "竹北": { dx: 0, dy: -12 }, "六家": { dx: 3, dy: -5 },
    "新竹": { dx: -3, dy: -5 }, "臺中": { dx: 3, dy: -5 }, "彰化": { dx: -3, dy: -5 },
    "員林": { dx: -3, dy: -5 }, "田中": { dx: 3, dy: -5 }, "二水": { dx: 3, dy: -5 },
    "斗六": { dx: 3, dy: -5 }, "沙崙": { dx: 3, dy: -5 }, "新左營": { dx: -3, dy: -5 },
    "屏東": { dx: 0, dy: -12 }, "潮州": { dx: 3, dy: -5 }, "基隆": { dx: 0, dy: -12 },
    "臺南": { dx: -3, dy: -5 }, "礁溪": { dx: -3, dy: -5 }, "宜蘭": { dx: -3, dy: -5 },
    "羅東": { dx: -3, dy: -5 }
};

const hsrOffsets = {
    "南港": { dx: 3, dy: -5 }, "臺北": { dx: 0, dy: 5 }, "板橋": { dx: -3, dy: -5 },
    "桃園": { dx: -3, dy: -5 }, "苗栗": { dx: -3, dy: -5 }, "臺中": { dx: -3, dy: -5 },
    "彰化": { dx: -3, dy: -5 }, "雲林": { dx: -3, dy: -5 }, "嘉義": { dx: -3, dy: -5 },
    "臺南": { dx: -3, dy: -5 }, "左營": { dx: 4, dy: -6 }
};

function getProjOffset(coords) {
    let p = proj(coords);
    let [lng, lat] = coords;
    if (lng < 120.5 && lat > 25.5) {
        return [p[0] + labelOffsets["連江縣"].x, p[1] + labelOffsets["連江縣"].y];
    }
    return p;
}

function calculateOptimalScale(containerWidth, containerHeight) {
    if (containerWidth <= 0 || containerHeight <= 0) {
        containerWidth = window.innerWidth || 400;
        containerHeight = window.innerHeight || 600;
    }
	
    const corners = [
        proj([taiwanBounds.west, taiwanBounds.north]),
        proj([taiwanBounds.east, taiwanBounds.north]),
        proj([taiwanBounds.west, taiwanBounds.south]),
        proj([taiwanBounds.east, taiwanBounds.south])
    ].filter(c => c !== null);
    
    if (corners.length === 0) return 9200;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    corners.forEach(c => {
        minX = Math.min(minX, c[0]);
        minY = Math.min(minY, c[1]);
        maxX = Math.max(maxX, c[0]);
        maxY = Math.max(maxY, c[1]);
    });
    
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const scaleX = (containerWidth * 0.78) / boundsWidth;
    const scaleY = (containerHeight * 0.78) / boundsHeight;
    const scale = Math.min(scaleX, scaleY);
    
    return Math.min(Math.max(scale * 9200, 7000), 15000);
}

// 儲存轉乘站元素的陣列
let transferStationElements = [];

function showTransferTooltip(stationName, transferInfo, event) {
    let tooltip = document.getElementById("transfer-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "transfer-tooltip";
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.95);
            color: #ffd700;
            padding: 10px 18px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 100000;
            pointer-events: none;
            border: 2px solid #ffd700;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
            font-family: "Microsoft JhengHei", sans-serif;
        `;
        document.body.appendChild(tooltip);
    }
    
    // 根據螢幕寬度調整樣式（每次顯示時重新設定）
    if (window.innerWidth <= 768) {
        tooltip.style.fontSize = "22px";
        tooltip.style.whiteSpace = "normal";
        tooltip.style.maxWidth = "240px";
        tooltip.style.textAlign = "center";
        tooltip.style.lineHeight = "1.4";
        tooltip.style.padding = "10px 16px";
    } else {
        tooltip.style.fontSize = "1.4vw";
        tooltip.style.whiteSpace = "nowrap";
        tooltip.style.maxWidth = "none";
        tooltip.style.textAlign = "left";
        tooltip.style.lineHeight = "1";
        tooltip.style.padding = "10px 18px";
    }
    
    tooltip.innerHTML = transferInfo;
    tooltip.style.left = (event.pageX + 20) + "px";
    tooltip.style.top = (event.pageY - 50) + "px";
    tooltip.style.display = "block";
}

function hideTransferTooltip() {
    const tooltip = document.getElementById("transfer-tooltip");
    if (tooltip) tooltip.style.display = "none";
}

// 為轉乘站添加金邊效果（超級明顯版 + 懸浮提示）
function addTransferGoldEffect() {
    if (!window.transferStations) return;
    
    // 清除舊的金邊
    transferStationElements.forEach(el => {
        if (el.circle) {
            el.circle.attr("stroke", el.originalStroke || "#000")
                     .attr("stroke-width", el.originalStrokeWidth || "0.5px")
                     .attr("r", el.originalRadius || 3);
            el.circle.classed("transfer-gold", false);
            el.circle.on("mouseenter", null).on("mouseleave", null);
        }
    });
    transferStationElements = [];
    
    let count = 0;
    
    window.transferStations.forEach(transfer => {
        // 找高鐵站
        const hsrStation = hsrStations.find(s => s.n === transfer.hsr);
        if (hsrStation) {
            const pos = proj([hsrStation.x, hsrStation.y]);
            if (pos) {
                const hsrCircle = d3.selectAll(".hsr-stations .station-group circle").filter(function() {
                    const cx = parseFloat(d3.select(this).attr("cx"));
                    const cy = parseFloat(d3.select(this).attr("cy"));
                    return Math.abs(cx - pos[0]) < 5 && Math.abs(cy - pos[1]) < 5;
                });
                if (!hsrCircle.empty()) {
                    const originalStroke = hsrCircle.attr("stroke");
                    const originalStrokeWidth = hsrCircle.attr("stroke-width");
                    const originalRadius = hsrCircle.attr("r");
                    
                    hsrCircle.attr("stroke", "#ffd700")
                             .attr("stroke-width", "5px")
                             .attr("r", 8)
                             .classed("transfer-gold", true);
                    
                    const info = `🚄 高鐵${transfer.hsr}站 ↔ 🚂 臺鐵${transfer.tra}站`;
                    hsrCircle.on("mouseenter", function(event) {
                        showTransferTooltip(transfer.hsr, info, event);
                    }).on("mousemove", function(event) {
                        const tooltip = document.getElementById("transfer-tooltip");
                        if (tooltip && tooltip.style.display === "block") {
                            tooltip.style.left = (event.pageX + 20) + "px";
                            tooltip.style.top = (event.pageY - 50) + "px";
                        }
                    }).on("mouseleave", function() {
                        hideTransferTooltip();
                    }).on("touchstart", function(event) {
                        event.preventDefault();
                        const touch = event.touches[0];
                        showTransferTooltip(transfer.hsr, info, touch);
                        setTimeout(() => hideTransferTooltip(), 3000);
                    });
                    
                    transferStationElements.push({
                        circle: hsrCircle,
                        originalStroke: originalStroke,
                        originalStrokeWidth: originalStrokeWidth,
                        originalRadius: originalRadius
                    });
                    count++;
                }
            }
        }
        
        // 找臺鐵站
        const traStation = traStations.find(s => s.n === transfer.tra);
        if (traStation) {
            const traCircle = d3.select(`.tra-stations .station-group circle[data-lng="${traStation.x}"]`);
            if (!traCircle.empty()) {
                const originalStroke = traCircle.attr("stroke");
                const originalStrokeWidth = traCircle.attr("stroke-width");
                const originalRadius = traCircle.attr("r");
                
                traCircle.attr("stroke", "#ffd700")
                         .attr("stroke-width", "5px")
                         .attr("r", 7)
                         .classed("transfer-gold", true);
                
                const info = `🚄 高鐵${transfer.hsr}站 ↔ 🚂 臺鐵${transfer.tra}站`;
                traCircle.on("mouseenter", function(event) {
                    showTransferTooltip(transfer.tra, info, event);
                }).on("mousemove", function(event) {
                    const tooltip = document.getElementById("transfer-tooltip");
                    if (tooltip && tooltip.style.display === "block") {
                        tooltip.style.left = (event.pageX + 20) + "px";
                        tooltip.style.top = (event.pageY - 50) + "px";
                    }
                }).on("mouseleave", function() {
                    hideTransferTooltip();
                }).on("touchstart", function(event) {
                    event.preventDefault();
                    const touch = event.touches[0];
                    showTransferTooltip(transfer.tra, info, touch);
                    setTimeout(() => hideTransferTooltip(), 3000);
                });
                
                transferStationElements.push({
                    circle: traCircle,
                    originalStroke: originalStroke,
                    originalStrokeWidth: originalStrokeWidth,
                    originalRadius: originalRadius
                });
                count++;
            }
        }
    });
    
    console.log("✅ 已標記 " + count + " 個轉乘站點");
}

// 儲存捷運路線的DOM元素，以便重新繪製
let mrtLineElements = [];

// 繪製捷運路線的函數
function drawMrtLines(railwayG, lineGen) {
    if (!transportData.mrt) return;
    
    // 清除舊的捷運路線
    mrtLineElements.forEach(el => el.remove());
    mrtLineElements = [];
    
    // 臺北捷運
    if (transportData.mrt.taipei) {
        const taipeiMRT = transportData.mrt.taipei;
        const mrtColors = {
            banNan: "#0055a4",
            tamsuiXinyi: "#d11e2e",
            songshanXindian: "#16a34a",
            zhongheXinlu: "#ff7e2e",
            wenhu: "#9e652e"
        };
        
        for (const [line, coords] of Object.entries(taipeiMRT)) {
            if (coords && coords.length > 0) {
                const path = railwayG.append("path")
                    .datum(coords)
                    .attr("class", "mrt-line taipei-mrt")
                    .attr("d", lineGen)
                    .attr("fill", "none")
                    .attr("stroke", mrtColors[line] || "#888")
                    .attr("stroke-width", 1.8)
                    .style("opacity", 0.8)
                    .style("display", window.showMrt ? "block" : "none");
                mrtLineElements.push(path);
            }
        }
    }
    
    // 桃園捷運
    if (transportData.mrt.taoyuan && transportData.mrt.taoyuan.length > 0) {
        const path = railwayG.append("path")
            .datum(transportData.mrt.taoyuan)
            .attr("class", "mrt-line taoyuan-mrt")
            .attr("d", lineGen)
            .attr("fill", "none")
            .attr("stroke", "#8b5cf6")
            .attr("stroke-width", 1.8)
            .style("opacity", 0.8)
            .style("display", window.showMrt ? "block" : "none");
        mrtLineElements.push(path);
    }
    
    // 臺中捷運
    if (transportData.mrt.taichung && transportData.mrt.taichung.length > 0) {
        const path = railwayG.append("path")
            .datum(transportData.mrt.taichung)
            .attr("class", "mrt-line taichung-mrt")
            .attr("d", lineGen)
            .attr("fill", "none")
            .attr("stroke", "#16a34a")
            .attr("stroke-width", 1.8)
            .style("opacity", 0.8)
            .style("display", window.showMrt ? "block" : "none");
        mrtLineElements.push(path);
    }
    
    // 高雄捷運
    if (transportData.mrt.kaohsiung) {
        if (transportData.mrt.kaohsiung.red && transportData.mrt.kaohsiung.red.length > 0) {
            const path = railwayG.append("path")
                .datum(transportData.mrt.kaohsiung.red)
                .attr("class", "mrt-line kaohsiung-mrt-red")
                .attr("d", lineGen)
                .attr("fill", "none")
                .attr("stroke", "#e11d48")
                .attr("stroke-width", 1.8)
                .style("opacity", 0.8)
                .style("display", window.showMrt ? "block" : "none");
            mrtLineElements.push(path);
        }
        if (transportData.mrt.kaohsiung.orange && transportData.mrt.kaohsiung.orange.length > 0) {
            const path = railwayG.append("path")
                .datum(transportData.mrt.kaohsiung.orange)
                .attr("class", "mrt-line kaohsiung-mrt-orange")
                .attr("d", lineGen)
                .attr("fill", "none")
                .attr("stroke", "#f59e0b")
                .attr("stroke-width", 1.8)
                .style("opacity", 0.8)
                .style("display", window.showMrt ? "block" : "none");
            mrtLineElements.push(path);
        }
    }
}

function updateProjectionAndPaths() {
    path = d3.geoPath().projection(proj);
    
    d3.selectAll("#taiwan-map .county:not(.fantasy-matsu)").attr("d", function(d) {
        return path(d);
    });
    
    if (window.fantasyMatsuFeature) {
        d3.selectAll("#taiwan-map .fantasy-matsu").attr("d", function() {
            return path(window.fantasyMatsuFeature);
        });
        const manualCenter = computeCenter(window.fantasyMatsuFeature.geometry);
        const fantasyCenter = proj(manualCenter);
        const fantasyLabel = d3.select("#fantasy-matsu-label");
        if (!fantasyLabel.empty() && fantasyCenter && fantasyCenter[0] && fantasyCenter[1]) {
            fantasyLabel.attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]})`);
        }
    }
    
    d3.selectAll("#taiwan-map .county-label:not(.fantasy-matsu-label):not(.fantasy-extra-label):not(.label-連江縣)").each(function() {
        const classStr = d3.select(this).attr("class");
        const match = classStr.match(/label-([^\s]+)/);
        if (!match) return;
        const countyName = match[1];
        
        const feature = window.originalCountiesData?.find(f => formatN(f) === countyName);
        if (!feature) return;
        
        const center = path.centroid(feature);
        if (!center || !isFinite(center[0]) || !isFinite(center[1])) return;
        
        let x = center[0], y = center[1];
        if (labelOffsets[countyName]) {
            x += labelOffsets[countyName].x;
            y += labelOffsets[countyName].y;
        }
        d3.select(this).attr("transform", `translate(${x}, ${y})`);
    });
    
    d3.selectAll("#taiwan-map .extra-label:not(.fantasy-extra-label)").each(function() {
        const d = d3.select(this).datum();
        if (d && !matsuSubIslands.includes(d.n)) {
            d3.select(this)
                .attr("x", getProjOffset([d.x, d.y])[0] + (d.dx || 0))
                .attr("y", getProjOffset([d.x, d.y])[1] + (d.dy || 0));
        }
    });
    
    if (window.fantasyExtraLabelElements && window.fantasyExtraLabelsData) {
        window.fantasyExtraLabelElements.forEach((element, idx) => {
            const d = window.fantasyExtraLabelsData[idx];
            if (d && element) {
                const pos = proj([d.x, d.y]);
                if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
                    element.attr("x", pos[0] + (d.dx || 0))
                           .attr("y", pos[1] + (d.dy || 0));
                }
            }
        });
    }
    
    d3.selectAll("#railways .tra-line").attr("d", function(d) {
        return d3.line().x(dd => proj(dd)[0]).y(dd => proj(dd)[1])(d);
    });
    
    d3.selectAll("#railways .hsr-line").attr("d", function(d) {
        return d3.line().x(dd => proj(dd)[0]).y(dd => proj(dd)[1])(d);
    });
    
    // 重新繪製捷運路線（使用新的投影）
     const railwayG = d3.select("#railways");
     const newLineGen = d3.line().x(d => proj(d)[0]).y(d => proj(d)[1]);
    // drawMrtLines(railwayG, newLineGen);
    
    d3.selectAll(".tra-stations .station-group").each(function() {
        const group = d3.select(this);
        const circle = group.select("circle");
        const text = group.select(".tra-station");
        if (circle.node()) {
            const lng = parseFloat(circle.attr("data-lng"));
            const lat = parseFloat(circle.attr("data-lat"));
            if (!isNaN(lng) && !isNaN(lat)) {
                const pos = proj([lng, lat]);
                if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
                    circle.attr("cx", pos[0]).attr("cy", pos[1]);
                    if (text.node()) {
                        const stationName = text.text();
                        const offset = traOffsets[stationName] || { dx: 0, dy: 3 };
                        let anchor = offset.dx < 0 ? "end" : (offset.dx > 0 ? "start" : "middle");
                        text.attr("x", pos[0] + offset.dx)
                            .attr("y", pos[1] + offset.dy)
                            .attr("text-anchor", anchor);
                    }
                }
            }
        }
    });
    
    d3.selectAll(".hsr-stations .station-group").each(function() {
        const group = d3.select(this);
        const circle = group.select(".hsr-dot");
        const text = group.select(".hsr-station");
        if (circle.node()) {
            const lng = parseFloat(circle.attr("data-lng"));
            const lat = parseFloat(circle.attr("data-lat"));
            if (!isNaN(lng) && !isNaN(lat)) {
                const pos = proj([lng, lat]);
                if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
                    circle.attr("cx", pos[0]).attr("cy", pos[1]);
                    if (text.node()) {
                        const stationName = text.text();
                        const offset = hsrOffsets[stationName] || { dx: 0, dy: 3 };
                        let anchor = offset.dx < 0 ? "end" : (offset.dx > 0 ? "start" : "middle");
                        text.attr("x", pos[0] + offset.dx)
                            .attr("y", pos[1] + offset.dy)
                            .attr("text-anchor", anchor);
                    }
                }
            }
        }
    });
    
    d3.selectAll(".airport-icon").attr("x", function() {
        const lng = parseFloat(d3.select(this).attr("data-lng"));
        const lat = parseFloat(d3.select(this).attr("data-lat"));
        if (!isNaN(lng) && !isNaN(lat)) {
            const pos = proj([lng, lat]);
            return pos && isFinite(pos[0]) ? pos[0] : 0;
        }
        return 0;
    }).attr("y", function() {
        const lng = parseFloat(d3.select(this).attr("data-lng"));
        const lat = parseFloat(d3.select(this).attr("data-lat"));
        if (!isNaN(lng) && !isNaN(lat)) {
            const pos = proj([lng, lat]);
            return pos && isFinite(pos[1]) ? pos[1] : 0;
        }
        return 0;
    });
    
    d3.selectAll(".airport-label").attr("x", function() {
        const lng = parseFloat(d3.select(this).attr("data-lng"));
        const lat = parseFloat(d3.select(this).attr("data-lat"));
        if (!isNaN(lng) && !isNaN(lat)) {
            const pos = proj([lng, lat]);
            return pos && isFinite(pos[0]) ? pos[0] : 0;
        }
        return 0;
    }).attr("y", function() {
        const lng = parseFloat(d3.select(this).attr("data-lng"));
        const lat = parseFloat(d3.select(this).attr("data-lat"));
        if (!isNaN(lng) && !isNaN(lat)) {
            const pos = proj([lng, lat]);
            return pos && isFinite(pos[1]) ? pos[1] + 15 : 0;
        }
        return 0;
    });
    
    // 每次更新投影後重新添加金邊效果
    addTransferGoldEffect();
}

function deepTranslateGeometry(geometry, deltaLng, deltaLat) {
    if (!geometry) return null;
    
    function translateCoords(coords) {
        if (!Array.isArray(coords)) return coords;
        if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            return [coords[0] + deltaLng, coords[1] + deltaLat];
        }
        return coords.map(c => translateCoords(c));
    }
    
    const clone = JSON.parse(JSON.stringify(geometry));
    
    if (clone.type === "Polygon") {
        clone.coordinates = translateCoords(clone.coordinates);
    } else if (clone.type === "MultiPolygon") {
        clone.coordinates = translateCoords(clone.coordinates);
    } else if (clone.type === "GeometryCollection") {
        clone.geometries = clone.geometries.map(g => deepTranslateGeometry(g, deltaLng, deltaLat));
    }
    
    return clone;
}

d3.json("https://cdn.jsdelivr.net/npm/taiwan-atlas/towns-10t.json").then(topo => {
    const counties = topojson.feature(topo, topo.objects.counties).features;
    window.originalCountiesData = counties;
    allCountiesNames = counties.filter(f => formatN(f) !== "連江縣").map(f => formatN(f));
    cruiseList = counties.filter(f => formatN(f) !== "連江縣").map(f => ({ t: 'm', n: formatN(f) }));
    cruiseList.push(
        { t: 'b', id: 'btn-Kinmen', n: '金門縣' },
        { t: 'b', id: 'btn-Lienchiang', n: '連江縣' },
        { t: 'b', id: 'btn-Penghu', n: '澎湖縣' }
    );
    
    window.dispatchEvent(new CustomEvent('taiwanMapDataReady', {
        detail: { cruiseList: cruiseList, allCountiesNames: allCountiesNames }
    }));
    
    const g = svg.append("g");
    
    const zoom = d3.zoom().scaleExtent([0.5, 5]).on("zoom", (event) => {
        g.attr("transform", event.transform);
        currentTransform = event.transform;
    });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.call(zoom.transform, d3.zoomIdentity);
    currentZoom = zoom;
    
    document.getElementById("zoom-in").addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.1);
    });
    document.getElementById("zoom-out").addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.9);
    });
    
    let matsuFeature = null;
    counties.forEach(f => {
        if (formatN(f) === "連江縣") {
            matsuFeature = f;
        }
    });
    
    let fantasyMatsuGeometry = null;
    if (matsuFeature) {
        fantasyMatsuGeometry = deepTranslateGeometry(matsuFeature.geometry, deltaLng, deltaLat);
    }
    
    g.selectAll("path")
        .data(counties.filter(f => formatN(f) !== "連江縣"))
        .enter()
        .append("path")
        .attr("class", "county")
        .attr("id", d => `path-${formatN(d)}`)
        .attr("d", d => {
            if (formatN(d) === "金門縣" && d.geometry.type === "MultiPolygon") {
                const filteredCoords = d.geometry.coordinates.filter(poly => poly[0][0][1] < 24.6);
                return path({ type: "Feature", geometry: { type: "MultiPolygon", coordinates: filteredCoords } });
            }
            return path(d);
        })
        .on("click", (e, d) => {
            userInteractionStop();
            selectCounty(formatN(d), d3.select(`#path-${formatN(d)}`));
            ensurePhotoPanelOpen();
        });
    
    if (fantasyMatsuGeometry) {
        const fantasyFeature = {
            type: "Feature",
            geometry: fantasyMatsuGeometry,
            properties: { name: "連江縣" }
        };
        window.fantasyMatsuFeature = fantasyFeature;
        
        const manualCenter = computeCenter(fantasyMatsuGeometry);
        const fantasyCenter = proj(manualCenter);
        
        g.append("path")
            .attr("class", "county fantasy-matsu")
            .attr("id", "fantasy-path-連江縣")
            .attr("d", path(fantasyFeature))
            .attr("fill", "var(--accent)")
            .attr("stroke", "#000")
            .attr("stroke-width", "1px")
            .attr("cursor", "pointer")
            .on("click", () => {
                userInteractionStop();
                selectCounty("連江縣", d3.select("#fantasy-path-連江縣"));
                ensurePhotoPanelOpen();
                showToast("📍 連江縣");
                if (window.fantasyExtraLabelElements) {
                    window.fantasyExtraLabelElements.forEach(el => {
                        el.classed("label-visible", true);
                    });
                }
            });
        
        if (fantasyCenter && isFinite(fantasyCenter[0]) && isFinite(fantasyCenter[1])) {
            g.append("text")
                .attr("id", "fantasy-matsu-label")
                .attr("class", "county-label label-連江縣 fantasy-matsu-label")
                .attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]})`)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text("馬祖（非真實位置）");
        }
    }
    
    // 縣市標籤（排除真實馬祖）
    g.selectAll(".county-label")
        .data(counties.filter(f => formatN(f) !== "連江縣"))
        .enter()
        .append("text")
        .attr("class", d => `county-label label-${formatN(d)}`)
        .attr("transform", d => {
            const center = path.centroid(d);
            const name = formatN(d);
            let [x, y] = center;
            if (labelOffsets[name]) return `translate(${x + labelOffsets[name].x}, ${y + labelOffsets[name].y})`;
            return `translate(${x}, ${y})`;
        })
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(d => formatN(d));

    // 強制顯示並定位臺東縣標籤（不受偏移影響）
    const taitungMainLabel = d3.select(".label-臺東縣");
    if (!taitungMainLabel.empty()) {
        const pos = proj([121.15, 22.76]);
        if (pos) {
            taitungMainLabel
                .attr("transform", `translate(${pos[0]}, ${pos[1] - 10})`)
                .attr("text-anchor", "middle")
                .classed("label-visible", true);
        }
    } else {
        const pos = proj([121.15, 22.76]);
        if (pos) {
            g.append("text")
                .attr("class", "county-label label-臺東縣")
                .attr("transform", `translate(${pos[0]}, ${pos[1] - 10})`)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text("臺東縣");
        }
    }
    
    // 原始附屬島嶼標籤（排除馬祖的附屬島嶼，同時排除臺東縣避免重複）
    const originalExtraLabels = extraLabels.filter(d => !matsuSubIslands.includes(d.n) && d.n !== "臺東縣");
    
    g.selectAll(".extra-label")
        .data(originalExtraLabels)
        .enter()
        .append("text")
        .attr("class", d => `county-label label-${d.n} extra-label`)
        .attr("x", d => getProjOffset([d.x, d.y])[0] + (d.dx || 0))
        .attr("y", d => getProjOffset([d.x, d.y])[1] + (d.dy || 0))
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(d => d.n);
    
    // 幻想馬祖附屬島嶼標籤
    window.fantasyExtraLabelsData = fantasySubIslandsData;
    window.fantasyExtraLabelElements = [];
    
    fantasySubIslandsData.forEach(d => {
        const pos = proj([d.x, d.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const label = g.append("text")
                .attr("class", `county-label extra-label fantasy-extra-label label-${d.n}`)
                .attr("x", pos[0] + (d.dx || 0))
                .attr("y", pos[1] + (d.dy || 0))
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(d.n);
            
            window.fantasyExtraLabelElements.push(label);
        }
    });
    
    // 機場
    const createAirports = (data, cls) => {
        const grp = g.append("g").attr("class", cls);
        data.forEach(d => {
            const pos = proj([d.x, d.y]);
            if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
                grp.append("text").attr("class", "airport-icon").attr("x", pos[0]).attr("y", pos[1]).attr("data-lng", d.x).attr("data-lat", d.y).text("✈️");
                grp.append("text").attr("class", "airport-label").attr("x", pos[0]).attr("y", pos[1] + 15).attr("data-lng", d.x).attr("data-lat", d.y).text(d.n);
            }
        });
    };
    createAirports(hkAirports, "ap-hk");
    createAirports(domAirports, "ap-dom");
    
    // 鐵路
    const lineGen = d3.line().x(d => proj(d)[0]).y(d => proj(d)[1]);
    const railwayG = g.append("g").attr("id", "railways").style("pointer-events", "none");
    
    if (transportData && transportData.tra) {
        railwayG.append("path").datum(transportData.tra)
            .attr("class", "tra-line").attr("d", lineGen)
            .attr("fill", "none").attr("stroke", "#0033aa").attr("stroke-width", 2.2)
            .style("opacity", 0.9).style("display", "none");
    }
    if (transportData && transportData.branches && Array.isArray(transportData.branches)) {
        transportData.branches.forEach(branch => {
            railwayG.append("path").datum(branch)
                .attr("class", "tra-line").attr("d", lineGen)
                .attr("fill", "none").attr("stroke", "#0033aa").attr("stroke-width", 2.0)
                .style("opacity", 1).style("display", "none");
        });
    }
    if (transportData && transportData.hsr) {
        railwayG.append("path").datum(transportData.hsr)
            .attr("class", "hsr-line").attr("d", lineGen)
            .attr("fill", "none").attr("stroke", "#ffaa33").attr("stroke-width", 2.5)
            .style("opacity", 0.9).style("display", "none");
    }
    
    // 繪製捷運路線
    // drawMrtLines(railwayG, lineGen);
    // 儲存顯示狀態到全域變數，供 toggleMrt 使用
    window.showMrt = false;
    window.toggleMrt = function() {
        window.showMrt = !window.showMrt;
        d3.selectAll(".mrt-line").style("display", window.showMrt ? "block" : "none");
    };
    
    // 臺鐵站點
    const traStationGroup = g.append("g").attr("class", "tra-stations").style("display", "none");
    traStations.forEach(s => {
        const pos = proj([s.x, s.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const stationGroup = traStationGroup.append("g").attr("class", "station-group");
            stationGroup.append("circle")
                .attr("cx", pos[0]).attr("cy", pos[1])
                .attr("r", 3).attr("fill", "#ffffff")
                .attr("stroke", "#000").attr("stroke-width", "0.5px")
                .attr("data-lng", s.x).attr("data-lat", s.y);
            
            let dx = 0, dy = 3;
            if (traOffsets[s.n]) { dx = traOffsets[s.n].dx; dy = traOffsets[s.n].dy; }
            let anchor = dx < 0 ? "end" : (dx > 0 ? "start" : "middle");
            stationGroup.append("text")
                .attr("x", pos[0] + dx).attr("y", pos[1] + dy)
                .attr("text-anchor", anchor).attr("class", "tra-station").text(s.n);
        }
    });
    
    // 高鐵站點
    const hsrStationGroup = g.append("g").attr("class", "hsr-stations").style("display", "none");
    hsrStations.forEach(s => {
        const pos = proj([s.x, s.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const stationGroup = hsrStationGroup.append("g").attr("class", "station-group");
            stationGroup.append("circle")
                .attr("cx", pos[0]).attr("cy", pos[1])
                .attr("r", 4).attr("class", "hsr-dot")
                .attr("stroke", "#000").attr("stroke-width", "0.5px")
                .attr("data-lng", s.x).attr("data-lat", s.y);
            
            let dx = 0, dy = 3;
            if (hsrOffsets[s.n]) { dx = hsrOffsets[s.n].dx; dy = hsrOffsets[s.n].dy; }
            let anchor = dx < 0 ? "end" : (dx > 0 ? "start" : "middle");
            stationGroup.append("text")
                .attr("x", pos[0] + dx).attr("y", pos[1] + dy)
                .attr("text-anchor", anchor).attr("class", "hsr-station").text(s.n);
        }
    });
    
    // 縣市中心座標
    const countyCenters = {
        "基隆市": [121.75, 25.13], "臺北市": [121.52, 25.03], "新北市": [121.46, 25.01],
        "桃園市": [121.30, 24.99], "新竹市": [120.97, 24.80], "新竹縣": [121.00, 24.80],
        "苗栗縣": [120.82, 24.57], "臺中市": [120.68, 24.15], "彰化縣": [120.54, 24.08],
        "南投縣": [120.68, 23.92], "雲林縣": [120.54, 23.71], "嘉義市": [120.45, 23.48],
        "嘉義縣": [120.45, 23.48], "臺南市": [120.21, 23.00], "高雄市": [120.30, 22.62],
        "屏東縣": [120.49, 22.68], "宜蘭縣": [121.75, 24.75], "花蓮縣": [121.60, 23.98],
        "臺東縣": [121.15, 22.76], "澎湖縣": [119.57, 23.57], "金門縣": [118.37, 24.44],
        "連江縣": [fantasyMatsuLng, fantasyMatsuLat]
    };
    window.countyCenters = countyCenters;
    
    // 站點繪製完成後添加金邊效果
    setTimeout(() => {
        addTransferGoldEffect();
    }, 100);
    
    setTimeout(() => {
        centerMapAtTianzhong();
    }, 100);
});

function formatN(d) {
    const n = d.properties.countyname || d.properties.COUNTYNAME || "";
    const m = {
        "Taipei City": "臺北市", "New Taipei City": "新北市", "Taoyuan City": "桃園市",
        "Taichung City": "臺中市", "Tainan City": "臺南市", "Kaohsiung City": "高雄市",
        "Keelung City": "基隆市", "Hsinchu City": "新竹市", "Chiayi City": "嘉義市",
        "Hsinchu County": "新竹縣", "Miaoli County": "苗栗縣", "Changhua County": "彰化縣",
        "Nantou County": "南投縣", "Yunlin County": "雲林縣", "Chiayi County": "嘉義縣",
        "Pingtung County": "屏東縣", "Yilan County": "宜蘭縣", "Hualien County": "花蓮縣",
        "Taitung County": "臺東縣", "Penghu County": "澎湖縣"
    };
    return (m[n] || n).replace(/台/g, "臺");
}

function centerMapAtTianzhong() {
    const container = document.getElementById("map-container");
    if (!container) return;
    
    let width = container.clientWidth;
    let height = container.clientHeight;
    if (width === 0 || height === 0) {
        width = window.innerWidth;
        height = window.innerHeight;
    }
    if (width === 0 || height === 0) return;
    
    const taiwanBounds = {
        west: 118.0,
        east: 122.0,
        north: 25.3,
        south: 21.9
    };
    
    const westPos = proj([taiwanBounds.west, (taiwanBounds.north + taiwanBounds.south) / 2]);
    const eastPos = proj([taiwanBounds.east, (taiwanBounds.north + taiwanBounds.south) / 2]);
    const northPos = proj([(taiwanBounds.west + taiwanBounds.east) / 2, taiwanBounds.north]);
    const southPos = proj([(taiwanBounds.west + taiwanBounds.east) / 2, taiwanBounds.south]);
    
    if (westPos && eastPos && northPos && southPos) {
        const mapWidth = eastPos[0] - westPos[0];
        const mapHeight = northPos[1] - southPos[1];
        
        const scaleX = (width * 0.85) / mapWidth;
        const scaleY = (height * 0.85) / mapHeight;
        const scale = Math.min(scaleX, scaleY, 1.5);
        
        const currentScale = proj.scale();
        proj.scale(currentScale * scale);
        
        const centerLng = (taiwanBounds.west + taiwanBounds.east) / 2;
        const centerLat = (taiwanBounds.north + taiwanBounds.south) / 2;
        const centerPos = proj([centerLng, centerLat]);
        
        if (centerPos) {
            const dx = width / 2 - centerPos[0];
            const dy = height / 2 - centerPos[1];
            const currentTranslate = proj.translate() || [0, 0];
            proj.translate([currentTranslate[0] + dx, currentTranslate[1] + dy]);
        }
    }
    
    updateProjectionAndPaths();
}

window.addEventListener('load', function() {
    setTimeout(centerMapAtTianzhong, 200);
});

window.addEventListener('resize', function() {
    setTimeout(function() {
        centerMapAtTianzhong();
        if (window.fantasyMatsuFeature) {
            d3.select("#fantasy-path-連江縣").attr("d", path(window.fantasyMatsuFeature));
            const manualCenter = computeCenter(window.fantasyMatsuFeature.geometry);
            const fantasyCenter = proj(manualCenter);
            d3.select("#fantasy-matsu-label")
                .attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]})`);
        }
    }, 100);
});

// ============================================
// 載入捷運路線
// ============================================

d3.json("data/MRT_1150409_wgs84.geojson").then(function(geojson) {
    console.log("✅ 捷運載入成功！共", geojson.features.length, "條路線");
    
    var g = d3.select("#railways");
    
    geojson.features.forEach(function(f) {
        if (f.geometry && f.geometry.type === "LineString") {
            var name = f.properties.MRTCODE || f.properties.MRTSYS || "";
            var color = "#888";
            if (name.indexOf("板南") !== -1) color = "#0055a4";
            else if (name.indexOf("淡水信義") !== -1) color = "#d11e2e";
            else if (name.indexOf("松山新店") !== -1) color = "#16a34a";
            else if (name.indexOf("中和新蘆") !== -1) color = "#ff7e2e";
            else if (name.indexOf("文湖") !== -1) color = "#9e652e";
            else if (name.indexOf("環狀") !== -1) color = "#ffc757";
            else if (name.indexOf("機場捷運") !== -1) color = "#8b5cf6";
            
            g.append("path")
                .datum(f.geometry.coordinates)
                .attr("class", "mrt-line")
                .attr("d", d3.line().x(function(d) { 
                    var p = proj([d[0], d[1]]);
                    return p ? p[0] : 0;
                }).y(function(d) {
                    var p = proj([d[0], d[1]]);
                    return p ? p[1] : 0;
                }))
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .style("display", "none");
        }
    });
}).catch(function(e) { console.log("錯誤：", e); });

var _old = window.toggleMrt;
window.toggleMrt = function() {
    window.showMrt = !window.showMrt;
    d3.selectAll(".mrt-line").style("display", window.showMrt ? "block" : "none");
    if (_old) _old();
};
