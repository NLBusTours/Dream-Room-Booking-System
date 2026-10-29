# The Dream Room booking inquiry form

Mobile-friendly customer-facing booking request page for The Dream Room, Paradise, NL. Adapted from the structure and Web3Forms workflow used by NL Bus Tours and Dream Parties NL.

## Features

- Six pathways: private events, baby/bridal showers, children's parties, weddings, workshops/public events, and Dream Host proposals.
- Captures contact details, optional alternate date, and total guest count (maximum 60).
- For Sunday baby and bridal showers, offers a Sunday-only three-hour special at 10 AM–1 PM or 2 PM–5 PM. The special does not include evening hours or other days/event types. Other standard rentals may request flexible access hours.
- For children's parties, offers 10 AM–12 PM, 11 AM–1 PM, or 2 PM–4 PM as fixed two-hour slots, with no custom time selection. The form does not offer 12–2.
- Sends selected start/end hours and a readable time-slot label in the booking inquiry.
- Adds event-specific questions, wedding ceremony seating guidance (32), and optional service requests.
- Offers three wedding rental choices: DIY venue-only at $150/hour; 4-hour Styled & Staffed at $800; and 8-hour Styled & Staffed at $1,400, all before HST.
- The Styled & Staffed options include staff, setup, teardown, cleanup, rectangular table/chair arrangement, linens, chair covers, aisle carpet/pillars, and wedding centrepieces. Included services are disabled in the paid add-on selector so they are never charged again.
- Wedding package length must match the requested start and end time before a price estimate or booking inquiry is accepted.
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
- The user can request a private venue viewing by contacting the team; the public form does not collect a private viewing fee.
- Do not put secret credentials or private customer data into this public repository. Web3Forms access keys are intended for client-side forms.
## Pricing and booking policy

- Standard venue rental: $150/hour, before 15% HST.
- Three-hour shower special: $350 only for Saturday/Sunday baby or bridal showers, 10 AM–1 PM or 2 PM–5 PM; no evening promotion. Other requested times remain standard hourly rentals.
- Children’s parties: prefer 10 AM–12 PM, 11 AM–1 PM or 2 PM–4 PM; other two-hour times can be requested but require approval.
- Add-ons: table/chair setup/takedown $75; event staff $25/hour; cleanup $50–$100; linens $25; chair covers $25; extra décor from $25; cocktail tables $20 each. Photography/characters and catering quoted separately.
- For Styled & Staffed weddings, base add-ons already covered by the package are suppressed. Cocktail tables and extra custom décor still calculate separately; catering and entertainment remain custom quotes.
- Estimated totals include 15% HST, but are not binding quotes, paid reservations or guaranteed availability.
- GoDaddy embed mode is `?embed=1`; update existing GoDaddy HTML section height to allow room for the quote calculator.


## Décor photography and mobile previews

- Venue images were supplied directly by the business and published in `assets/real-dream-room-decor.webp` (a lightweight, four-photo composite).
- The four labelled preview images are: aisle runner and ceremony décor; high-rise cocktail tables; wedding centrepieces; and table linens/chair covers.
- The wedding section now has a labelled, swipeable four-image preview strip. Linen, chair-cover, extra décor and cocktail-table add-ons use their corresponding photo tile instead of unrelated GoDaddy gallery images.
- Desktop users can hover for a magnified preview, while mobile users can tap to enlarge and navigate photographs in a dialog. The images show example setups, not guarantees of a specific layout.
- The aisle runner image also shows ceremony décor. The centrepiece image includes an example floral backdrop. Champagne and floral feature wall preview is now included, using the photo already present in the business's GoDaddy-hosted venue gallery (`1000034727.jpg`). The gallery has five photos; the champagne/floral wall image is explicitly labelled as included with the rental.
- The composite is deliberately web-compressed for fast mobile loading. The original high-resolution photographs should be kept by the owner for future marketing and larger gallery use.
- No image prices or new optional services were introduced. Wedding package inclusions and the estimate calculation are unchanged.

### Champagne wall & floral feature wall
- The wedding gallery includes a dedicated photo of both the pink floral wall and the adjacent champagne display.
- These are included venue features, **not separately priced add-ons**.
- This fifth gallery photo is sourced from the venue's existing GoDaddy media CDN. The existing four-photo composite is unchanged. On mobile, tapping the fifth photo opens the complete portrait image rather than a cropped thumbnail.

## Read-only booking availability checker

- The customer form now checks selected times against a **sanitized** snapshot of Dream Room's **DR - BAND** calendar. Customers only see 'Open to request', 'Booked', or 'Not verified'. Open is not a booking confirmation.
- A twice-hourly GitHub Actions workflow reads the private BAND iCal subscription using the `DREAM_ROOM_BAND_ICAL_URL` Actions secret. No private subscription token, customer names or event metadata enter the public website.
- The checker fails closed whenever the snapshot is missing, malformed, or more than 2 hours old. Booking inquiries continue to work even while the connection is not configured.
- **Required one-time setup:** follow [availability/SETUP.md](availability/SETUP.md), add the secret via GitHub Settings, and manually run the workflow once. The connector cannot set this secret on the owner's behalf.
- This does not automatically reserve the venue or create/update any events.
