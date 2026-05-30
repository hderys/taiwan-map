// ============================================
// 載入捷運路線 (從外部 GeoJSON 檔案)
// ============================================

let mrtData = null;

function loadMRT() {
    fetch('data/MRT_1150409_wgs84.geojson')
        .then(response => response.json())
        .then(data => {
            mrtData = data;
            drawMRT();
            console.log("✅ 捷運資料載入成功，共", mrtData.features.length, "條路線");
        })
        .catch(error => console.error("❌ 載入捷運失敗:", error));
}

function drawMRT() {
    if (!mrtData) {
        console.log("捷運資料尚未載入");
        return;
    }
    
    const g = d3.select("#railways");
    if (g.empty()) {
        setTimeout(drawMRT, 500);
        return;
    }
    
    g.selectAll(".mrt-line").remove();
    g.selectAll(".mrt-line-bg").remove();
    
    const colors = {
        "板南": "#0055a4", "淡水信義": "#d11e2e", "松山新店": "#16a34a",
        "中和新蘆": "#ff7e2e", "文湖": "#9e652e", "環狀": "#ffc757",
        "機場捷運": "#8b5cf6", "紅線": "#e11d48", "橘線": "#f59e0b", 
        "綠線": "#00a876", "三鶯": "#00a876"
    };
    
    const isMobile = window.innerWidth <= 768 || window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    const mrtStrokeWidth = isMobile ? 0.4 : 0.7;
    const bgStrokeWidth = mrtStrokeWidth + 8;
    
    let mrtTooltip = document.getElementById("mrt-tooltip");
    if (!mrtTooltip) {
        mrtTooltip = document.createElement("div");
        mrtTooltip.id = "mrt-tooltip";
        mrtTooltip.style.cssText = `position: fixed; background: rgba(0,0,0,0.85); color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; z-index: 100001; pointer-events: none; border-left: 4px solid; font-family: "Microsoft JhengHei", sans-serif; white-space: nowrap; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.3);`;
        document.body.appendChild(mrtTooltip);
    }
    
    mrtData.features.forEach(f => {
        if (f.geometry.type === "LineString") {
            let name = f.properties.MRTCODE || f.properties.MRTSYS || "";
            let color = "#aaa";
            let displayName = name;
            
            for (let k in colors) {
                if (name.indexOf(k) !== -1) { 
                    color = colors[k]; 
                    break; 
                }
            }
            
            if (name.indexOf("板南") !== -1) displayName = "🚇 台北捷運 板南線";
            else if (name.indexOf("淡水信義") !== -1) displayName = "🚇 台北捷運 淡水信義線";
            else if (name.indexOf("松山新店") !== -1) displayName = "🚇 台北捷運 松山新店線";
            else if (name.indexOf("中和新蘆") !== -1) displayName = "🚇 台北捷運 中和新蘆線";
            else if (name.indexOf("文湖") !== -1) displayName = "🚇 台北捷運 文湖線";
            else if (name.indexOf("環狀") !== -1) displayName = "🚇 新北捷運 環狀線";
            else if (name.indexOf("機場捷運") !== -1) displayName = "🚇 桃園捷運 機場線";
            else if (name.indexOf("三鶯") !== -1) displayName = "🚇 新北捷運 三鶯線";
            else if (name.indexOf("紅線") !== -1) displayName = "🚇 高雄捷運 紅線";
            else if (name.indexOf("橘線") !== -1) displayName = "🚇 高雄捷運 橘線";
            else if (name.indexOf("綠線") !== -1) displayName = "🚇 台中捷運 綠線";
            else displayName = "🚇 " + name + "捷運";
            
            const lineData = f.geometry.coordinates;
            
            g.append("path")
                .datum(lineData)
                .attr("class", "mrt-line-bg")
                .attr("d", d3.line().x(d => proj(d)[0]).y(d => proj(d)[1]))
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", bgStrokeWidth)
                .style("cursor", "pointer")
                .style("display", "block")
                .style("pointer-events", "stroke")
                .on("mouseenter", function(event) {
                    if (!window.showMrt) return;
                    mrtTooltip.style.display = "block";
                    mrtTooltip.innerHTML = displayName;
                    mrtTooltip.style.borderLeftColor = color;
                    mrtTooltip.style.left = (event.pageX + 15) + "px";
                    mrtTooltip.style.top = (event.pageY - 30) + "px";
                })
                .on("mousemove", function(event) {
                    if (!window.showMrt) return;
                    mrtTooltip.style.left = (event.pageX + 15) + "px";
                    mrtTooltip.style.top = (event.pageY - 30) + "px";
                })
                .on("mouseleave", function() {
                    mrtTooltip.style.display = "none";
                });
            
            g.append("path")
                .datum(lineData)
                .attr("class", "mrt-line")
                .attr("d", d3.line().x(d => proj(d)[0]).y(d => proj(d)[1]))
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", mrtStrokeWidth)
                .style("display", "none");
        }
    });
    
    console.log("✅ 已繪製", d3.selectAll(".mrt-line").size(), "條捷運路線");
    d3.select("#railways").raise();
    enforceLayerOrder();
}

