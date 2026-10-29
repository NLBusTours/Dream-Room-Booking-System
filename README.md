# The Dream Room booking inquiry form

Mobile-friendly customer-facing booking request page for The Dream Room, Paradise, NL. Adapted from the structure and Web3Forms workflow used by NL Bus Tours and Dream Parties NL.

## Features

- Five pathways: private events, children's parties, weddings, workshops/public events, and Dream Host proposals.
- Captures contact details, optional alternate date, and total guest count (maximum 60).
- For Sunday baby and bridal showers, offers a Sunday-only three-hour special at 10 AM–1 PM or 2 PM–5 PM. The special does not include evening hours or other days/event types. Other standard rentals may request flexible access hours.
- For children's parties, offers 10 AM–12 PM, 11 AM–1 PM, or 2 PM–4 PM as fixed two-hour slots, with no custom time selection. The form does not offer 12–2.
- Sends selected start/end hours and a readable time-slot label in the booking inquiry.
- Adds relevant event-specific questions, wedding ceremony seating guidance (32), and optional service requests.
- Keeps prices off the customer-facing form. Staff can quote after checking availability.
- Prevents past dates using Newfoundland-local browser date, validates required fields and length of booking.
- Submits to Web3Forms using the access key already present in the existing Dream Room GitHub repository.
- Includes a matching thank-you page. No framework or build tooling required.

## Deploy to the existing GitHub Pages repository

1. Review `index.html` and `thank-you.html` before publishing.
2. Replace the same-named files in `NLBusTours/Dream-Room-Booking-System` on the `main` branch (or open a pull request for review).
3. In GitHub Settings > Pages, verify it serves from `main` / root.
4. Open `https://nlbustours.github.io/Dream-Room-Booking-System/` and test all five event types.
5. Send a test submission and **confirm the request reaches the correct booking inbox**. The existing Web3Forms key has been retained but not independently verified by this deliverable.

## Notes

- The form is an inquiry only, not a calendar-based availability check or paid booking checkout.
- No private availability or payment integrations are used.
- The user can request a private venue viewing by contacting the team; the public form does not quote any fees.
- Do not put secret credentials or private customer data into this public repository. Web3Forms access keys are intended for client-side forms.