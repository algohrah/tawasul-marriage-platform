# Isolated journey/fee preview

This PR is a review prototype, not a production payment implementation.

- Same five journey stations for registered, matchmaker, administration-imported and other imported profiles.
- Enter a cumulative paid total per party between SAR 0 and 2,500 (up to two decimal places). Remaining = 2,500 - paid.
- SAR 500 remains the normal start-service threshold. Explicit administration deferral is separate from payment.
- Full payment does not imply acceptance, mahr delivery or marriage.
- Notes and changes live only in JavaScript memory. Reload resets them. No API/database/browser-storage writes or real WhatsApp messages.
- Admin/member/moderator controls are simulations, not a replacement for server authorization.
- The preview uses native static files, bypassing application bootstrap and real members/authentication entirely.
- Existing gateway, application routes, financial history, subscriptions and Supabase schema/data are unchanged.

## Preview URLs

- GitHub Pages: https://algohrah.github.io/tawasul-marriage-platform/previews/journey-fees/
- Netlify (if hosting is available): /preview/journey/ on this PR's Deploy Preview.

The isolated workflow publishes only to `previews/journey-fees` on the existing `gh-pages` branch, preserving the Pages root. It never pushes to main. The existing main Pages workflow can later replace the gh-pages contents; this preview is temporary.

## Decisions needed before real integration

- Approval of layout and journey text.
- Treatment of deferred start fees if no match occurs, refund policy and definition of mahr delivery.
- Verified once-per-person starting-fee ledger, linking imported profiles without duplicate identity or credit.
- Server-side financial permissions, actual evidence-based payment approval, atomic recording, correction history and idempotency.
- Any necessary new schema requires separate owner approval. No migration included.
