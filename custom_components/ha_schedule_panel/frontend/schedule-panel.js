class SchedulePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._schedules = [];
    this._scheduleDetails = {};
    this._automations = [];
    this._hasFetchedDetails = false;
    this._zoomLevel = 0.5;
  }

  zoomIn() {
      if (this._zoomLevel < 3.0) {
          this._zoomLevel += 0.25;
          this.render();
      }
  }

  zoomOut() {
      if (this._zoomLevel > 0.5) {
          this._zoomLevel -= 0.25;
          this.render();
      }
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    
    // Initial fetch of detailed blocks if possible
    if (this._hass && !this._hasFetchedDetails) {
        this._hasFetchedDetails = true;
        this.fetchScheduleDetails();
        this.fetchAutomations();
    } else if (this._hass && this._hasFetchedDetails && oldHass) {
        // Detect if any schedule states changed (e.g. user edited a schedule in the dialog)
        const oldSchedules = Object.values(oldHass.states).filter(state => state.entity_id.startsWith('schedule.'));
        const newSchedules = Object.values(this._hass.states).filter(state => state.entity_id.startsWith('schedule.'));
        
        // If the state objects differ (like last_updated changed), re-fetch the details
        if (JSON.stringify(oldSchedules) !== JSON.stringify(newSchedules)) {
            this.fetchScheduleDetails();
        }
    }

    this.updateSchedules();
  }

  async fetchScheduleDetails() {
      try {
          const scheduleEntities = Object.values(this._hass.states)
              .filter(state => state.entity_id.startsWith('schedule.'))
              .map(state => state.entity_id);

          if (scheduleEntities.length === 0) return;

          // Fetch the configured time ranges directly using the service
          const response = await this._hass.connection.sendMessagePromise({
              type: 'call_service',
              domain: 'schedule',
              service: 'get_schedule',
              target: { entity_id: scheduleEntities },
              return_response: true
          });
          
          if (response && response.response) {
              // The response is keyed by entity_id: { 'schedule.my_schedule': { monday: [...], ... } }
              this._scheduleDetails = response.response;
              this.render(); // Re-render with real details
          }
      } catch (err) {
          console.log("Could not fetch detailed schedule blocks.", err);
      }
  }

  async fetchAutomations() {
      try {
          // Fetch automation config from REST API via hass object
          const automations = await this._hass.callApi('GET', 'config/automation/config');
          if (Array.isArray(automations)) {
              this._automations = automations.filter(auto => {
                  if (!auto.trigger) return false;
                  const triggers = Array.isArray(auto.trigger) ? auto.trigger : [auto.trigger];
                  return triggers.some(t => t.platform === 'time');
              });
              this.render();
          }
      } catch (err) {
          console.log("Could not fetch automations.", err);
      }
  }

  updateSchedules() {
    if (!this._hass) return;

    // Filter all schedule entities from states
    const newSchedules = Object.values(this._hass.states).filter(state =>
      state.entity_id.startsWith('schedule.')
    );

    // Simple diff
    if (JSON.stringify(newSchedules) !== JSON.stringify(this._schedules)) {
      this._schedules = newSchedules;
      this.render();
    } else if (!this.shadowRoot.innerHTML) {
      this.render();
    }
  }

  editSchedule(entityId) {
      if (!entityId || entityId === 'undefined') return;
      console.log('Opening more-info dialog for', entityId);
      
      const haRoot = document.querySelector('home-assistant') || this;
      haRoot.dispatchEvent(new CustomEvent('hass-more-info', {
          detail: { entityId, view: 'settings' },
          bubbles: true,
          composed: true,
      }));
  }

  getMockBlocks() {
      return {
          'monday': [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
          'tuesday': [{ start: '08:00', end: '12:00' }],
          'wednesday': [{ start: '08:00', end: '12:00' }],
          'thursday': [{ start: '08:00', end: '12:00' }],
          'friday': [{ start: '08:00', end: '12:00' }, { start: '18:00', end: '23:00' }],
          'saturday': [],
          'sunday': [{ start: '10:00', end: '20:00' }]
      };
  }


  render() {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

    // Curated premium color palette
    const PALETTE = [
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#8b5cf6', // Violet
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#f97316'  // Orange
    ];

    const colorMap = {};
    this._schedules.forEach((s, index) => {
        colorMap[s.entity_id] = PALETTE[index % PALETTE.length];
    });

    let contentHtml = '';

    if (this._schedules.length === 0) {
        contentHtml = `
            <div class="empty-state">
                <ha-icon icon="mdi:calendar-blank"></ha-icon>
                <p>No schedules found.</p>
                <span class="subtitle">Create a schedule helper in Home Assistant to see it here.</span>
            </div>
        `;
    } else {
        // Build Legend
        const legendHtml = this._schedules.map(schedule => {
            const name = schedule.attributes?.friendly_name || schedule.entity_id;
            const color = colorMap[schedule.entity_id];
            return `<div class="legend-item"><span class="color-dot" style="background-color: ${color}"></span>${name}</div>`;
        }).join('');

        // Pre-calculate blocks per day
        const dailyBlocks = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };

        this._schedules.forEach(schedule => {
            const entityId = schedule.entity_id;
            const name = schedule.attributes?.friendly_name || schedule.entity_id;
            const icon = schedule.attributes?.icon || 'mdi:calendar-clock';
            const color = colorMap[entityId];
            
            let blocks = this._scheduleDetails[entityId] || {};
            
            daysOfWeek.forEach(day => {
                const dayKey = day.toLowerCase();
                const dayBlocks = blocks[dayKey] || [];
                
                dayBlocks.forEach(block => {
                    const start = block.from || block.start;
                    const end = block.to || block.end;
                    if (!start || !end) return;
                    
                    const startParts = start.split(':');
                    const endParts = end.split(':');
                    
                    const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
                    let endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
                    
                    if (endMins === 0 && startMins > 0) endMins = 1440; // handle 00:00 end time

                    const topPct = (startMins / 1440) * 100;
                    let durationMins = endMins - startMins;
                    if (durationMins < 0) durationMins += 1440; // Midnight rollover
                    const heightPct = (durationMins / 1440) * 100;
                    
                    dailyBlocks[dayKey].push({
                        name, icon, color, topPct, heightPct, startMins, endMins,
                        start: start.substring(0, 5), end: end.substring(0, 5),
                        entityId
                    });
                });
            });
        });

        // Inject Time-Triggered Automations
        this._automations.forEach(auto => {
            const name = auto.alias || 'Unnamed Automation';
            const triggers = Array.isArray(auto.trigger) ? auto.trigger : [auto.trigger];
            
            triggers.forEach(t => {
                if (t.platform === 'time' && t.at) {
                    let times = Array.isArray(t.at) ? t.at : [t.at];
                    times.forEach(timeStr => {
                        let actualTime = timeStr;
                        // Handle input_datetime entities
                        if (timeStr.startsWith('input_datetime.')) {
                            const stateObj = this._hass.states[timeStr];
                            if (stateObj && stateObj.attributes.has_time) {
                                actualTime = stateObj.state;
                            } else {
                                return;
                            }
                        }
                        
                        const parts = actualTime.split(':');
                        if (parts.length >= 2) {
                            const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                            let endMins = startMins + 15; // 15 min visual block
                            if (endMins >= 1440) endMins = 1439;
                            
                            const topPct = (startMins / 1440) * 100;
                            const heightPct = (15 / 1440) * 100;
                            
                            daysOfWeek.forEach(day => {
                                dailyBlocks[day.toLowerCase()].push({
                                    name, icon: 'mdi:robot-outline', color: '#ef4444',
                                    topPct, heightPct, startMins, endMins,
                                    start: actualTime.substring(0, 5), end: '',
                                    isAutomation: true,
                                    triggerId: t.id || ''
                                });
                            });
                        }
                    });
                }
            });
        });

        // Process overlap per day
        daysOfWeek.forEach(day => {
            const dayKey = day.toLowerCase();
            const blocks = dailyBlocks[dayKey];
            
            // Sort blocks by start time
            blocks.sort((a, b) => a.startMins - b.startMins);
            
            // Group blocks that overlap
            let groups = [];
            blocks.forEach(block => {
                let addedToGroup = false;
                for (let group of groups) {
                    if (block.startMins < group.maxEnd) {
                        group.blocks.push(block);
                        group.maxEnd = Math.max(group.maxEnd, block.endMins);
                        addedToGroup = true;
                        break;
                    }
                }
                if (!addedToGroup) {
                    groups.push({ blocks: [block], maxEnd: block.endMins });
                }
            });
            
            // For each group, assign columns to allow side-by-side display
            groups.forEach(group => {
                let columns = [];
                group.blocks.forEach(block => {
                    let placed = false;
                    for (let i = 0; i < columns.length; i++) {
                        let col = columns[i];
                        if (col[col.length - 1].endMins <= block.startMins) {
                            col.push(block);
                            block.colIndex = i;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        block.colIndex = columns.length;
                        columns.push([block]);
                    }
                });
                
                group.blocks.forEach(block => {
                    block.widthPct = 100 / columns.length;
                    block.leftPct = block.widthPct * block.colIndex;
                });
            });
        });

        // Time Gutter (Y-Axis)
        const timeGutterHtml = `
            <div class="time-gutter">
                ${Array.from({length: 24}).map((_, i) => `
                    <div class="time-slot"><span>${i.toString().padStart(2, '0')}:00</span></div>
                `).join('')}
            </div>
        `;

        // Day Columns (X-Axis)
        const dayColumnsHtml = daysOfWeek.map((day, index) => {
            const dayKey = day.toLowerCase();
            const isToday = index === todayIndex;
            
            const blocksHtml = dailyBlocks[dayKey].map(block => {
                if (block.isAutomation) {
                    const labelText = block.triggerId ? `${block.name} (${block.triggerId})` : block.name;
                    return `
                    <div class="calendar-event automation" style="top: ${block.topPct}%; left: ${block.leftPct}%; width: calc(${block.widthPct}% - 2px);">
                        <div class="event-title" title="${labelText} @ ${block.start}"><ha-icon icon="${block.icon}"></ha-icon> ${labelText}</div>
                    </div>
                    `;
                } else {
                    const borderStyle = `border-left: 4px solid ${block.color};`;
                    const timeText = `${block.start} - ${block.end}`;
                    return `
                    <div class="calendar-event" title="${block.name} (${timeText})" style="top: ${block.topPct}%; height: ${block.heightPct}%; left: ${block.leftPct}%; width: calc(${block.widthPct}% - 2px); background-color: ${block.color}D9; ${borderStyle}" onclick="this.getRootNode().host.editSchedule('${block.entityId}')">
                        <div class="event-title"><ha-icon icon="${block.icon}"></ha-icon> <span>${block.name}</span></div>
                        <div class="event-time">${timeText}</div>
                    </div>
                    `;
                }
            }).join('');

            return `
                <div class="day-column ${isToday ? 'today' : ''}">
                    <div class="day-grid">
                        <!-- Grid lines -->
                        ${Array.from({length: 24}).map((_, i) => `<div class="grid-line" style="top: ${(i/24)*100}%"></div>`).join('')}
                        ${blocksHtml}
                    </div>
                </div>
            `;
        }).join('');

        const dayHeadersHtml = daysOfWeek.map((day, index) => `
            <div class="day-header ${index === todayIndex ? 'today' : ''}">${day}</div>
        `).join('');

        contentHtml = `
            <div class="calendar-wrapper">
                <div class="legend">
                    ${legendHtml}
                </div>
                <div class="calendar-scroll-area">
                    <div class="calendar-headers">
                        <div class="time-gutter-header"></div>
                        <div class="day-headers">
                            ${dayHeadersHtml}
                        </div>
                    </div>
                    <div class="calendar-body">
                        ${timeGutterHtml}
                        <div class="day-columns">
                            ${dayColumnsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --zoom-level: ${this._zoomLevel};
          display: block;
          padding: 24px;
          background-color: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
          min-height: 100vh;
          box-sizing: border-box;
        }

        * {
            box-sizing: border-box;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
        }

        .title {
            font-size: 28px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--primary-text-color);
        }

        .title ha-icon {
            color: var(--primary-color);
            --mdc-icon-size: 32px;
        }
        
        .zoom-controls {
            display: flex;
            gap: 8px;
        }

        .icon-btn {
            background: var(--secondary-background-color);
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            color: var(--primary-text-color);
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            background-color: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }

        .content {
            max-width: 1400px;
            margin: 0 auto;
        }

        /* Calendar Layout */
        .calendar-wrapper {
            background-color: var(--card-background-color, var(--secondary-background-color));
            border-radius: var(--ha-card-border-radius, 12px);
            box-shadow: var(--ha-card-box-shadow, 0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12));
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 75vh; /* Takes up most of the screen */
        }

        .legend {
            padding: 16px 24px;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            background-color: var(--secondary-background-color);
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
        }

        .color-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .calendar-scroll-area {
            flex: 1;
            overflow-y: auto;
            overflow-x: auto;
            display: flex;
            flex-direction: column;
        }

        .calendar-headers {
            display: flex;
            position: sticky;
            top: 0;
            z-index: 20;
            background-color: var(--card-background-color);
            border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        }

        .time-gutter-header {
            width: 60px;
            flex-shrink: 0;
            border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            background-color: var(--secondary-background-color);
        }

        .day-headers {
            display: flex;
            flex: 1;
            min-width: 700px;
        }

        .day-header {
            flex: 1;
            text-align: center;
            padding: 12px;
            font-weight: 600;
            font-size: 14px;
            color: var(--secondary-text-color);
            border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            background-color: var(--secondary-background-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .day-header:last-child {
            border-right: none;
        }

        .day-header.today {
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
        }

        .calendar-body {
            display: flex;
            flex: 1;
            min-width: 760px; /* 60px gutter + 700px grid */
        }

        .time-gutter {
            width: 60px;
            flex-shrink: 0;
            border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            background-color: var(--card-background-color);
            position: sticky;
            left: 0;
            z-index: 10;
        }

        .time-slot {
            height: calc(60px * var(--zoom-level)); /* 1 hour */
            position: relative;
        }

        .time-slot span {
            position: absolute;
            top: -8px;
            right: 8px;
            font-size: 12px;
            color: var(--secondary-text-color);
        }

        .day-columns {
            display: flex;
            flex: 1;
        }

        .day-column {
            flex: 1;
            border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            display: flex;
            flex-direction: column;
        }

        .day-column:last-child {
            border-right: none;
        }

        .day-column.today {
            background-color: rgba(var(--rgb-primary-color), 0.03);
        }

        .day-grid {
            position: relative;
            height: calc(1440px * var(--zoom-level)); /* 24 hours */
            width: 100%;
        }

        .grid-line {
            position: absolute;
            left: 0;
            right: 0;
            height: 1px;
            background-color: var(--divider-color, rgba(0, 0, 0, 0.05));
        }

        /* Business Block styling */
        .calendar-event {
            position: absolute;
            border-radius: 6px;
            padding: 6px 4px;
            overflow: hidden;
            color: white; /* High contrast text on colored blocks */
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            z-index: 5;
            transition: transform 0.1s, z-index 0.1s;
            backdrop-filter: blur(2px);
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-height: 20px; /* Prevent tiny blocks from breaking */
            cursor: pointer;
        }

        .calendar-event.automation {
            background-color: transparent !important;
            border: none !important;
            border-top: 2px dashed #ef4444 !important;
            color: var(--primary-text-color);
            overflow: visible;
            box-shadow: none;
            backdrop-filter: none;
            height: 0 !important;
            min-height: 0 !important;
            z-index: 10;
            cursor: default;
        }

        .calendar-event.automation .event-title {
            color: #ef4444;
            background: var(--card-background-color);
            padding: 2px 6px;
            border-radius: 12px;
            border: 1px solid #ef4444;
            display: inline-flex;
            position: absolute;
            top: -12px;
            left: 4px;
            font-size: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: calc(100% - 8px);
        }

        .calendar-event.automation .event-title ha-icon {
            color: #ef4444;
            --mdc-icon-size: 12px;
        }

        .calendar-event:hover {
            z-index: 15; /* Bring to front when hovering overlapping blocks */
            transform: scale(1.02);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .calendar-event.automation:hover {
            z-index: 25;
            transform: scale(1.02);
            box-shadow: none;
        }

        .event-title {
            font-weight: 600;
            font-size: 12px;
            display: flex;
            align-items: flex-start;
            gap: 4px;
            word-break: break-word;
            overflow: hidden;
            text-shadow: 0 1px 2px rgba(0,0,0,0.4);
            line-height: 1.2;
        }

        .event-title ha-icon {
            --mdc-icon-size: 14px;
            color: white;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
            flex-shrink: 0;
        }

        .event-time {
            font-size: 11px;
            font-weight: 500;
            opacity: 0.95;
            text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        /* Empty State */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 64px 24px;
            background-color: var(--card-background-color);
            border-radius: var(--ha-card-border-radius, 12px);
            text-align: center;
            border: 1px dashed var(--divider-color);
        }

        .empty-state ha-icon {
            --mdc-icon-size: 64px;
            color: var(--disabled-text-color);
            margin-bottom: 16px;
        }

        .empty-state p {
            font-size: 20px;
            font-weight: 500;
            margin: 0 0 8px 0;
        }

        .empty-state .subtitle {
            color: var(--secondary-text-color);
        }
      </style>

      <div class="header">
          <div class="title">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              Schedules
          </div>
          <div class="zoom-controls">
              <a href="/config/integrations/dashboard/add?domain=schedule" style="text-decoration: none;">
                  <button class="icon-btn" title="New Schedule" style="padding-left: 12px; padding-right: 12px; gap: 8px;">
                      <ha-icon icon="mdi:plus"></ha-icon> New Schedule
                  </button>
              </a>
              <button class="icon-btn" onclick="this.getRootNode().host.zoomOut()" title="Zoom Out">
                  <ha-icon icon="mdi:magnify-minus"></ha-icon>
              </button>
              <button class="icon-btn" onclick="this.getRootNode().host.zoomIn()" title="Zoom In">
                  <ha-icon icon="mdi:magnify-plus"></ha-icon>
              </button>
          </div>
      </div>
      <div class="content">
          ${contentHtml}
      </div>
    `;
  }
}

customElements.define('schedule-panel', SchedulePanel);
