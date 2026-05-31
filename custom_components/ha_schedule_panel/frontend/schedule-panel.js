class SchedulePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._schedules = [];
    this._scheduleDetails = {};
    this._automations = [];
    this._hasFetchedDetails = false;
    this._zoomLevel = 0.5;
    this._dragState = null;
    this._wasDragging = false;
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

  connectedCallback() {
      this._boundMouseMove = this._onMouseMove.bind(this);
      this._boundMouseUp = this._onMouseUp.bind(this);
      this._boundTouchMove = this._onTouchMove.bind(this);
      this._boundTouchEnd = this._onTouchEnd.bind(this);

      this.shadowRoot.addEventListener('mousedown', this._onMouseDown.bind(this));
      this.shadowRoot.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
      this.shadowRoot.addEventListener('click', this._onClick.bind(this));

      window.addEventListener('mousemove', this._boundMouseMove);
      window.addEventListener('mouseup', this._boundMouseUp);
      window.addEventListener('touchmove', this._boundTouchMove, { passive: false });
      window.addEventListener('touchend', this._boundTouchEnd);
  }

  disconnectedCallback() {
      window.removeEventListener('mousemove', this._boundMouseMove);
      window.removeEventListener('mouseup', this._boundMouseUp);
      window.removeEventListener('touchmove', this._boundTouchMove);
      window.removeEventListener('touchend', this._boundTouchEnd);
  }

  showToast(message) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
          detail: { message },
          bubbles: true,
          composed: true
      }));
  }

  _onMouseDown(e) {
      this._startDrag(e.clientX, e.clientY, e.target);
  }

  _onTouchStart(e) {
      if (e.touches.length > 0) {
          const target = e.touches[0].target;
          if (this._startDrag(e.touches[0].clientX, e.touches[0].clientY, target)) {
              e.preventDefault();
          }
      }
  }

  _onClick(e) {
      const eventEl = e.target.closest('.calendar-event');
      if (eventEl && !eventEl.classList.contains('automation') && !this._wasDragging) {
          this.editSchedule(eventEl.dataset.entityId);
          return;
      }

      const newBtn = e.target.closest('#new-schedule-btn');
      if (newBtn) {
          e.preventDefault();
          this._openNewScheduleModal();
          return;
      }

      const dayBtn = e.target.closest('.day-btn');
      if (dayBtn) {
          e.preventDefault();
          dayBtn.classList.toggle('selected');
          return;
      }

      const cancelBtn = e.target.closest('#modal-cancel-btn');
      const closeBtn = e.target.closest('#modal-close-btn');
      if (cancelBtn || closeBtn) {
          e.preventDefault();
          this._closeModal();
          return;
      }

      if (e.target.id === 'schedule-modal') {
          e.preventDefault();
          this._closeModal();
          return;
      }

      const submitBtn = e.target.closest('#modal-submit-btn');
      if (submitBtn) {
          e.preventDefault();
          this._onCreateScheduleSubmit();
          return;
      }

      const addRangeBtn = e.target.closest('#add-range-btn');
      if (addRangeBtn) {
          e.preventDefault();
          this._addTimeRangeRow();
          return;
      }

      const removeRangeBtn = e.target.closest('.remove-range-btn');
      if (removeRangeBtn) {
          e.preventDefault();
          const row = removeRangeBtn.closest('.time-range-row');
          if (row) {
              row.remove();
              this._updateRemoveRangeButtons();
          }
          return;
      }
  }

  _openNewScheduleModal() {
      const modal = this.shadowRoot.getElementById('schedule-modal');
      if (modal) {
          // Reset form fields
          this.shadowRoot.getElementById('schedule-name').value = '';
          this.shadowRoot.getElementById('schedule-icon').value = 'mdi:calendar-clock';
          
          const container = this.shadowRoot.getElementById('time-ranges-container');
          if (container) {
              container.innerHTML = '';
              container.appendChild(this._createTimeRangeRow("08:00", "17:00"));
              this._updateRemoveRangeButtons();
          }
          
          // Default selection: Mon-Fri selected, Sat-Sun unselected
          const dayBtns = this.shadowRoot.querySelectorAll('.day-btn');
          dayBtns.forEach(btn => {
              const day = btn.dataset.day;
              if (day !== 'saturday' && day !== 'sunday') {
                  btn.classList.add('selected');
              } else {
                  btn.classList.remove('selected');
              }
          });
          
          modal.classList.add('open');
      }
  }

  _closeModal() {
      const modal = this.shadowRoot.getElementById('schedule-modal');
      if (modal) {
          modal.classList.remove('open');
      }
  }

  _createTimeRangeRow(start = "08:00", end = "17:00") {
      const row = document.createElement('div');
      row.className = 'time-range-row';
      row.style = 'display: flex; gap: 12px; align-items: center; margin-bottom: 8px;';
      row.innerHTML = `
          <div style="flex: 1;">
              <input type="time" class="schedule-start" value="${start}" required style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--divider-color); background-color: var(--primary-background-color); color: var(--primary-text-color); font-family: inherit;">
          </div>
          <span style="color: var(--secondary-text-color);">to</span>
          <div style="flex: 1;">
              <input type="time" class="schedule-end" value="${end}" required style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--divider-color); background-color: var(--primary-background-color); color: var(--primary-text-color); font-family: inherit;">
          </div>
          <button type="button" class="remove-range-btn">&times;</button>
      `;
      return row;
  }

  _addTimeRangeRow() {
      const container = this.shadowRoot.getElementById('time-ranges-container');
      if (container) {
          let lastEnd = "17:00";
          const rows = container.querySelectorAll('.time-range-row');
          if (rows.length > 0) {
              lastEnd = rows[rows.length - 1].querySelector('.schedule-end').value;
          }
          const parts = lastEnd.split(':');
          let h = parseInt(parts[0], 10);
          let newStartH = (h + 1) % 24;
          let newEndH = (h + 2) % 24;
          const format = (val) => val.toString().padStart(2, '0');
          const nextStart = `${format(newStartH)}:00`;
          const nextEnd = `${format(newEndH)}:00`;
          
          container.appendChild(this._createTimeRangeRow(nextStart, nextEnd));
          this._updateRemoveRangeButtons();
      }
  }

  _updateRemoveRangeButtons() {
      const container = this.shadowRoot.getElementById('time-ranges-container');
      if (!container) return;
      const rows = container.querySelectorAll('.time-range-row');
      rows.forEach(row => {
          const btn = row.querySelector('.remove-range-btn');
          if (btn) {
              btn.style.display = rows.length > 1 ? 'flex' : 'none';
          }
      });
  }

  async _onCreateScheduleSubmit() {
      const nameInput = this.shadowRoot.getElementById('schedule-name');
      const iconInput = this.shadowRoot.getElementById('schedule-icon');
      
      const name = nameInput ? nameInput.value.trim() : '';
      const icon = iconInput ? iconInput.value.trim() : 'mdi:calendar-clock';
      
      if (!name) {
          this.showToast('Please enter a schedule name');
          return;
      }
      
      const dayBtns = this.shadowRoot.querySelectorAll('.day-btn.selected');
      if (dayBtns.length === 0) {
          this.showToast('Please select at least one day');
          return;
      }
      
      const container = this.shadowRoot.getElementById('time-ranges-container');
      const rows = container ? container.querySelectorAll('.time-range-row') : [];
      const ranges = [];
      
      for (let row of rows) {
          const start = row.querySelector('.schedule-start').value;
          const end = row.querySelector('.schedule-end').value;
          
          const startParts = start.split(':');
          const endParts = end.split(':');
          const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
          let endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
          
          if (end === "00:00" || (endParts[0] === "00" && endParts[1] === "00")) {
              endMins = 1440;
          }
          
          if (startMins >= endMins) {
              this.showToast('For all ranges, start time must be before end time');
              return;
          }
          
          const formattedEnd = endMins === 1440 ? "24:00:00" : `${end}:00`;
          ranges.push({ from: `${start}:00`, to: formattedEnd });
      }
      
      if (ranges.length === 0) {
          this.showToast('Please add at least one time range');
          return;
      }
      
      const updatedConfig = {};
      const daysOfWeekKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      daysOfWeekKeys.forEach(day => {
          const btn = this.shadowRoot.querySelector(`.day-btn[data-day="${day}"]`);
          const isSelected = btn && btn.classList.contains('selected');
          updatedConfig[day] = isSelected ? ranges : [];
      });
      
      try {
          await this._hass.connection.sendMessagePromise({
              type: 'schedule/create',
              name: name,
              icon: icon || 'mdi:calendar-clock',
              ...updatedConfig
          });
          
          this.showToast(`Schedule "${name}" created successfully`);
          this._closeModal();
          this.fetchScheduleDetails();
      } catch (err) {
          console.error("Failed to create schedule helper.", err);
          this.showToast(`Failed to create schedule: ${err.message || 'Unknown error'}`);
      }
  }

  _startDrag(clientX, clientY, target) {
      const handle = target.closest('.resize-handle');
      const eventEl = target.closest('.calendar-event');
      
      if (!eventEl || eventEl.classList.contains('automation')) {
          return false;
      }
      
      let action = 'move';
      if (handle) {
          action = handle.classList.contains('top') ? 'resize-top' : 'resize-bottom';
      }
      
      const entityId = eventEl.dataset.entityId;
      const dayKey = eventEl.dataset.day;
      const blockIndex = parseInt(eventEl.dataset.blockIndex, 10);
      
      if (!entityId || !dayKey || isNaN(blockIndex)) {
          return false;
      }
      
      this._dragState = {
          action,
          entityId,
          dayKey,
          blockIndex,
          startY: clientY,
          initialTopPct: parseFloat(eventEl.dataset.topPct),
          initialHeightPct: parseFloat(eventEl.dataset.heightPct),
          initialStartMins: parseInt(eventEl.dataset.startMins, 10),
          initialEndMins: parseInt(eventEl.dataset.endMins, 10),
          dragEl: eventEl,
          isDragging: false
      };
      
      this._wasDragging = false;
      return true;
  }

  _onMouseMove(e) {
      if (!this._dragState) return;
      this._updateDrag(e.clientY);
  }

  _onTouchMove(e) {
      if (!this._dragState) return;
      if (e.touches.length > 0) {
          this._updateDrag(e.touches[0].clientY);
          e.preventDefault();
      }
  }

  _updateDrag(clientY) {
      const state = this._dragState;
      const deltaY = clientY - state.startY;
      
      // Calculate delta minutes (1 minute = zoomLevel pixels)
      let deltaMins = Math.round(deltaY / this._zoomLevel);
      
      // Snap to 15 minutes
      deltaMins = Math.round(deltaMins / 15) * 15;
      
      if (deltaMins !== 0) {
          state.isDragging = true;
          this._wasDragging = true;
      }
      
      let startMins = state.initialStartMins;
      let endMins = state.initialEndMins;
      
      if (state.action === 'resize-top') {
          startMins = state.initialStartMins + deltaMins;
          startMins = Math.max(0, Math.min(startMins, endMins - 15));
      } else if (state.action === 'resize-bottom') {
          endMins = state.initialEndMins + deltaMins;
          endMins = Math.max(startMins + 15, Math.min(endMins, 1440));
      } else if (state.action === 'move') {
          const duration = state.initialEndMins - state.initialStartMins;
          startMins = state.initialStartMins + deltaMins;
          endMins = startMins + duration;
          
          if (startMins < 0) {
              startMins = 0;
              endMins = duration;
          } else if (endMins > 1440) {
              endMins = 1440;
              startMins = 1440 - duration;
          }
      }
      
      // Update visual style
      const topPct = (startMins / 1440) * 100;
      const heightPct = ((endMins - startMins) / 1440) * 100;
      
      state.dragEl.style.top = `${topPct}%`;
      state.dragEl.style.height = `${heightPct}%`;
      
      const formatTimeStr = (mins) => {
          const h = Math.floor(mins / 60).toString().padStart(2, '0');
          const m = (mins % 60).toString().padStart(2, '0');
          return `${h}:${m}`;
      };
      
      const timeText = `${formatTimeStr(startMins)} - ${formatTimeStr(endMins)}`;
      state.dragEl.title = `${state.dragEl.dataset.name} (${timeText})`;
      
      const timeEl = state.dragEl.querySelector('.event-time');
      if (timeEl) {
          timeEl.textContent = timeText;
      }
      
      state.currentStartMins = startMins;
      state.currentEndMins = endMins;
  }

  _onMouseUp(e) {
      if (!this._dragState) return;
      this._endDrag();
  }

  _onTouchEnd(e) {
      if (!this._dragState) return;
      this._endDrag();
  }

  async _endDrag() {
      const state = this._dragState;
      this._dragState = null;
      
      if (!state.isDragging) {
          return;
      }
      
      const { entityId, dayKey, blockIndex, currentStartMins, currentEndMins } = state;
      
      if (currentStartMins === state.initialStartMins && currentEndMins === state.initialEndMins) {
          return;
      }
      
      const formatTimeStr = (mins) => {
          const h = Math.floor(mins / 60).toString().padStart(2, '0');
          const m = (mins % 60).toString().padStart(2, '0');
          return `${h}:${m}:00`;
      };
      
      const newStartStr = formatTimeStr(currentStartMins);
      const formattedEnd = currentEndMins === 1440 ? "24:00:00" : formatTimeStr(currentEndMins);
      
      try {
          const scheduleObj = this._schedules.find(s => s.entity_id === entityId);
          const scheduleId = entityId.split('.')[1];
          
          const normalizeTimeStr = (timeStr) => {
              if (!timeStr) return timeStr;
              if (timeStr.startsWith("23:59:59")) {
                  return "24:00:00";
              }
              const dotIdx = timeStr.indexOf('.');
              if (dotIdx !== -1) {
                  return timeStr.substring(0, dotIdx);
              }
              return timeStr;
          };
          
          const daysOfWeekKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const updatedConfig = {};
          
          daysOfWeekKeys.forEach(day => {
              const blocks = this._scheduleDetails[entityId]?.[day] || [];
              updatedConfig[day] = blocks.map((block, idx) => {
                  if (day === dayKey && idx === blockIndex) {
                      return { from: newStartStr, to: formattedEnd };
                  }
                  return {
                      from: normalizeTimeStr(block.from || block.start),
                      to: normalizeTimeStr(block.to || block.end)
                  };
              });
          });
          
          await this._hass.connection.sendMessagePromise({
              type: 'schedule/update',
              schedule_id: scheduleId,
              name: scheduleObj.attributes.friendly_name || scheduleId,
              icon: scheduleObj.attributes.icon || 'mdi:calendar-clock',
              ...updatedConfig
          });
          
          this.showToast(`Updated schedule successfully`);
          this.fetchScheduleDetails();
      } catch (err) {
          console.error("Failed to update schedule helper configuration.", err);
          this.showToast(`Failed to update schedule: ${err.message || 'Entity is read-only (YAML configuration)'}`);
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
      if (!this._hass) return;
      try {
          const automationEntities = Object.keys(this._hass.states).filter(id => id.startsWith('automation.'));
          const promises = automationEntities.map(async (entityId) => {
              try {
                  const stateObj = this._hass.states[entityId];
                  const response = await this._hass.connection.sendMessagePromise({
                      type: 'automation/config',
                      entity_id: entityId
                  });
                  if (response) {
                      const config = response.config || response.raw_config || response;
                      if (config && config.trigger) {
                          return {
                              alias: stateObj.attributes.friendly_name || config.alias || entityId.split('.')[1],
                              trigger: config.trigger,
                              state: stateObj.state
                          };
                      }
                  }
              } catch (err) {
                  // Silent catch for individual automations that might fail to return config
              }
              return null;
          });

          const results = await Promise.all(promises);
          const validAutomations = results.filter(auto => auto !== null);

          this._automations = validAutomations.filter(auto => {
              if (auto.state === 'off') return false; // Skip disabled automations
              if (!auto.trigger) return false;
              const triggers = Array.isArray(auto.trigger) ? auto.trigger : [auto.trigger];
              return triggers.some(t => t.platform === 'time');
          });

          this.render();
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
                
                dayBlocks.forEach((block, blockIndex) => {
                    const normalizeTimeStr = (timeStr) => {
                        if (!timeStr) return timeStr;
                        if (timeStr.startsWith("23:59:59")) {
                            return "24:00:00";
                        }
                        const dotIdx = timeStr.indexOf('.');
                        if (dotIdx !== -1) {
                            return timeStr.substring(0, dotIdx);
                        }
                        return timeStr;
                    };

                    const start = normalizeTimeStr(block.from || block.start);
                    const end = normalizeTimeStr(block.to || block.end);
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
                        entityId,
                        blockIndex
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
                    <div class="calendar-event automation" style="top: ${block.topPct}%; left: ${block.leftPct}%; width: calc(${block.widthPct}% - 2px); --automation-color: #f43f5e;">
                        <div class="automation-line"></div>
                        <div class="automation-flag" title="${labelText} @ ${block.start}">
                            <span class="pulse-dot"></span>
                            <ha-icon icon="${block.icon}"></ha-icon>
                            <span class="time-badge">${block.start}</span>
                            <span class="flag-title">${block.name}</span>
                        </div>
                    </div>
                    `;
                } else {
                    const borderStyle = `border-left: 4px solid ${block.color};`;
                    const timeText = `${block.start} - ${block.end}`;
                    return `
                    <div class="calendar-event" 
                         data-entity-id="${block.entityId}" 
                         data-day="${dayKey}" 
                         data-block-index="${block.blockIndex}"
                         data-top-pct="${block.topPct}"
                         data-height-pct="${block.heightPct}"
                         data-start-mins="${block.startMins}"
                         data-end-mins="${block.endMins}"
                         data-name="${block.name}"
                         title="${block.name} (${timeText})" 
                         style="top: ${block.topPct}%; height: ${block.heightPct}%; left: ${block.leftPct}%; width: calc(${block.widthPct}% - 2px); background-color: ${block.color}D9; ${borderStyle}">
                        <div class="resize-handle top"></div>
                        <div class="event-title"><ha-icon icon="${block.icon}"></ha-icon> <span>${block.name}</span></div>
                        <div class="event-time">${timeText}</div>
                        <div class="resize-handle bottom"></div>
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
            cursor: grab;
        }

        .calendar-event:active {
            cursor: grabbing;
        }

        .resize-handle {
            position: absolute;
            left: 0;
            right: 0;
            height: 8px;
            cursor: ns-resize;
            z-index: 10;
        }

        .resize-handle.top {
            top: 0;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
        }

        .resize-handle.bottom {
            bottom: 0;
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
        }

        /* Hover effect on handles to make them visible and feel premium */
        .calendar-event:hover .resize-handle {
            background-color: rgba(255, 255, 255, 0.15);
        }

        .calendar-event:hover .resize-handle:hover {
            background-color: rgba(255, 255, 255, 0.4);
        }

        .calendar-event.automation {
            background-color: transparent !important;
            border: none !important;
            overflow: visible;
            box-shadow: none;
            backdrop-filter: none;
            height: 0 !important;
            min-height: 0 !important;
            z-index: 20;
            cursor: default;
            pointer-events: none;
        }

        .automation-line {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--automation-color, #f43f5e) 60%, rgba(244, 63, 94, 0.1) 100%);
            box-shadow: 0 0 6px var(--automation-color, #f43f5e);
            border-radius: 1px;
        }

        .automation-flag {
            pointer-events: auto;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            position: absolute;
            top: -12px;
            left: 4px;
            background-color: var(--card-background-color, var(--primary-background-color));
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(244, 63, 94, 0.6);
            border-radius: 20px;
            padding: 2px 8px;
            color: var(--primary-text-color);
            font-size: 10px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1);
            white-space: nowrap;
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pulse-dot {
            width: 6px;
            height: 6px;
            background-color: var(--automation-color, #f43f5e);
            border-radius: 50%;
            position: relative;
            display: inline-block;
            flex-shrink: 0;
        }

        .pulse-dot::after {
            content: "";
            position: absolute;
            top: -3px;
            left: -3px;
            right: -3px;
            bottom: -3px;
            border-radius: 50%;
            border: 1.5px solid var(--automation-color, #f43f5e);
            animation: automation-pulse 2s infinite ease-out;
        }

        @keyframes automation-pulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
        }

        .automation-flag ha-icon {
            --mdc-icon-size: 12px;
            color: var(--automation-color, #f43f5e);
            flex-shrink: 0;
        }

        .time-badge {
            background-color: var(--automation-color, #f43f5e);
            color: #fff;
            padding: 0 4px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 9px;
            flex-shrink: 0;
        }

        .flag-title {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .automation-flag:hover {
            transform: translateY(-2px) scale(1.03);
            background-color: var(--card-background-color, var(--primary-background-color));
            border-color: rgba(244, 63, 94, 0.9);
            box-shadow: 0 6px 16px rgba(244, 63, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
            z-index: 100;
        }

        .calendar-event:hover {
            z-index: 15; /* Bring to front when hovering overlapping blocks */
            transform: scale(1.02);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
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

        .remove-range-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--secondary-text-color);
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: color 0.2s;
        }

        .remove-range-btn:hover {
            color: var(--error-color, #ef4444);
        }

        /* Modal Overlay */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }

        .modal-overlay.open {
            opacity: 1;
            pointer-events: auto;
        }

        /* Modal Content */
        .modal-content {
            background-color: var(--card-background-color, var(--primary-background-color));
            border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
            border-radius: 16px;
            width: 100%;
            max-width: 480px;
            padding: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }

        .modal-overlay.open .modal-content {
            transform: scale(1);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            padding-bottom: 12px;
        }

        .modal-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 500;
            color: var(--primary-text-color);
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--secondary-text-color);
            padding: 0;
            line-height: 1;
        }

        .close-btn:hover {
            color: var(--error-color, #ef4444);
        }

        /* Form groups */
        .form-group {
            margin-bottom: 16px;
        }

        .form-row {
            display: flex;
            gap: 16px;
        }

        .form-row .form-group {
            flex: 1;
        }

        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--secondary-text-color);
        }

        .form-group input[type="text"],
        .form-group input[type="time"] {
            width: 100%;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
            background-color: var(--primary-background-color);
            color: var(--primary-text-color);
            font-family: inherit;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }

        .form-group input[type="text"]:focus,
        .form-group input[type="time"]:focus {
            border-color: var(--primary-color);
        }

        /* Day Selectors */
        .day-selectors {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            margin-top: 4px;
        }

        .day-btn {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
            background-color: var(--primary-background-color);
            color: var(--secondary-text-color);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .day-btn:hover {
            border-color: var(--primary-color);
            color: var(--primary-color);
        }

        .day-btn.selected {
            background-color: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
        }

        /* Buttons */
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
            border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            padding-top: 16px;
        }

        .btn {
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }

        .btn.primary {
            background-color: var(--primary-color);
            color: white;
        }

        .btn.primary:hover {
            filter: brightness(1.1);
        }

        .btn.secondary {
            background-color: var(--secondary-background-color);
            color: var(--primary-text-color);
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        }

        .btn.secondary:hover {
            background-color: var(--divider-color, rgba(0, 0, 0, 0.05));
        }
      </style>

      <div class="header">
          <div class="title">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              Schedules
          </div>
          <div class="zoom-controls">
              <button class="icon-btn" id="new-schedule-btn" title="New Schedule" style="padding-left: 12px; padding-right: 12px; gap: 8px;">
                  <ha-icon icon="mdi:plus"></ha-icon> New Schedule
              </button>
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

      <div id="schedule-modal" class="modal-overlay">
          <div class="modal-content">
              <div class="modal-header">
                  <h2>Create New Schedule</h2>
                  <button class="close-btn" id="modal-close-btn">&times;</button>
              </div>
              <form id="schedule-form" onsubmit="return false;">
                  <div class="form-group">
                      <label for="schedule-name">Name</label>
                      <input type="text" id="schedule-name" required placeholder="e.g. Heating Schedule">
                  </div>
                  <div class="form-group">
                      <label for="schedule-icon">Icon</label>
                      <input type="text" id="schedule-icon" value="mdi:calendar-clock" placeholder="mdi:calendar-clock">
                  </div>
                  <div class="form-group">
                      <label>Time Ranges</label>
                      <div id="time-ranges-container">
                          <!-- Time range rows will be generated here -->
                      </div>
                      <button type="button" class="btn secondary" id="add-range-btn" style="margin-top: 8px; padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                          <ha-icon icon="mdi:plus" style="--mdc-icon-size: 16px;"></ha-icon> Add Time Range
                      </button>
                  </div><div class="form-group">
                      <label>Days of the Week</label>
                      <div class="day-selectors">
                          <button type="button" class="day-btn" data-day="monday">M</button>
                          <button type="button" class="day-btn" data-day="tuesday">T</button>
                          <button type="button" class="day-btn" data-day="wednesday">W</button>
                          <button type="button" class="day-btn" data-day="thursday">T</button>
                          <button type="button" class="day-btn" data-day="friday">F</button>
                          <button type="button" class="day-btn" data-day="saturday">S</button>
                          <button type="button" class="day-btn" data-day="sunday">S</button>
                      </div>
                  </div>
                  <div class="modal-footer">
                      <button type="button" class="btn secondary" id="modal-cancel-btn">Cancel</button>
                      <button type="submit" class="btn primary" id="modal-submit-btn">Create Schedule</button>
                  </div>
              </form>
          </div>
      </div>
    `;
  }
}

if (!customElements.get('schedule-panel')) {
    customElements.define('schedule-panel', SchedulePanel);
}
