# The Dream Room booking inquiry form

Mobile-friendly customer-facing booking request page for The Dream Room, Paradise, NL. Adapted from the structure and Web3Forms workflow used by NL Bus Tours and Dream Parties NL.

## Features

- Six pathways: private events, baby/bridal showers, children's parties, weddings, workshops/public events, and Dream Host proposals.
- Captures contact details, optional alternate date, and total guest count (maximum 60).
- For Sunday baby and bridal showers, offers a Sunday-only three-hour special at 10 AM–1 PM or 2 PM–5 PM. The special does not include evening hours or other days/event types. Other standard rentals may request flexible access hours.
- For children's parties, offers 10 AM–12 PM, 11 AM–1 PM, or 2 PM–4 PM as fixed two-hour slots, with no custom time selection. The form does not offer 12–2.
- Sends selected start/end hours and a readable time-slot label in the booking inquiry.
- Adds relevant event-specific questions, wedding ceremony seating guidance (32), and optional service requests.
- Shows standard rental pricing ($150/hour), the $350 three-hour shower special for Saturday/Sunday baby and bridal showers (10 AM–1 PM or 2 PM–5 PM), and price-labelled add-ons.
- Calculates a preliminary subtotal, HST (15%), and estimated total as customers select dates, times and add-ons. Cleanup is estimated at $50–$100; custom décor from $25 and photography/character entertainment require final quotes.
- Keeps schedule and service questions hidden until the event type is selected, and avoids the redundant occasion dropdown.
- Prevents past dates using Newfoundland-local browser date, validates required fields and length of booking.
- Submits to Web3Forms using the access key already present in the existing Dream Room GitHub repository.
- Includes a matching thank-you page. No framework or build tooling required.

## Deploy to the existing GitHub Pages repository

1. Review `index.html` and `thank-you.html` before publishing.
2. Replace the same-named files in `NLBusTours/Dream-Room-Booking-System` on the `main` branch (or open a pull request for review).
3. In GitHub Settings > Pages, verify it serves from `main` / root.
4. Open `https://nlbustours.github.io/Dream-Room-Booking-System/` and test all six event types.
5. Send a test submission and **confirm the request reaches the correct booking inbox**. The existing Web3Forms key has been retained but not independently verified by this deliverable.

## Notes

- The form is an inquiry only, not a calendar-based availability check or paid booking checkout.
- No private availability or payment integrations are used.
- The user can request a private venue viewing by contacting the team; the public form does not quote any fees.
- Do not put secret credentials or private customer data into this public repository. Web3Forms access keys are intended for client-side forms.
## Pricing and booking policy

- Standard venue rental: $150/hour, before 15% HST.
- Three-hour shower special: $350 only for Saturday/Sunday baby or bridal showers, 10 AM–1 PM or 2 PM–5 PM; no evening promotion. Other requested times remain standard hourly rentals.
- Children’s parties: prefer 10 AM–12 PM, 11 AM–1 PM or 2 PM–4 PM; other two-hour times can be requested but require approval.
- Add-ons: table/chair setup/takedown $75; event staff $25/hour; cleanup $50–$100; linens $25; chair covers $25; extra décor from $25; cocktail tables $20 each. Photography/characters quoted separately.
- Estimated totals include 15% HST, but are not binding quotes, paid reservations or guaranteed availability.
- GoDaddy embed mode is `?embed=1`; update existing GoDaddy HTML section height to allow room for the quote calculator.
