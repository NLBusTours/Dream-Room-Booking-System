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
  const TURNOVER_START = 13 * 60;
  const TURNOVER_END = 14 * 60;
  const MAX_RENTAL_MINUTES = 16 * 60;

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

  // The 1–2 PM turnover is a standing venue policy, not a BAND booking.
  // This is enforced even if the calendar feed becomes unavailable.
  function bookingParts(date, startClock, endClock) {
    const start = minutes(startClock), end = minutes(endClock);
    if (start === null || end === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        start === end) return null;
    const length = end > start ? end - start : 1440 - start + end;
    if (length > MAX_RENTAL_MINUTES) return null;
    return end > start ? [[date, start, end]] :
      [[date, start, 1440], [addDay(date, 1), 0, end]];
  }

  function validBusyIntervals(snapshot, date) {
    if (date < snapshot.from_date || date > snapshot.through_date) return null;
    const intervals = snapshot.busy[date] || [];
    if (!Array.isArray(intervals)) return null;
    for (const range of intervals) {
      if (!Array.isArray(range) || range.length !== 2 ||
          !Number.isInteger(range[0]) || !Number.isInteger(range[1]) ||
          range[0] < 0 || range[1] > 1440 || range[0] >= range[1]) return null;
    }
    return intervals;
  }

  // Intervals are half-open [start,end); back-to-back bookings do not overlap.
  // 'turnover' is different from 'booked', so no fictitious BAND event is shown.
  function availabilityFor(snapshot, date, startClock, endClock, nowMs = Date.now()) {
    const parts = bookingParts(date, startClock, endClock);
    if (!parts) return 'invalid';
    if (parts.some(([day, from, through]) => from < TURNOVER_END && through > TURNOVER_START)) {
      return 'turnover';
    }
    if (!snapshotIsCurrent(snapshot, nowMs)) return 'unknown';
    for (const [day, from, through] of parts) {
      const intervals = validBusyIntervals(snapshot, day);
      if (!intervals) return 'unknown';
      if (intervals.some(([busyStart, busyEnd]) => from < busyEnd && through > busyStart)) return 'booked';
    }
    return 'available';
  }

  function formatMinute(minute) {
    const hour = Math.floor(minute / 60) % 24;
    const mm = String(minute % 60).padStart(2, '0');
    return (hour % 12 || 12) + ':' + mm + ' ' + (hour < 12 ? 'AM' : 'PM');
  }

  function formatOccupiedHours(snapshot, date, nowMs = Date.now()) {
    if (!snapshotIsCurrent(snapshot, nowMs)) return null;
    const intervals = validBusyIntervals(snapshot, date);
    if (!intervals) return null;
    if (!intervals.length) return 'No calendar bookings or holds recorded for this date.';
    if (intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 1440) {
      return 'Calendar booked/held: All day.';
    }
    return 'Calendar booked/held: ' +
      intervals.map(([a, b]) => formatMinute(a) + '–' + formatMinute(b)).join('; ') + '.';
  }

  // Export testable, pure calendar calculations in Node.
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = {addDay, minutes, snapshotIsCurrent, availabilityFor, formatOccupiedHours, bookingParts};
    return;
  }

  const byId = id => document.getElementById(id);
  const panel = byId('availabilityPanel');
  const dailyHoursPanel = byId('dailyUnavailability');
  const dailyBookedHours = byId('dailyBookedHours');
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
      code === 'turnover' ? 'Unavailable · switchover' :
      code === 'invalid' ? 'Invalid hours' :
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
      button.disabled = !day || status === 'booked' || status === 'turnover' || status === 'invalid' || status === 'checking';
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
      if (['booked','turnover','invalid'].includes(availabilityFor(snapshot, day, parts[0], parts[1]))) {
        chosenBookedWarnings[config.label] = 'That time is unavailable. Please choose another date or request a different time.';
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
    dailyHoursPanel.hidden = !day || !type || type === 'host';
    if (!dailyHoursPanel.hidden) {
      dailyBookedHours.textContent = fresh
        ? formatOccupiedHours(snapshot, day)
        : state === 'idle' || state === 'loading'
          ? 'Checking the calendar for booked or held hours…'
          : 'Booked hours cannot be verified right now. The 1–2 PM switchover remains unavailable.';
    }
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
    const code = availabilityFor(fresh ? snapshot : null, day, begin, end);
    const weddingPackage = byId('weddingPackage');
    const requiredHours = type === 'wedding' && weddingPackage &&
      (weddingPackage.value === 'styled4' ? 4 : weddingPackage.value === 'styled8' ? 8 : null);
    const parts = bookingParts(day, begin, end);
    const selectedMinutes = parts && (minutes(end) - minutes(begin) + 1440) % 1440;
    message.textContent = code === 'invalid'
      ? 'Those access times are invalid or longer than 16 hours. Please select a valid start and end time.'
      : requiredHours !== null && selectedMinutes !== requiredHours * 60
      ? 'This wedding package requires exactly ' + requiredHours + ' hours of access. Please adjust your end time.'
      : code === 'turnover'
      ? 'Your requested hours include our 1:00–2:00 PM switchover. That hour cannot be booked. Choose a time ending by 1 PM or starting at 2 PM.'
      : code === 'booked'
      ? 'Your requested hours overlap the booked/held hours shown above. Please choose another time or date.'
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
  // Capture before the form's email handler. A switchover or verified calendar
  // conflict is not a valid request, whether it comes from a card or manual times.
  form.addEventListener('submit', event => {
    const type = typeField.value;
    if (!type || type === 'host' || !dateField.value) return;
    const config = type === 'children' ? choices[1] :
      type === 'shower' && isWeekend(dateField.value) ? choices[0] : null;
    let error = '';
    let target = panel;
    if (config && !config.field.value) {
      error = 'Please select a time slot or request another time.';
      target = config.host;
    } else if (startField.value && endField.value) {
      const code = availabilityFor(snapshot, dateField.value, startField.value, endField.value);
      if (code === 'turnover') error = '1:00–2:00 PM is reserved for our daily switchover and cannot be booked. Please change your hours.';
      else if (code === 'booked') error = 'Your requested hours overlap the booked/held times above. Please select another date or time.';
      else if (code === 'invalid') error = 'Please choose valid access times, no more than 16 hours apart.';
      const packageValue = byId('weddingPackage')?.value;
      const hours = type === 'wedding' && (packageValue === 'styled4' ? 4 : packageValue === 'styled8' ? 8 : null);
      const duration = (minutes(endField.value) - minutes(startField.value) + 1440) % 1440;
      if (!error && hours !== null && duration !== hours * 60) {
        error = 'This wedding package must have exactly ' + hours + ' hours of access.';
      }
    }
    if (!error) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (config && !config.field.value) {
      chosenBookedWarnings[config.label] = error;
      render();
    } else {
      panel.hidden = false;
      message.textContent = error;
    }
    target.scrollIntoView({behavior:'smooth',block:'center'});
  }, true);
  for (const field of [startField, endField]) field.addEventListener('input', changed);
  refresh.addEventListener('click', () => load(true));
  changed();
})();
