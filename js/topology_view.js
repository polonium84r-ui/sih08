/**
 * RailFlow - Corridor Schematic Topology View
 * Interactive SVG rendering of stations, mainline Up/Down tracks, loops, signals, and active workzones.
 */

class TopologyViewRenderer {
  constructor(containerId, corridorData) {
    this.container = document.getElementById(containerId);
    this.data = corridorData;
    this.activeSection = "SEC-3";
    this.onSectionSelect = null;
  }

  render(activeBlock = null) {
    if (!this.container) return;

    const width = 1040;
    const height = 230;

    let svg = `<svg class="schematic-svg" viewBox="0 0 ${width} ${height}">`;

    // 1. Draw Background Rails - UP Line & DOWN Line
    const yUp = 90;
    const yDown = 140;

    // Up Main Line
    svg += `
      <line class="track-line main-up" x1="40" y1="${yUp}" x2="${width - 40}" y2="${yUp}" />
      <text x="15" y="${yUp + 4}" fill="#64748b" font-family="monospace" font-size="10" font-weight="700">UP</text>
    `;

    // Down Main Line
    svg += `
      <line class="track-line main-down" x1="40" y1="${yDown}" x2="${width - 40}" y2="${yDown}" />
      <text x="15" y="${yDown + 4}" fill="#64748b" font-family="monospace" font-size="10" font-weight="700">DN</text>
    `;

    // 2. Render Stations & Loops
    this.data.stations.forEach((st, idx) => {
      const x = st.coords.x;

      // Platform Box
      svg += `
        <rect class="station-platform" x="${x - 30}" y="45" width="60" height="20" rx="3" />
        <text class="station-label" x="${x}" y="59">${st.name}</text>
        <text class="station-code" x="${x}" y="36">${st.code}</text>
        <text class="station-km" x="${x}" y="77">KM ${st.km.toFixed(1)}</text>
      `;

      // Station Loops (Lines branching off)
      if (st.loops > 0) {
        svg += `
          <path class="track-line loop" d="M ${x - 35} ${yUp} Q ${x - 20} ${yUp - 22} ${x} ${yUp - 22} Q ${x + 20} ${yUp - 22} ${x + 35} ${yUp}" />
          <line x1="${x - 18}" y1="${yUp - 22}" x2="${x + 18}" y2="${yUp - 22}" stroke="#00e5ff" stroke-width="2" />
        `;
      }

      // Station Node Markers on tracks
      svg += `
        <circle class="station-node" cx="${x}" cy="${yUp}" r="5" />
        <circle class="station-node" cx="${x}" cy="${yDown}" r="5" />
      `;

      // Crossover tracks between UP and DOWN at junctions
      if (st.hasDepot) {
        svg += `
          <line x1="${x - 25}" y1="${yUp}" x2="${x - 5}" y2="${yDown}" stroke="#475569" stroke-width="2" stroke-dasharray="3 2" />
          <line x1="${x + 5}" y1="${yUp}" x2="${x + 25}" y2="${yDown}" stroke="#475569" stroke-width="2" stroke-dasharray="3 2" />
        `;
      }

      // Signal Lights (Green for clear, Yellow for caution)
      if (idx < this.data.stations.length - 1) {
        const sigX = x + 65;
        const isNearBlock = idx === 2; // Near SEC-3
        svg += `
          <circle class="signal-light ${isNearBlock ? 'yellow' : 'green'}" cx="${sigX}" cy="${yUp - 12}" r="4" />
          <line x1="${sigX}" y1="${yUp - 8}" x2="${sigX}" y2="${yUp}" stroke="#64748b" stroke-width="1.5" />
        `;
      }
    });

    // 3. Highlight Active Block Section (SEC-3: KAPG - BALU)
    if (activeBlock) {
      const sec = this.data.sections.find(s => s.id === (activeBlock.sectionId || "SEC-3"));
      if (sec) {
        const stFrom = this.data.stations.find(s => s.code === sec.from);
        const stTo = this.data.stations.find(s => s.code === sec.to);
        const blockX1 = stFrom.coords.x + 10;
        const blockX2 = stTo.coords.x - 10;
        const blockW = blockX2 - blockX1;

        // Striped active workzone overlay on UP line
        svg += `
          <rect class="workzone-marker" x="${blockX1}" y="${yUp - 16}" width="${blockW}" height="32" />
          <line x1="${blockX1}" y1="${yUp}" x2="${blockX2}" y2="${yUp}" class="track-blocked" stroke-width="6" />
          
          <g transform="translate(${(blockX1 + blockX2) / 2}, ${yUp + 1})">
            <rect x="-75" y="-12" width="150" height="24" rx="12" fill="#0b111e" stroke="#ffb300" stroke-width="1.5" />
            <text class="workzone-text" x="0" y="4">
              ACTIVE WORKZONE [${activeBlock.startTime || '12:15'} - ${activeBlock.endTime || '14:45'}]
            </text>
          </g>
        `;
      }
    }

    // 4. Live Train Markers
    // Train 1: Vande Bharat near CAP
    svg += `
      <g class="live-train-marker" transform="translate(820, ${yDown})">
        <circle cx="0" cy="0" r="7" fill="#00e5ff" class="train-pulse" />
        <circle cx="0" cy="0" r="4" fill="#ffffff" />
        <text x="12" y="3" font-family="monospace" font-size="9" fill="#00e5ff" font-weight="700">20836 (VB)</text>
      </g>
    `;

    // Train 2: Passenger 08442 waiting at KAPG
    svg += `
      <g class="live-train-marker" transform="translate(410, ${yUp})">
        <circle cx="0" cy="0" r="6" fill="#ff3366" />
        <circle cx="0" cy="0" r="3" fill="#ffffff" />
        <text x="-70" y="-10" font-family="monospace" font-size="9" fill="#ff3366" font-weight="700">08442 (HELD)</text>
      </g>
    `;

    svg += `</svg>`;
    this.container.innerHTML = svg;
  }
}

if (typeof window !== "undefined") {
  window.TopologyViewRenderer = TopologyViewRenderer;
}
