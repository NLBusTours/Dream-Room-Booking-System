# The Dream Room availability checker

The booking form shows a **read-only, provisional** availability check using the separate `DR - BAND` calendar. All bookings still require staff confirmation. No customer names, event titles, calendar tokens, or details are shown publicly.

## Connect the existing BAND calendar (one-time setup)

**IMPORTANT:** Do not paste your BAND calendar URL or access token into a website HTML embed, a public GitHub file, a social post, or a chat. It grants calendar access.

1. In BAND, find the Dream Room band's **calendar export / subscribe by URL** option. Copy the existing private subscription URL for **DR - BAND** (usually `webcal://api.band.us/ical?token=...`).
2. Open the GitHub repository's [Actions secrets page](https://github.com/NLBusTours/Dream-Room-Booking-System/settings/secrets/actions).
3. Select **New repository secret**.
4. Name: `DREAM_ROOM_BAND_ICAL_URL`
5. Value: paste your full BAND subscription URL unchanged. Choose **Add secret**.
6. Open [Dream Room availability sync](https://github.com/NLBusTours/Dream-Room-Booking-System/actions/workflows/sync-availability.yml), choose **Run workflow**, select `main`, and run it.
7. Check that the workflow completed successfully. Then open [the anonymous availability status issue](https://github.com/NLBusTours/Dream-Room-Booking-System/issues/11). The issue will be updated with fresh, sanitized data after a successful run.
8. Open the [live embedded booking form](https://nlbustours.github.io/Dream-Room-Booking-System/?embed=1). Select an event type, date and time. The checker should display slots as **Open to request** or **Booked**, and a snapshot time.

**No changes to the GoDaddy embed snippet are required.** GitHub Pages serves the form from `main`. The checker reads its anonymous availability status directly from a public GitHub issue, so there is no need to redeploy GitHub Pages or make a new Git commit for each refresh.

## How it updates

The workflow checks the private BAND subscription **twice hourly**, normally around minutes 7 and 37. GitHub schedules are best-effort and may occasionally run late. It updates **one public GitHub issue** without adding dozens of commits to the site's history.

Only sanitized occupied-minute intervals, dates and a generation timestamp are written into the machine-readable portion of [issue #11](https://github.com/NLBusTours/Dream-Room-Booking-System/issues/11). Bookings with titles, descriptions, phone numbers and customer details are **never written to that file**. The source URL remains a private GitHub Actions repository secret.

If the calendar is inaccessible, data is missing, or a snapshot is over **2 hours old**, the website displays **Not verified** and invites customers to send an inquiry rather than guessing that the venue is free.

Calendar changes are **not instant**. Even after a fresh sync, an event might be newly booked or pending in BAND. **Open to request** does not guarantee the venue can be booked.

BAND events that are transparent or cancelled do not block time; other active events, including tentative entries and all-day events, do. Repeating events are expanded across the next 400 days. Times are converted to `America/St_Johns`, including daylight-saving transitions.

## Verify with real bookings

Before relying on the checker, compare several upcoming DR - BAND events with the form. In particular, test:
- A fully booked morning and a free afternoon
- Overlapping 10 AM–12 PM and 11 AM–1 PM requests
- A Saturday/Sunday shower slot (10 AM–1 PM, 2 PM–5 PM)
- A private rental/wedding with custom times
- Adjacent events, all-day blocks, and special time requests

All events in the Dream Room calendar are treated as venue-occupying. Keep non-booking notes on another calendar or mark genuinely free events as transparent if BAND supports it.

**Privacy note:** Public visitors can infer which time windows are occupied, but cannot access booking names, customer contacts, event descriptions, or the private subscription URL.

## Troubleshooting

- **Not verified:** Check workflow history, GitHub secret setup, and the snapshot's `generated_at` value.
- **Wrong calendar:** Update the `DREAM_ROOM_BAND_ICAL_URL` secret to the Dream Room feed, not the Dream Parties NL feed.
- **Issue #11 still displays the initial placeholder:** Run the workflow manually; if it fails, inspect the job steps without sharing a token.
- **Calendar missing a booking:** Confirm that the booking is actually on **DR - BAND**, then refresh the workflow.
- **Invalid/empty feed:** The workflow fails closed and will not overwrite the last valid snapshot with a blank calendar.
- **No API calls to BAND from customer browsers:** The public UI only reads the sanitized status issue via GitHub's public API (which may have ordinary anonymous request-rate limits).

There is no payment, automatic reservation, hold, or customer event creation in this feature.
