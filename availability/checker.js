/* Read-only customer availability. No BAND subscription URLs, customer details,
   event titles, calendar credentials or booking APIs are exposed to the browser. */
(function () {
  'use strict';

  // GitHub Actions edits one public, anonymous issue roughly every 30 minutes.
  // This avoids repeated code commits and never exposes the private BAND feed.
  const SNAPSHOT_URL = 'https://api.github.com/repos/NLBusTours/Dream-Room-Booking-System/issues/11';
  const SNAPSHOT_START = '<!-- DREAM_ROOM_AVAILABILITY_JSON_START';
  const SNAPSHOT_END = 'DREAM_ROOM_AVAILABILITY_JSON_END -->';
  const MAX_AGE_MS = 120 * 60 * 1000;

  function addDay(dateString, count) {
    const parts = dateString.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + count));
    return d.toISOString().slice(0, 10);
  }

  function minutes(clock) {
    if (!/^\d{2}:\d{2}$/.test(clock)) return null;
    const [h, m] = clock.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : null;
  }

  function snapshotIsCurrent(snapshot, nowMs) {
    if (!snapshot || snapshot.version !== 1 || snapshot.timezone !== 'America/St_Johns' ||
        typeof snapshot.busy !== 'object' || !snapshot.busy || Array.isArray(snapshot.busy) ||
        typeof snapshot.from_date !== 'string' || typeof snapshot.through_date !== 'string') return false;
    const generated = Date.parse(snapshot.generated_at);
    const age = nowMs - generated;
    return Number.isFinite(generated) && age >= -5 * 60 * 1000 && age <= MAX_AGE_MS;
  }

  // Intervals are half-open [start,end): adjacent events do not block one another.
  // status is 'available', 'booked' or 'unknown'; available is NOT a reservation.
  function availabilityFor(snapshot, date, startClock, endClock, nowMs = Date.now()) {
    if (!snapshotIsCurrent(snapshot, nowMs)) return 'unknown';
    const start = minutes(startClock), end = minutes(endClock);
    if (start === null || end === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'unknown';

    const dates = end > start ? [[date, start, end]] :
      [[date, start, 1440], [addDay(date, 1), 0, end]];
    for (const [day, from, through] of dates) {
      if (day < snapshot.from_date || day > snapshot.through_date) return 'unknown';
      const intervals = snapshot.busy[day] || [];
      if (!Array.isArray(intervals)) return 'unknown';
      for (const interval of intervals) {
        if (!Array.isArray(interval) || interval.length !== 2 ||
            !Number.isInteger(interval[0]) || !Number.isInteger(interval[1]) ||
            interval[0] < 0 || interval[1] > 1440 || interval[0] >= interval[1]) return 'unknown';
        if (from < interval[1] && through > interval[0]) return 'booked';
      }
    }
    return 'available';
  }

  // Export testable, pure calendar calculations in Node.
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = {addDay, minutes, snapshotIsCurrent, availabilityFor};
    return;
  }

  const byId = id => document.getElementById(id);
  const panel = byId('availabilityPanel');
  if (!panel) return;
  const message = byId('availabilityMessage');
  const slots = byId('availabilitySlots');
  const updated = byId('availabilityAsOf');
  const refresh = byId('availabilityRefresh');
  const typeField = byId('eventType');
  const dateField = byId('rawDate');
  const startField = byId('startTime');
  const endField = byId('endTime');
  const childField = byId('childTimeSlot');
  const showerField = byId('showerTimeChoice');
  const form = byId('bookingForm');
  const choices = [
    {field: showerField, host: byId('showerBookingBlock'),
      list: byId('showerSlotCards'), helper: byId('showerSlotStatus'), label: 'shower'},
    {field: childField, host: byId('childSlotsBlock'),
      list: byId('childSlotCards'), helper: byId('childSlotStatus'), label: 'children'}
  ];
  const chosenBookedWarnings = {shower: '', children: ''};

  let snapshot = null;
  let state = 'idle';
  let requestInProgress = false;
  let lastRequestAt = 0;

  function isWeekend(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 0 || day === 6;
  }

  function chip(code) {
    const el = document.createElement('span');
    el.className = 'availability-tag ' + code;
    el.textContent = code === 'booked' ? 'Booked' :
      code === 'available' ? 'Open to request' :
      code === 'request' ? 'Request only' :
      code === 'checking' ? 'Checking…' :
      code === 'nodate' ? 'Choose date' : 'Not verified';
    return el;
  }

  // A single set of selection cards replaces both the dropdown and the
  // duplicate availability list. The select stays in the DOM for existing
  // booking, estimate, and email logic. If this script fails to load, the
  // original dropdown remains usable.
  function renderChoices(config, fresh) {
    if (!config.host || config.host.hidden) {
      config.list.hidden = true;
      config.helper.hidden = true;
      config.field.parentElement.classList.remove('slot-choice-enhanced');
      return;
    }
    config.field.parentElement.classList.add('slot-choice-enhanced');
    config.field.required = false; // visible cards provide selection validation
    config.list.hidden = false;
    config.helper.hidden = false;
    config.list.replaceChildren();

    const day = dateField.value;
    let freeCount = 0, bookedCount = 0;
    for (const option of Array.from(config.field.options).slice(1)) {
      const custom = option.value === 'other';
      const parts = custom ? null : option.value.split('|');
      const status = !day ? 'nodate' : custom ? 'request' :
        state === 'loading' || state === 'idle' ? 'checking' : fresh
        ? availabilityFor(snapshot, day, parts[0], parts[1])
        : 'unknown';

      if (status === 'booked') bookedCount++;
      if (status === 'available') freeCount++;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-choice';
      button.setAttribute('aria-pressed', String(config.field.value === option.value));
      button.disabled = !day || status === 'booked' || status === 'checking';
      const text = document.createElement('span');
      text.className = 'slot-title';
      text.textContent = option.textContent.trim();
      button.append(text, chip(status));
      button.addEventListener('click', () => {
        if (button.disabled) return;
        chosenBookedWarnings[config.label] = '';
        config.field.value = option.value;
        config.field.dispatchEvent(new Event('change', {bubbles: true}));
      });
      config.list.append(button);
    }

    // If the calendar updated after a customer made a selection, clear the
    // now-booked slot. Never silently accept a known unavailable fixed slot.
    const selected = config.field.value;
    if (fresh && day && selected && selected !== 'other') {
      const parts = selected.split('|');
      if (availabilityFor(snapshot, day, parts[0], parts[1]) === 'booked') {
        chosenBookedWarnings[config.label] = 'That time is already booked. Please choose another date or request a different time.';
        config.field.value = '';
        config.field.dispatchEvent(new Event('change', {bubbles: true}));
        return;
      }
    }

    config.helper.classList.toggle('error', Boolean(chosenBookedWarnings[config.label]));
    if (chosenBookedWarnings[config.label]) {
      config.helper.textContent = chosenBookedWarnings[config.label];
    } else if (!day) {
      config.helper.textContent = 'Choose your preferred date first to see available times.';
    } else if (state === 'loading' || state === 'idle') {
      config.helper.textContent = 'Checking the Dream Room calendar…';
    } else if (!fresh) {
      config.helper.textContent = 'Calendar unavailable or out of date. Times can still be requested and will be verified by our team.';
    } else if (freeCount === 0 && bookedCount > 0) {
      config.helper.textContent = 'All listed slots are booked. Choose another date or request another time for review.';
    } else {
      const checked = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/St_Johns', dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(snapshot.generated_at));
      config.helper.textContent = 'Calendar checked ' + checked +
        '. Open times are requests only, subject to confirmation.';
    }
  }

  function render() {
    const type = typeField.value;
    const day = dateField.value;
    const fresh = state === 'ready' && snapshotIsCurrent(snapshot, Date.now());
    for (const config of choices) renderChoices(config, fresh);

    // When a fixed-slot category is selected, availability is already shown
    // directly on each time choice: no duplicated panel farther down.
    const customChoice = type === 'children' ? childField.value === 'other' :
      type === 'shower' && isWeekend(day) ? showerField.value === 'other' : true;
    panel.hidden = !type || type === 'host' || !customChoice;
    if (panel.hidden) return;

    updated.textContent = '';
    slots.replaceChildren();
    slots.hidden = true;
    if (!day) {
      message.textContent = 'Choose your preferred date and hours to check availability.';
      return;
    }
    if (state === 'idle' || state === 'loading') {
      message.textContent = 'Checking the Dream Room calendar…';
      return;
    }
    if (!fresh) {
      message.textContent = 'Availability cannot be verified right now. You can still submit a booking inquiry for confirmation.';
    } else {
      updated.textContent = 'Calendar checked ' + new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/St_Johns', dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(snapshot.generated_at)) + '. Updates are not instantaneous.';
    }

    const begin = startField.value, end = endField.value;
    if (!begin || !end) {
      if (fresh) message.textContent = 'Enter your requested hours to check for booking conflicts.';
      return;
    }
    const code = fresh ? availabilityFor(snapshot, day, begin, end) : 'unknown';
    message.textContent = code === 'booked'
      ? 'Your requested hours overlap an existing booking. Please choose another time or date.'
      : code === 'available'
      ? 'These hours appear open to request! Our team will confirm your booking.'
      : 'We cannot verify these hours right now. You can still submit an inquiry for staff confirmation.';
  }

  async function load(force = false) {
    if (requestInProgress) return;
    if (!force && state === 'ready' && Date.now() - lastRequestAt < 10 * 60 * 1000 &&
        snapshotIsCurrent(snapshot, Date.now())) {
      render();
      return;
    }
    state = 'loading';
    requestInProgress = true;
    lastRequestAt = Date.now();
    refresh.disabled = true;
    render();
    try {
      const url = SNAPSHOT_URL + '?refresh=' + Math.floor(Date.now() / (5 * 60 * 1000));
      const response = await fetch(url, {cache: 'no-store', headers: {Accept: 'application/json'}});
      if (!response.ok) throw new Error('Calendar snapshot not available');
      const record = await response.json();
      if (typeof record.body !== 'string') throw new Error('Availability record missing');
      const start = record.body.indexOf(SNAPSHOT_START);
      const end = record.body.indexOf(SNAPSHOT_END, start + SNAPSHOT_START.length);
      if (start < 0 || end < 0) throw new Error('Availability record has no valid snapshot');
      const raw = record.body.slice(start + SNAPSHOT_START.length, end).trim();
      const data = JSON.parse(raw);
      if (!snapshotIsCurrent(data, Date.now())) throw new Error('Calendar snapshot is missing or stale');
      snapshot = data;
      state = 'ready';
    } catch (err) {
      snapshot = null;
      state = 'error';
    } finally {
      requestInProgress = false;
      refresh.disabled = false;
      render();
    }
  }

  function changed() {
    render();
    if (dateField.value && typeField.value && typeField.value !== 'host') load();
  }
  for (const field of [typeField, dateField, startField, endField, childField, showerField]) {
    field.addEventListener('change', () => {
      if (field === dateField || field === typeField) {
        chosenBookedWarnings.shower = '';
        chosenBookedWarnings.children = '';
      }
      changed();
    });
  }
  // Use the visible card group for required choices; the hidden select is
  // still submitted by the existing form workflow.
  form.addEventListener('submit', event => {
    const type = typeField.value;
    const config = type === 'children' ? choices[1] :
      type === 'shower' && isWeekend(dateField.value) ? choices[0] : null;
    if (!config || !dateField.value) return;
    const value = config.field.value;
    let error = !value ? 'Please select a time slot or request another time.' : '';
    if (!error && value !== 'other' && state === 'ready' &&
        snapshotIsCurrent(snapshot, Date.now())) {
      const [begin, end] = value.split('|');
      if (availabilityFor(snapshot, dateField.value, begin, end) === 'booked') {
        error = 'That time is booked. Please choose another date or request another time.';
      }
    }
    if (!error) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    chosenBookedWarnings[config.label] = error;
    if (value && value !== 'other') config.field.value = '';
    render();
    config.host.scrollIntoView({behavior: 'smooth', block: 'center'});
  }, true);
  for (const field of [startField, endField]) field.addEventListener('input', changed);
  refresh.addEventListener('click', () => load(true));
  changed();
})();
