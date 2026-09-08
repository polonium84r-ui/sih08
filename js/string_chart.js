/**
 * RailFlow - Time-Distance String Chart (Marey Graph) Renderer
 * High-performance interactive SVG time-distance graphing for corridor train paths and block windows.
 */

class StringChartRenderer {
  constructor(containerId, corridorData) {
    this.container = document.getElementById(containerId);
    this.data = corridorData;
    this.width = 1100;
    this.height = 540;
    this.margin = { top: 40, right: 40, bottom: 55, left: 100 };
    this.activeBlock = {
      sectionId: "S-BHC-JJKR",
      startTime: "11:30",
      endTime: "14:00",
      isCoordinated: true
    };
    this.simResult = null;
    this.tooltip = null;
    this.currentTimeMin = 12 * 60 + 30; // default 12:30
  }

  init() {
    if (!this.container) return;
    this.createTooltip();
    this.render();
  }

  createTooltip() {
    let tip = document.querySelector(".chart-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "chart-tooltip";
      document.body.appendChild(tip);
    }
    this.tooltip = tip;
  }

  timeToMin(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  minToTime(min) {
    const norm = (min % 1440 + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const minVal = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(minVal).padStart(2, "0")}`;
  }

  // Coordinate transforms
  xScale(minutes) {
    const plotWidth = this.width - this.margin.left - this.margin.right;
    return this.margin.left + (minutes / 1440) * plotWidth;
  }

  yScale(km) {
    // 376 gives comfortable margin below Medinipur (361k) so it doesn't collide with bottom axis
    const maxKm = 376;
    const plotHeight = this.height - this.margin.top - this.margin.bottom;
    return this.margin.top + (km / maxKm) * plotHeight;
  }

  setActiveBlock(block, simResult = null) {
    this.activeBlock = block;
    this.simResult = simResult;
    this.render();
  }

  render() {
    if (!this.container) return;

    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;

    let svg = `<svg class="chart-svg" viewBox="0 0 ${this.width} ${this.height}" preserveAspectRatio="none">`;

    // 1. Background Grid - Horizontal Station Lines
    this.data.stations.forEach(st => {
      const y = this.yScale(st.km);
      svg += `
        <line class="grid-line-y" x1="${this.margin.left}" y1="${y}" x2="${this.width - this.margin.right}" y2="${y}" />
        <text class="axis-text-y" x="${this.margin.left - 10}" y="${y + 4}">${st.code}</text>
        <text class="axis-km-y" x="${this.margin.left - 52}" y="${y + 4}">${st.km.toFixed(0)}k</text>
      `;
    });

    // 2. Background Grid - Vertical Hour Lines
    for (let h = 0; h <= 24; h += 2) {
      const x = this.xScale(h * 60);
      const isMajor = h % 4 === 0;
      svg += `
        <line class="grid-line-x ${isMajor ? 'hour-major' : ''}" x1="${x}" y1="${this.margin.top}" x2="${x}" y2="${this.height - this.margin.bottom}" />
        <text class="axis-text-x" x="${x}" y="${this.height - this.margin.bottom + 22}">${String(h).padStart(2, '0')}:00</text>
      `;
    }

    // 3. Maintenance Block Window Rectangles
    if (this.activeBlock) {
      const sec = this.data.sections.find(s => s.id === this.activeBlock.sectionId);
      if (sec) {
        const stFrom = this.data.stations.find(s => s.code === sec.from);
        const stTo = this.data.stations.find(s => s.code === sec.to);

        const y1 = Math.min(this.yScale(stFrom.km), this.yScale(stTo.km));
        const y2 = Math.max(this.yScale(stFrom.km), this.yScale(stTo.km));
        const blockH = y2 - y1;

        const xStart = this.xScale(this.timeToMin(this.activeBlock.startTime));
        const xEnd = this.xScale(this.timeToMin(this.activeBlock.endTime));
        const blockW = Math.max(8, xEnd - xStart);

        const blockClass = this.activeBlock.isCoordinated ? "coordinated" : "uncoordinated";
        const strokeColor = this.activeBlock.isCoordinated ? "#00e676" : "#ff3366";
        const fillColor = this.activeBlock.isCoordinated ? "rgba(0, 230, 118, 0.22)" : "rgba(255, 51, 102, 0.25)";
        const blockTitle = this.activeBlock.isCoordinated ? "COORDINATED MEGA-BLOCK" : "LINE BLOCK";
        const blockTime = `${this.activeBlock.startTime} - ${this.activeBlock.endTime}`;
        const badgeW = Math.min(Math.max(blockW + 10, 195), 235);

        svg += `
          <g class="block-zone-group">
            <rect class="chart-block-window ${blockClass}" 
                  x="${xStart}" y="${y1}" width="${blockW}" height="${blockH}" 
                  fill="${fillColor}" stroke="${strokeColor}" />
            <rect x="${xStart}" y="${y1 + 4}" width="${badgeW}" height="20" rx="4"
                  fill="rgba(8, 18, 33, 0.90)" stroke="${strokeColor}" stroke-width="1" />
            <text class="chart-block-label" x="${xStart + 6}" y="${y1 + 18}" fill="${strokeColor}">
              [BLOCK] ${this.activeBlock.isCoordinated ? 'MEGA-BLOCK' : 'BLOCK'} (${blockTime})
            </text>
          </g>
        `;
      }
    }

    // 4. Train Trajectories (Original Timetable)
    const trainList = this.simResult?.simulatedTrains || this.data.trains;

    trainList.forEach(tr => {
      let pathD = "";
      const isUp = tr.direction === "UP";
      const stops = tr.stops;

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        const station = this.data.stations.find(s => s.code === stop.station);
        if (!station) continue;
        const y = this.yScale(station.km);

        const tArr = this.timeToMin(stop.arr || stop.dep);
        const tDep = this.timeToMin(stop.dep || stop.arr);

        const xArr = this.xScale(tArr);
        const xDep = this.xScale(tDep);

        if (i === 0) {
          pathD += `M ${xDep} ${y} `;
        } else {
          pathD += `L ${xArr} ${y} `;
          if (xDep !== xArr) {
            pathD += `L ${xDep} ${y} `; // station dwell segment
          }
        }
      }

      const trainClass = tr.priority === 1 ? 'vb' : (tr.priority === 2 ? 'exp' : (tr.type === 'FREIGHT' ? 'frt' : 'pass'));
      const strokeFallback = tr.priority === 1 ? '#00e5ff' : (tr.priority === 2 ? '#f59e0b' : (tr.type === 'FREIGHT' ? '#8b5cf6' : '#94a3b8'));
      
      svg += `
        <path class="train-path ${trainClass}" 
              d="${pathD}" 
              stroke="${tr.color || strokeFallback}" 
              data-train-id="${tr.id}"
              data-train-name="${tr.name}"
              data-train-type="${tr.type}"
              data-delay="${tr.totalDelayMin || 0}"
        />
      `;

      // Draw train label at start
      const firstStation = this.data.stations.find(s => s.code === stops[0].station);
      if (firstStation) {
        const startX = this.xScale(this.timeToMin(stops[0].dep || stops[0].arr));
        const startY = this.yScale(firstStation.km);
        const labelY = isUp ? startY + 12 : startY - 5;
        svg += `
          <text x="${startX + 4}" y="${labelY}" font-size="9" font-family="monospace" fill="${tr.color || strokeFallback}" font-weight="700">
            ${tr.id}
          </text>
        `;
      }

      // 5. Delayed Trajectory Projection (if train was delayed in simulation)
      if (tr.totalDelayMin > 0 && this.activeBlock) {
        const sec = this.data.sections.find(s => s.id === this.activeBlock.sectionId);
        const stHoldCode = isUp ? sec.to : sec.from;
        const stHold = this.data.stations.find(s => s.code === stHoldCode);
        const holdKm = stHold ? stHold.km : (isUp ? 163.2 : 119.5);
        const holdY = this.yScale(holdKm);
        const holdEndMin = this.timeToMin(this.activeBlock.endTime) + 5;
        const holdX = this.xScale(holdEndMin);

        // Draw hold point marker
        svg += `
          <circle class="regulation-point" cx="${holdX}" cy="${holdY}" r="5" />
          <text x="${holdX + 8}" y="${holdY + 4}" font-size="9" font-family="monospace" fill="#ff3366" font-weight="700">
            +${tr.totalDelayMin}m REGULATION
          </text>
        `;

        // Draw projected delayed path
        let delayedPathD = `M ${holdX} ${holdY} `;
        const holdStationIdx = stops.findIndex(s => s.station === stHoldCode);
        const remainingStops = holdStationIdx >= 0 ? stops.slice(holdStationIdx + 1) : stops;

        remainingStops.forEach(stop => {
          const st = this.data.stations.find(s => s.code === stop.station);
          if (st) {
            const ySt = this.yScale(st.km);
            const origArr = this.timeToMin(stop.arr || stop.dep);
            const origDep = this.timeToMin(stop.dep || stop.arr);
            const delArr = Math.min(1439, origArr + tr.totalDelayMin);
            const delDep = Math.min(1439, origDep + tr.totalDelayMin);
            delayedPathD += `L ${this.xScale(delArr)} ${ySt} `;
            if (delDep !== delArr) {
              delayedPathD += `L ${this.xScale(delDep)} ${ySt} `;
            }
          }
        });

        svg += `
          <path class="train-path-delayed" d="${delayedPathD}" />
        `;
      }
    });

    // 6. Current Time Scrubber Line
    const scrubX = this.xScale(this.currentTimeMin);
    svg += `
      <line class="scrubber-line" x1="${scrubX}" y1="${this.margin.top}" x2="${scrubX}" y2="${this.height - this.margin.bottom}" />
      <polygon class="scrubber-head" points="${scrubX - 6},${this.margin.top - 8} ${scrubX + 6},${this.margin.top - 8} ${scrubX},${this.margin.top}" />
      <text x="${scrubX}" y="${this.margin.top - 12}" font-family="monospace" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">
        ${this.minToTime(this.currentTimeMin)}
      </text>
    `;

    svg += `</svg>`;
    this.container.innerHTML = svg;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const paths = this.container.querySelectorAll(".train-path");
    paths.forEach(p => {
      p.addEventListener("mouseenter", (e) => {
        const tid = p.getAttribute("data-train-id");
        const tname = p.getAttribute("data-train-name");
        const delay = p.getAttribute("data-delay");
        const type = p.getAttribute("data-train-type");

        if (this.tooltip) {
          this.tooltip.innerHTML = `
            <div class="chart-tooltip-title">${tid} - ${tname}</div>
            <div>Category: <strong>${type}</strong></div>
            <div>Projected Delay: <strong style="color: ${delay > 0 ? '#ff3366' : '#00e676'}">${delay > 0 ? '+' + delay + ' mins' : 'ON TIME (0m)'}</strong></div>
          `;
          this.tooltip.style.display = "block";
          this.positionTooltip(e);
        }
      });

      p.addEventListener("mousemove", (e) => this.positionTooltip(e));
      p.addEventListener("mouseleave", () => {
        if (this.tooltip) this.tooltip.style.display = "none";
      });
    });
  }

  positionTooltip(e) {
    if (!this.tooltip) return;
    this.tooltip.style.left = `${e.pageX + 15}px`;
    this.tooltip.style.top = `${e.pageY + 15}px`;
  }
}

if (typeof window !== "undefined") {
  window.StringChartRenderer = StringChartRenderer;
}