setTimeout(loadMRT, 1500);

// ============================================
// 響應式線條粗細
// ============================================
function isMobileView() {
    return window.innerWidth <= 768 || window.matchMedia("(max-aspect-ratio: 1/1)").matches;
}

function getTraWidth() { return isMobileView() ? 0.8 : 1.2; }
function getHsrWidth() { return isMobileView() ? 1.0 : 1.5; }

// ============================================
// 強制圖層順序
// ============================================
function enforceLayerOrder() {
    const railways = d3.select("#railways");
    const traStations = d3.select(".tra-stations");
    const hsrStations = d3.select(".hsr-stations");
    
    if (!railways.empty()) {
        railways.node().parentNode.appendChild(railways.node());
    }
    if (!traStations.empty()) {
        traStations.node().parentNode.appendChild(traStations.node());
    }
    if (!hsrStations.empty()) {
        hsrStations.node().parentNode.appendChild(hsrStations.node());
    }
    
    d3.selectAll(".tra-stations .station-group circle").raise();
    d3.selectAll(".hsr-stations .station-group circle").raise();
    d3.selectAll(".tra-stations .station-group text").raise();
    d3.selectAll(".hsr-stations .station-group text").raise();
    
    console.log("✅ 圖層順序已修正");
}

// ============================================
// 捷運開關（修正：關閉時無懸浮）
// ============================================
window.showMrt = false;
window.toggleMrt = function() {
    window.showMrt = !window.showMrt;
    const display = window.showMrt ? "block" : "none";
    d3.selectAll(".mrt-line").style("display", display);
    // 關閉捷運時，背景路徑的懸浮提示也要關閉
    if (!window.showMrt) {
        const tooltip = document.getElementById("mrt-tooltip");
        if (tooltip) tooltip.style.display = "none";
    }
    console.log("捷運顯示：", window.showMrt ? "開啟" : "關閉");
};

// ============================================
// 地圖核心設定
// ============================================
let proj = d3.geoMercator()
    .center([120.0, 23.6])
    .scale(9200)
    .translate([0, 0]);
let path = d3.geoPath().projection(proj);
const svg = d3.select("#taiwan-map");

let allCountiesNames = [];
let cruiseList = [];
let currentZoom = null;
let currentTransform = null;

// 幻想馬祖設定
const fantasyMatsuLng = 119.5;
const fantasyMatsuLat = 24.42;
const originalMatsuCenterLng = 119.95;
const originalMatsuCenterLat = 26.15;
const deltaLng = fantasyMatsuLng - originalMatsuCenterLng;
const deltaLat = fantasyMatsuLat - originalMatsuCenterLat;

