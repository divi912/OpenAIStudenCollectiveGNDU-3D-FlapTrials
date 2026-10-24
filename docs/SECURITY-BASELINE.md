# Multiplayer beta hardening

Scope: protect room admission and established races without accounts, captchas or persistent player tracking. Add readable live capacity to the existing landing page. Keep the same-domain Cloudflare gateway.

The audit found that Colyseus routes matchmaking before Express, bypassing the original Express-only rate limiter. Colyseus already defaults to a 4 KB inbound WebSocket frame limit; make that explicit and add a room message-rate ceiling. Preserve authoritative movement, ordered checkpoints, identical hitboxes and host-only race/map actions.

Implementation:

1. Add bounded server-side request accounting before Colyseus handles HTTP, plus origin/method/body-size checks and a WebSocket handshake guard. Use socket identity for backend fallback limits rather than trusting spoofable forwarding headers.
2. Use Cloudflare's native per-IP rate-limit bindings for the public gateway, with separate budgets for creation, joins/lookups, upgrades and health checks. These edge counters are approximate and local to Cloudflare locations; the authoritative room cap remains strict.
3. Validate room options before admission, ignore malformed/stale actions, disconnect message floods and expire abandoned lobbies. Retain generous headroom for 60 Hz input and shared networks.
4. Show occupied/maximum rooms, room slots available, racers, public join seats and full/offline states on the landing page. Refresh only on the visible landing page, at most once per minute automatically; manual refresh is throttled.
5. Verify real HTTP throttling, malformed inputs and normal multiplayer, then deploy and check the live gateway and capacity panel.

This is a small public-beta baseline, not a guarantee against distributed attacks. No account-based identity or global distributed quota is introduced. Render can sleep/restart and discard rooms; configured capacity is an admission cap, not a hardware performance promise. Production must set `CLIENT_ORIGIN` to the public game origin.

## Implemented defaults

| Protection | Default |
| --- | --- |
| Edge creation / quick-play requests | 12 per minute per client IP |
| Edge API / code lookups | 120 per minute per client IP |
| Edge WebSocket upgrades | 240 per minute per client IP |
| Edge health requests | 600 per minute per client IP |
| Backend API fallback | 600 per minute per socket peer |
| Backend creation fallback | 60 per minute per socket peer |
| Backend upgrade fallback | 240 per minute per socket peer |
| Backend health fallback | 1,200 per minute per socket peer |
| Matchmaking JSON body | 8 KB, including streamed/chunked bodies |
| Client WebSocket frame | 4 KB; compression disabled |
| Client messages | 180 per second; normal flight is about 60 |
| Inactive lobby expiry | 10 minutes |
| Authoritative room / racer cap | `MAX_ROOMS` (default 10) × 8 racers |

HTTP denials include `Retry-After` for throttling. Backend tracking is bounded to 10,000 keys, with expired entries removed. Browser-provided forwarding IP headers are not trusted by backend counters; edge counters use Cloudflare's supplied client IP. This deliberately uses generous backend limits because several players may share a proxy/NAT. Edge IP quotas can still affect large shared networks; monitor 429 rates and tune bindings in `wrangler.jsonc` if needed.

`HTTP_REQUESTS_PER_MINUTE`, `HEALTH_REQUESTS_PER_MINUTE` and `MAX_ROOMS` are validated at server startup. Browser origin enforcement follows `CLIENT_ORIGIN`; missing origins are permitted for non-browser clients, so this is not authentication. The direct Render service remains reachable, protected by its own fallback limits and authoritative capacity cap. Preventing anonymous bots from occupying legitimate room slots would require stronger identity/human verification if abuse becomes a problem.

Cloudflare documents that its native counters are [approximate and local to each location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). The [Colyseus message ceiling](https://docs.colyseus.io/room) is enforced before handling incoming messages. Do not describe either as a universal denial-of-service guarantee.

## Regression coverage

Real server tests verify that matchmaking is limited before Express, spoofed IP headers do not reset the socket-peer budget, invalid protocol options do not allocate rooms, foreign origins are rejected, chunked oversize bodies leave the server alive, and oversized WebSocket frames/message floods disconnect only offenders. Review also found and fixed a malformed `Host`/`X-Forwarded-Proto` shutdown path and Express case/trailing-slash aliases bypassing guards; regression requests now return 400/403/429 while the service remains responsive.

Browser coverage checks live count presentation, full/offline states, code joins at capacity, manual refresh throttling and phone layout, along with normal two-browser racing and cold-start cancellation. Production dependency audit reported no known vulnerabilities for the installed lockfile at this checkpoint.
