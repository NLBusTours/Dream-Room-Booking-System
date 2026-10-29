# Embed the Dream Room form into GoDaddy

This site also has a compact embed mode, intended for a GoDaddy **Websites + Marketing** custom HTML section.

## Copy-and-paste snippet

```html
<iframe
  src="https://nlbustours.github.io/Dream-Room-Booking-System/?embed=1"
  title="The Dream Room booking inquiry form"
  loading="lazy"
  style="display:block;width:100%;height:3500px;border:0;background:transparent;"
></iframe>
```

## Add it to your GoDaddy website

1. In GoDaddy, open **Websites + Marketing > Manage > Edit Website**.
2. Open the page where the form should appear (for example, **Book The Dream Room**).
3. Choose **Add Section > HTML** (sometimes found under **Files & Web**).
4. Paste the HTML snippet above in **Custom Code**.
5. Set **Forced Height** to **3550 px** to start. On a narrow phone or when optional fields expand, you may need to increase this further. The embedded form scrolls within the iframe if necessary.
6. Preview, **Publish**, and test on an actual phone and desktop browser. The added pricing calculator can increase page height. GoDaddy may display custom HTML differently in its editor and on the published site.

The embedded version hides the standalone GitHub site's masthead, information sidebar and footer to avoid doubling the GoDaddy page's navigation and branding.

## Important details

- This is an **inquiry form**, not a confirmed reservation or a live availability checker.
- The form uses the same Web3Forms endpoint and thank-you page as the full website. Confirm a **test inquiry arrives in your intended inbox**.
- The public site URL is https://nlbustours.github.io/Dream-Room-Booking-System/ if you'd rather link directly instead of embedding.
- GoDaddy Websites + Marketing renders custom HTML inside its own iframe. A nested iframe may require a larger Forced Height or may be blocked by the site's settings. If it doesn't work on the published site, use a button linking to the full booking form rather than an iframe.
- Never include a private BAND calendar subscription URL or other credentials in this public repository or the GoDaddy HTML snippet.