const matsuSubIslands = ["南竿", "北竿", "東引", "西引", "東莒", "西莒"];
const fantasySubIslandsData = [
    {n: "南竿", x: 119.93 + deltaLng, y: 26.15 + deltaLat, dx: -12, dy: 2},
    {n: "北竿", x: 119.98 + deltaLng, y: 26.22 + deltaLat, dx: 13, dy: -2},
    {n: "東引", x: 120.49 + deltaLng, y: 26.36 + deltaLat, dx: 10, dy: -2},
    {n: "西引", x: 120.47 + deltaLng, y: 26.37 + deltaLat, dx: -5, dy: -10},
    {n: "東莒", x: 119.97 + deltaLng, y: 25.96 + deltaLat, dx: 12, dy: 5},
    {n: "西莒", x: 119.93 + deltaLng, y: 25.97 + deltaLat, dx: -12, dy: 5}
];

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

const taiwanBounds = { west: 118.0, east: 122.0, north: 25.3, south: 21.9 };

const traOffsets = {
    "臺北": { dx: 3, dy: 0 }, "板橋": { dx: 0, dy: 3 }, "桃園": { dx: 0, dy: 5 },
    "中壢": { dx: -3, dy: -5 }, "竹北": { dx: 0, dy: -8 }, "六家": { dx: 3, dy: -5 },
    "新竹": { dx: -3, dy: -5 }, "豐原": { dx: 3, dy: -4 }, "臺中": { dx: 3, dy: -4 }, "彰化": { dx: -3, dy: -5 },
    "員林": { dx: -3, dy: -5 }, "田中": { dx: 3, dy: -5 }, "二水": { dx: 3, dy: -5 }, "集集": { dx: 3, dy: -4 },
    "斗六": { dx: 3, dy: -5 }, "沙崙": { dx: 3, dy: -5 }, "新左營": { dx: -3, dy: -5 },
    "屏東": { dx: 0, dy: -12 }, "潮州": { dx: 3, dy: -5 }, "基隆": { dx: 0, dy: -12 },
    "臺南": { dx: -3, dy: -5 }, "礁溪": { dx: -3, dy: -5 }, "宜蘭": { dx: -3, dy: -5 },
    "羅東": { dx: -3, dy: -5 }
};

