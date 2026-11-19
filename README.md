# Halcyon Studio — photography website

A premium, motion-led five-page website for a photography studio. It's a static site with no framework and no server, so it can be hosted anywhere.

| Page | File | Highlights |
| --- | --- | --- |
| Home | `index.html` | Preloader, cinematic hero slideshow, scroll-scrubbed statement, pinned zoom-to-fullscreen, horizontal story scroller, hover-preview service list, counters, velocity marquee, testimonial slider |
| Work | `work.html` | Featured story, 58-image portfolio with animated (FLIP) category filters, full-screen lightbox with keyboard and swipe |
| Services | `services.html` | Four service stories, "included" grid, tabbed pricing (Weddings / Portraits / Brand), stacked sticky process cards, FAQ accordion |
| Studio | `about.html` | Parallax collage, founder story, values, team, stats, awards list |
| Contact | `contact.html` | Four-step booking form with validation, availability calendar, prefill from pricing buttons, success state |

Conversion features: a "Check your date" call to action in the header, on every page and as a sticky bar on mobile; availability scarcity; reviews and ratings; "most booked" packages; pricing buttons that prefill the enquiry form (`contact.html?type=wedding&package=Signature`); objection-handling FAQs; and a "reply within 24 hours" promise.

Motion: GSAP (ScrollTrigger, SplitText, Flip, CustomEase) with Lenis smooth scrolling, page-transition curtains, a custom cursor and magnetic buttons. Everything respects `prefers-reduced-motion`, and all content stays visible if JavaScript fails.

## Editing

Pages are written in `src/` and compiled into the HTML files at the repo root.

```bash
python3 build.py
```

- `src/pages/*.html` holds the page content.
- `src/partials/` holds the shared head, header, menu, call-to-action band, footer and scripts.
- `{{img name|alt text|sizes}}` outputs a responsive `<img>` for `assets/img/name.webp` and `name-sm.webp`.

**Always edit the files in `src/`, then run the build.** Changes made directly to the root HTML files are overwritten by the next build.

Other files:

- Styles: `assets/css/main.css` (design tokens at the top)
- Motion: `assets/js/main.js`

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Deploy

Upload the repository as-is to GitHub Pages, Netlify, Vercel or Cloudflare Pages. There's no build step on the host; just commit the built HTML.

## Before going live

1. **Enquiry form:** set `data-endpoint` on the `<form>` in `src/pages/contact.html` to a form service such as Formspree, Basin or Netlify Forms, then rebuild. Until then, submissions only show the success screen and nothing is sent.
2. **Placeholder content:** the studio name, people, testimonials, awards, publications, prices, availability, address, phone and email are all sample copy. Replace them with real details.
3. **Photos:** the sample images are from Unsplash, under the Unsplash License. Replace them with your own work in `assets/img/`, keeping the `name.webp` (1600px) and `name-sm.webp` (800px) pair.
4. **Social links** in `src/partials/footer.html` currently point to `#`.

## Credits

- [GSAP](https://gsap.com): standard "no charge" license.
- [Lenis](https://github.com/darkroomengineering/lenis): MIT.
- Fonts: Instrument Serif and Inter Tight, both SIL Open Font License, self-hosted.
