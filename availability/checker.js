/* Read-only customer availability. No BAND subscription URLs, customer details,
   event titles, calendar credentials or booking APIs are exposed to the browser. */
(function () {
  'use strict';

  // GitHub Actions updates this public, anonymous JSON on main every ~30 minutes.
  // Use raw.githubusercontent.com rather than GitHub Pages because commits created
  // by GITHUB_TOKEN do not trigger a new Pages deployment.
  const SNAPSHOT_URL = 'https://raw.githubusercontent.com/NLBusTours/Dream-Room-Booking-System/main/availability.json';
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

  function slotDefinitions() {
    if (typeField.value === 'children') return [
      ['10:00 AM–12:00 PM', '10:00', '12:00'],
      ['11:00 AM–1:00 PM', '11:00', '13:00'],
      ['2:00 PM–4:00 PM', '14:00', '16:00'],
    ];
    if (typeField.value === 'shower' && isWeekend(dateField.value)) return [
      ['10:00 AM–1:00 PM · shower special', '10:00', '13:00'],
      ['2:00 PM–5:00 PM · shower special', '14:00', '17:00'],
    ];
    return [];
  }

  function chip(code) {
    const el = document.createElement('span');
    el.className = 'availability-tag ' + code;
    el.textContent = code === 'booked' ? 'Booked' :
      code === 'available' ? 'Open to request' : 'Not verified';
    return el;
  }

  function render() {
    const type = typeField.value;
    panel.hidden = !type || type === 'host';
    if (panel.hidden) return;

    const day = dateField.value;
    slots.replaceChildren();
    slots.hidden = true;
    if (!day) {
      message.textContent = 'Choose a preferred date to see which time slots may be available.';
      updated.textContent = '';
      return;
    }

    if (state === 'idle' || state === 'loading') {
      message.textContent = 'Checking the Dream Room calendar…';
      updated.textContent = '';
      return;
    }
    const fresh = state === 'ready' && snapshotIsCurrent(snapshot, Date.now());
    if (!fresh) {
      message.textContent = state === 'error'
        ? 'Availability cannot be verified right now. You can still submit a booking inquiry.'
        : 'Calendar information needs updating. Please submit an inquiry for confirmation.';
      updated.textContent = '';
    } else {
      updated.textContent = 'Calendar snapshot checked ' + new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/St_Johns', dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(snapshot.generated_at)) + '. Updates are not instantaneous.';
    }

    const choices = slotDefinitions();
    if (choices.length) {
      slots.hidden = false;
      for (const [label, from, through] of choices) {
        const row = document.createElement('div');
        row.className = 'availability-slot';
        const title = document.createElement('span');
        title.textContent = label;
        row.append(title, chip(fresh ? availabilityFor(snapshot, day, from, through) : 'unknown'));
        slots.append(row);
      }
    }

    const begin = startField.value, end = endField.value;
    if (!begin || !end) {
      message.textContent = fresh ? 'Select a time slot above to check your exact requested hours.' :
        'Exact availability is not currently verified. Our team can confirm your request.';
      return;
    }
    const code = fresh ? availabilityFor(snapshot, day, begin, end) : 'unknown';
    message.textContent = code === 'booked'
      ? 'Your selected hours overlap an existing booking. Please choose another time or include an alternate date.'
      : code === 'available'
      ? 'Your selected hours may be available! Send an inquiry and our team will confirm.'
      : 'We cannot verify your chosen hours right now. You can still send an inquiry for staff confirmation.';
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
      const data = await response.json();
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
    field.addEventListener('change', changed);
  }
  for (const field of [startField, endField]) field.addEventListener('input', changed);
  refresh.addEventListener('click', () => load(true));
  changed();
})();