const hsrOffsets = {
    "南港": { dx: 3, dy: -5 }, "臺北": { dx: 0, dy: -13 }, "板橋": { dx: 0, dy: 5 },
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

let transferStationElements = [];

function showTransferTooltip(stationName, transferInfo, event) {
    let tooltip = document.getElementById("transfer-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "transfer-tooltip";
        tooltip.style.cssText = `position: fixed; background: rgba(0,0,0,0.95); color: #ffd700; padding: 10px 18px; border-radius: 10px; font-weight: bold; z-index: 100000; pointer-events: none; border: 2px solid #ffd700; box-shadow: 0 0 15px rgba(0,0,0,0.5); font-family: "Microsoft JhengHei", sans-serif;`;
        document.body.appendChild(tooltip);
    }
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

function addTransferGoldEffect() {
    if (!window.transferStations) return;
    
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
    
    const isMobile = window.innerWidth <= 768 || window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    const goldStrokeWidth = 0.8;
    const hsrGoldRadius = isMobile ? 2.0 : 2.5;
    const traGoldRadius = isMobile ? 2.0 : 2.5;
    
    let count = 0;
    
    window.transferStations.forEach(transfer => {
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
                             .attr("stroke-width", goldStrokeWidth)
                             .attr("r", hsrGoldRadius)
                             .classed("transfer-gold", true);
                    
                    const info = `🚄 高鐵${transfer.hsr}站 ↔ 🚂 臺鐵${transfer.tra}站`;
                    hsrCircle.on("mouseenter", function(event) { showTransferTooltip(transfer.hsr, info, event); })
                            .on("mousemove", function(event) { 
                                const tooltip = document.getElementById("transfer-tooltip"); 
                                if (tooltip && tooltip.style.display === "block") { 
                                    tooltip.style.left = (event.pageX + 20) + "px"; 
                                    tooltip.style.top = (event.pageY - 50) + "px"; 
                                } 
                            })
                            .on("mouseleave", function() { hideTransferTooltip(); })
                            .on("touchstart", function(event) { 
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
        
        const traStation = traStations.find(s => s.n === transfer.tra);
        if (traStation) {
            const traCircle = d3.select(`.tra-stations .station-group circle[data-lng="${traStation.x}"]`);
            if (!traCircle.empty()) {
                const originalStroke = traCircle.attr("stroke");
                const originalStrokeWidth = traCircle.attr("stroke-width");
                const originalRadius = traCircle.attr("r");
                
                traCircle.attr("stroke", "#ffd700")
                         .attr("stroke-width", goldStrokeWidth)
                         .attr("r", traGoldRadius)
                         .classed("transfer-gold", true);
                
                const info = `🚄 高鐵${transfer.hsr}站 ↔ 🚂 臺鐵${transfer.tra}站`;
                traCircle.on("mouseenter", function(event) { showTransferTooltip(transfer.tra, info, event); })
                        .on("mousemove", function(event) { 
                            const tooltip = document.getElementById("transfer-tooltip"); 
                            if (tooltip && tooltip.style.display === "block") { 
                                tooltip.style.left = (event.pageX + 20) + "px"; 
                                tooltip.style.top = (event.pageY - 50) + "px"; 
                            } 
                        })
                        .on("mouseleave", function() { hideTransferTooltip(); })
                        .on("touchstart", function(event) { 
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

function updateProjectionAndPaths() {
    path = d3.geoPath().projection(proj);
    d3.selectAll("#taiwan-map .county:not(.fantasy-matsu)").attr("d", function(d) { return path(d); });
    if (window.fantasyMatsuFeature) {
        d3.selectAll("#taiwan-map .fantasy-matsu").attr("d", function() { return path(window.fantasyMatsuFeature); });
        const manualCenter = computeCenter(window.fantasyMatsuFeature.geometry);
        const fantasyCenter = proj(manualCenter);
        const fantasyLabel = d3.select("#fantasy-matsu-label");
        if (!fantasyLabel.empty() && fantasyCenter && fantasyCenter[0] && fantasyCenter[1]) {
            fantasyLabel.attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]+40})`);
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
        if (labelOffsets[countyName]) { x += labelOffsets[countyName].x; y += labelOffsets[countyName].y; }
        d3.select(this).attr("transform", `translate(${x}, ${y})`);
    });
    d3.selectAll("#taiwan-map .extra-label:not(.fantasy-extra-label)").each(function() {
        const d = d3.select(this).datum();
        if (d && !matsuSubIslands.includes(d.n)) {
            d3.select(this).attr("x", getProjOffset([d.x, d.y])[0] + (d.dx || 0)).attr("y", getProjOffset([d.x, d.y])[1] + (d.dy || 0));
        }
    });
    if (window.fantasyExtraLabelElements && window.fantasyExtraLabelsData) {
        window.fantasyExtraLabelElements.forEach((element, idx) => {
            const d = window.fantasyExtraLabelsData[idx];
            if (d && element) {
                const pos = proj([d.x, d.y]);
                if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
                    element.attr("x", pos[0] + (d.dx || 0)).attr("y", pos[1] + (d.dy || 0));
                }
            }
        });
    }
    
    d3.selectAll("#railways .tra-line").attr("d", function(d) { return d3.line().x(dd => proj(dd)[0]).y(dd => proj(dd)[1])(d); });
    d3.selectAll("#railways .hsr-line").attr("d", function(d) { return d3.line().x(dd => proj(dd)[0]).y(dd => proj(dd)[1])(d); });
    
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
                        text.attr("x", pos[0] + offset.dx).attr("y", pos[1] + offset.dy).attr("text-anchor", anchor);
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
                        text.attr("x", pos[0] + offset.dx).attr("y", pos[1] + offset.dy).attr("text-anchor", anchor);
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
    
    addTransferGoldEffect();
    enforceLayerOrder();
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
    cruiseList.push({ t: 'b', id: 'btn-Kinmen', n: '金門縣' }, { t: 'b', id: 'btn-Lienchiang', n: '連江縣' }, { t: 'b', id: 'btn-Penghu', n: '澎湖縣' });
    window.dispatchEvent(new CustomEvent('taiwanMapDataReady', { detail: { cruiseList: cruiseList, allCountiesNames: allCountiesNames } }));
    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.5, 5]).on("zoom", (event) => { g.attr("transform", event.transform); currentTransform = event.transform; });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.call(zoom.transform, d3.zoomIdentity);
    currentZoom = zoom;
    document.getElementById("zoom-in").addEventListener("click", () => { svg.transition().duration(300).call(zoom.scaleBy, 1.1); });
    document.getElementById("zoom-out").addEventListener("click", () => { svg.transition().duration(300).call(zoom.scaleBy, 0.9); });
    let matsuFeature = null;
    counties.forEach(f => { if (formatN(f) === "連江縣") { matsuFeature = f; } });
    let fantasyMatsuGeometry = null;
    if (matsuFeature) { fantasyMatsuGeometry = deepTranslateGeometry(matsuFeature.geometry, deltaLng, deltaLat); }
    g.selectAll("path").data(counties.filter(f => formatN(f) !== "連江縣")).enter().append("path").attr("class", "county").attr("id", d => `path-${formatN(d)}`).attr("d", d => { if (formatN(d) === "金門縣" && d.geometry.type === "MultiPolygon") { const filteredCoords = d.geometry.coordinates.filter(poly => poly[0][0][1] < 24.6); return path({ type: "Feature", geometry: { type: "MultiPolygon", coordinates: filteredCoords } }); } return path(d); }).on("click", (e, d) => { userInteractionStop(); selectCounty(formatN(d), d3.select(`#path-${formatN(d)}`)); ensurePhotoPanelOpen(); });
    if (fantasyMatsuGeometry) {
        const fantasyFeature = { type: "Feature", geometry: fantasyMatsuGeometry, properties: { name: "連江縣" } };
        window.fantasyMatsuFeature = fantasyFeature;
        const manualCenter = computeCenter(fantasyMatsuGeometry);
        const fantasyCenter = proj(manualCenter);
        g.append("path").attr("class", "county fantasy-matsu").attr("id", "fantasy-path-連江縣").attr("d", path(fantasyFeature)).attr("fill", "var(--accent)").attr("stroke", "#000").attr("stroke-width", "1px").attr("cursor", "pointer").on("click", () => { userInteractionStop(); selectCounty("連江縣", d3.select("#fantasy-path-連江縣")); ensurePhotoPanelOpen(); showToast("📍 連江縣"); if (window.fantasyExtraLabelElements) { window.fantasyExtraLabelElements.forEach(el => { el.classed("label-visible", true); }); } });
        if (fantasyCenter && isFinite(fantasyCenter[0]) && isFinite(fantasyCenter[1])) {
            g.append("text").attr("id", "fantasy-matsu-label").attr("class", "county-label label-連江縣 fantasy-matsu-label").attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]})`).attr("dy", ".35em").attr("text-anchor", "middle").text("馬祖（非真實位置）");
        }
    }
    g.selectAll(".county-label").data(counties.filter(f => formatN(f) !== "連江縣")).enter().append("text").attr("class", d => `county-label label-${formatN(d)}`).attr("transform", d => { const center = path.centroid(d); const name = formatN(d); let [x, y] = center; if (labelOffsets[name]) return `translate(${x + labelOffsets[name].x}, ${y + labelOffsets[name].y})`; return `translate(${x}, ${y})`; }).attr("dy", ".35em").attr("text-anchor", "middle").text(d => formatN(d));
    const taitungMainLabel = d3.select(".label-臺東縣");
    if (!taitungMainLabel.empty()) {
        const pos = proj([121.15, 22.76]);
        if (pos) { taitungMainLabel.attr("transform", `translate(${pos[0]}, ${pos[1] - 10})`).attr("text-anchor", "middle").classed("label-visible", true); }
    } else {
        const pos = proj([121.15, 22.76]);
        if (pos) { g.append("text").attr("class", "county-label label-臺東縣").attr("transform", `translate(${pos[0]}, ${pos[1] - 10})`).attr("dy", ".35em").attr("text-anchor", "middle").text("臺東縣"); }
    }
    const originalExtraLabels = extraLabels.filter(d => !matsuSubIslands.includes(d.n) && d.n !== "臺東縣");
    g.selectAll(".extra-label").data(originalExtraLabels).enter().append("text").attr("class", d => `county-label label-${d.n} extra-label`).attr("x", d => getProjOffset([d.x, d.y])[0] + (d.dx || 0)).attr("y", d => getProjOffset([d.x, d.y])[1] + (d.dy || 0)).attr("dy", ".35em").attr("text-anchor", "middle").text(d => d.n);
    window.fantasyExtraLabelsData = fantasySubIslandsData;
    window.fantasyExtraLabelElements = [];
    fantasySubIslandsData.forEach(d => {
        const pos = proj([d.x, d.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const label = g.append("text").attr("class", `county-label extra-label fantasy-extra-label label-${d.n}`).attr("x", pos[0] + (d.dx || 0)).attr("y", pos[1] + (d.dy || 0)).attr("dy", ".35em").attr("text-anchor", "middle").text(d.n);
            window.fantasyExtraLabelElements.push(label);
        }
    });
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

    g.selectAll(".county").lower();

    const lineGen = d3.line().x(d => proj(d)[0]).y(d => proj(d)[1]);
    const railwayG = g.append("g").attr("id", "railways").style("pointer-events", "none");

    // 台鐵主線（預設隱藏）
    if (transportData && transportData.tra) { 
        railwayG.append("path")
            .datum(transportData.tra)
            .attr("class", "tra-line")
            .attr("d", lineGen)
            .attr("fill", "none")
            .style("stroke", "#0033aa")
            .style("stroke-width", "1.2px")
            .style("opacity", 0.9)
            .style("display", "none");
    }

    // 台鐵支線（預設隱藏）
    if (transportData && transportData.branches && Array.isArray(transportData.branches)) { 
        transportData.branches.forEach(branch => { 
            railwayG.append("path")
                .datum(branch)
                .attr("class", "tra-line")
                .attr("d", lineGen)
                .attr("fill", "none")
                .style("stroke", "#0033aa")
                .style("stroke-width", "1.0px")
                .style("opacity", 0.8)
                .style("display", "none");
        }); 
    }

    // 高鐵（預設隱藏）
    if (transportData && transportData.hsr) { 
        railwayG.append("path")
            .datum(transportData.hsr)
            .attr("class", "hsr-line")
            .attr("d", lineGen)
            .attr("fill", "none")
            .style("stroke", "#ffaa33")
            .style("stroke-width", "1.5px")
            .style("opacity", 0.9)
            .style("display", "none");
    }
    
    const traStationGroup = g.append("g").attr("class", "tra-stations").style("display", "block");
    const isMobileForStations = isMobileView();
    const traStationRadius = isMobileForStations ? 2 : 3;
    const hsrStationRadius = isMobileForStations ? 2.5 : 4;
    
    traStations.forEach(s => {
        const pos = proj([s.x, s.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const stationGroup = traStationGroup.append("g").attr("class", "station-group");
            stationGroup.append("circle").attr("cx", pos[0]).attr("cy", pos[1]).attr("r", traStationRadius).attr("fill", "#ffffff").attr("stroke", "#000").attr("stroke-width", "0.8px").attr("data-lng", s.x).attr("data-lat", s.y) .style("display", "none");
            let dx = 0, dy = 3;
            if (traOffsets[s.n]) { dx = traOffsets[s.n].dx; dy = traOffsets[s.n].dy; }
            let anchor = dx < 0 ? "end" : (dx > 0 ? "start" : "middle");
            stationGroup.append("text").attr("x", pos[0] + dx).attr("y", pos[1] + dy).attr("text-anchor", anchor).attr("class", "tra-station") .style("display", "none") .text(s.n);
        }
    });
    
    const hsrStationGroup = g.append("g").attr("class", "hsr-stations").style("display", "block");
    hsrStations.forEach(s => {
        const pos = proj([s.x, s.y]);
        if (pos && isFinite(pos[0]) && isFinite(pos[1])) {
            const stationGroup = hsrStationGroup.append("g").attr("class", "station-group");
            stationGroup.append("circle").attr("cx", pos[0]).attr("cy", pos[1]).attr("r", hsrStationRadius).attr("class", "hsr-dot").attr("fill", "#ffffff").attr("stroke", "#000").attr("stroke-width", "0.8px").attr("data-lng", s.x).attr("data-lat", s.y).style("display", "none");
            let dx = 0, dy = 3;
            if (hsrOffsets[s.n]) { dx = hsrOffsets[s.n].dx; dy = hsrOffsets[s.n].dy; }
            let anchor = dx < 0 ? "end" : (dx > 0 ? "start" : "middle");
            stationGroup.append("text").attr("x", pos[0] + dx).attr("y", pos[1] + dy).attr("text-anchor", anchor).attr("class", "hsr-station") .style("display", "none").text(s.n);
        }
    });
    
    enforceLayerOrder();
    
    const countyCenters = { "基隆市": [121.75, 25.13], "臺北市": [121.52, 25.03], "新北市": [121.46, 25.01], "桃園市": [121.30, 24.99], "新竹市": [120.97, 24.80], "新竹縣": [121.00, 24.80], "苗栗縣": [120.82, 24.57], "臺中市": [120.68, 24.15], "彰化縣": [120.54, 24.08], "南投縣": [120.68, 23.92], "雲林縣": [120.54, 23.71], "嘉義市": [120.45, 23.48], "嘉義縣": [120.45, 23.48], "臺南市": [120.21, 23.00], "高雄市": [120.30, 22.62], "屏東縣": [120.49, 22.68], "宜蘭縣": [121.75, 24.75], "花蓮縣": [121.60, 23.98], "臺東縣": [121.15, 22.76], "澎湖縣": [119.57, 23.57], "金門縣": [118.37, 24.44], "連江縣": [fantasyMatsuLng, fantasyMatsuLat] };
    window.countyCenters = countyCenters;
    
    setTimeout(() => { addTransferGoldEffect(); }, 100);
    setTimeout(() => { centerMapAtTianzhong(); }, 100);
});

function formatN(d) {
    const n = d.properties.countyname || d.properties.COUNTYNAME || "";
    const m = { "Taipei City": "臺北市", "New Taipei City": "新北市", "Taoyuan City": "桃園市", "Taichung City": "臺中市", "Tainan City": "臺南市", "Kaohsiung City": "高雄市", "Keelung City": "基隆市", "Hsinchu City": "新竹市", "Chiayi City": "嘉義市", "Hsinchu County": "新竹縣", "Miaoli County": "苗栗縣", "Changhua County": "彰化縣", "Nantou County": "南投縣", "Yunlin County": "雲林縣", "Chiayi County": "嘉義縣", "Pingtung County": "屏東縣", "Yilan County": "宜蘭縣", "Hualien County": "花蓮縣", "Taitung County": "臺東縣", "Penghu County": "澎湖縣" };
    return (m[n] || n).replace(/台/g, "臺");
}

function ensureFantasyMatsu() {
    if (!window.fantasyMatsuFeature) return;
    const container = d3.select("#taiwan-map > g");
    if (container.empty()) return;
    
    let fantasyPath = container.select("#fantasy-path-連江縣");
    if (fantasyPath.empty()) {
        fantasyPath = container.append("path")
            .attr("class", "county fantasy-matsu")
            .attr("id", "fantasy-path-連江縣")
            .attr("d", path(window.fantasyMatsuFeature))
            .attr("fill", "var(--accent)")
            .attr("stroke", "#000")
            .attr("stroke-width", "1px")
            .attr("cursor", "pointer")
            .on("click", () => {
                if (typeof userInteractionStop === 'function') userInteractionStop();
                if (typeof selectCounty === 'function') selectCounty("連江縣", d3.select("#fantasy-path-連江縣"));
                if (typeof ensurePhotoPanelOpen === 'function') ensurePhotoPanelOpen();
                if (typeof showToast === 'function') showToast("📍 連江縣");
                if (window.fantasyExtraLabelElements) {
                    window.fantasyExtraLabelElements.forEach(el => el.classed("label-visible", true));
                }
            });
    } else {
        fantasyPath.attr("d", path(window.fantasyMatsuFeature));
    }
    
    let fantasyLabel = container.select("#fantasy-matsu-label");
    const manualCenter = computeCenter(window.fantasyMatsuFeature.geometry);
    const fantasyCenter = proj(manualCenter);
    if (fantasyLabel.empty() && fantasyCenter && isFinite(fantasyCenter[0])) {
        fantasyLabel = container.append("text")
            .attr("id", "fantasy-matsu-label")
            .attr("class", "county-label label-連江縣 fantasy-matsu-label")
            .attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1] +40})`)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text("馬祖（非真實位置）");
    } else if (fantasyCenter && isFinite(fantasyCenter[0])) {
        fantasyLabel.attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]+40})`);
    }
}

function centerMapAtTianzhong() {
    requestAnimationFrame(() => {
        const container = document.getElementById("map-container");
        if (!container) return;
        
        let width = container.clientWidth;
        let height = container.clientHeight;
        if (width < 200 || height < 200) {
            width = window.innerWidth;
            height = window.innerHeight;
        }
        if (width === 0 || height === 0) return;
        
        let baseScale = 8000;
        if (width <= 768) {
            baseScale = 5500;
        } else if (width <= 1024) {
            baseScale = 7000;
        }
        
        const centerLng = 120.0;
        const centerLat = 23.6;
        
        if (currentZoom && svg) {
            svg.call(currentZoom.transform, d3.zoomIdentity);
        }
        
        proj.scale(baseScale)
           .center([centerLng, centerLat])
           .translate([0, 0]);
        
        updateProjectionAndPaths();
        
        if (typeof mrtData !== 'undefined' && mrtData) {
            drawMRT();
            d3.selectAll(".mrt-line").style("display", window.showMrt ? "block" : "none");
        }
        
        ensureFantasyMatsu();
        
        const centerPos = proj([centerLng, centerLat]);
        if (centerPos && isFinite(centerPos[0])) {
            const dx = width / 2 - centerPos[0];
            const dy = height / 2 - centerPos[1];
            if (currentZoom && svg) {
                svg.call(currentZoom.transform, d3.zoomIdentity.translate(dx, dy));
            }
        }
        
        console.log("✅ 地圖已置中，縮放倍率:", baseScale, "容器尺寸:", width, "x", height);
    });
}

window.resetMapView = function() {
    if (typeof userInteractionStop === 'function') userInteractionStop();
    centerMapAtTianzhong();
    if (typeof showToast === 'function') {
        showToast("🧭 地圖已重置");
    } else {
        console.log("地圖已重置");
    }
};

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        centerMapAtTianzhong();
        if (window.fantasyMatsuFeature) {
            const manualCenter = computeCenter(window.fantasyMatsuFeature.geometry);
            const fantasyCenter = proj(manualCenter);
            const fantasyLabel = d3.select("#fantasy-matsu-label");
            const fantasyPath = d3.select("#fantasy-path-連江縣");
            if (!fantasyLabel.empty() && fantasyCenter && isFinite(fantasyCenter[0])) {
                fantasyLabel.attr("transform", `translate(${fantasyCenter[0]}, ${fantasyCenter[1]+40})`);
            }
            if (!fantasyPath.empty()) {
                fantasyPath.attr("d", path(window.fantasyMatsuFeature));
            }
        }
    }, 150);
});

window.addEventListener('load', function() {
    setTimeout(centerMapAtTianzhong, 200);
});