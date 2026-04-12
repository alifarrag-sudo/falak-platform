# Falak — Project Context

## What this is
Falak is a two-sided GCC influencer marketplace connecting brands, agencies,
and influencers across Saudi Arabia, Kuwait, UAE, and Qatar.

## This is NOT
PawMate (petcare-egypt/) — that is a completely separate project.
Do not reference, import from, or confuse with petcare-egypt/.

---

## Live URLs
- **Platform demo (frontend):** https://falakdemo.netlify.app
- **Investor access page:** deployed separately on Netlify (`falak-demo-access/`)
- **Backend API:** https://falak-platform.onrender.com (Render free tier)
- **Dev tunnel (Cloudflare):** https://spring-nissan-limited-headers.trycloudflare.com (ephemeral)

---

## Tech stack

### Backend (`backend/`)
- **Runtime:** Node.js + TypeScript (ts-node, CommonJS)
- **Framework:** Express.js
- **Database:** SQLite via Node.js built-in `node:sqlite` (DatabaseSync) — single file at `data/influencers.db`, WAL mode, UTF-8
- **Auth:** JWT (jsonwebtoken) + bcryptjs — roles: `platform_admin`, `agency`, `brand`, `talent_manager`, `influencer`, `public`
- **Payments:** Stripe (subscriptions for agencies + escrow for offer payouts)
- **AI / LLM:** OpenAI API (`gpt-4o-mini`) — used in agent routes (match, outreach writer, briefings); stubs gracefully when `OPENAI_API_KEY` is unset
- **Audience intelligence:** Phyllo API — connects creator social accounts, fetches audience demographics, credibility, content performance; stubs with demo data when unconfigured
- **Email:** Nodemailer (SMTP-agnostic — SendGrid / Mailgun / Gmail)
- **PDF generation:** pdfmake
- **File uploads:** multer + express-fileupload
- **Rate limiting:** express-rate-limit
- **Key packages:** fuse.js (fuzzy search), cheerio (scraping), sharp (image), xlsx (import/export), node-cron, archiver

### Frontend (`frontend/`)
- **Framework:** React 18 + TypeScript
- **Build tool:** Vite 5
- **Routing:** React Router v6
- **State / data fetching:** TanStack Query v5
- **UI primitives:** Radix UI (Dialog, Dropdown, Popover, Select, Slider, Switch, Tooltip)
- **Styling:** Tailwind CSS + clsx
- **Icons:** Lucide React
- **Tables:** TanStack Table v8
- **Charts:** Recharts
- **Drag & drop:** @dnd-kit
- **Forms / dates:** react-hook-form, date-fns
- **Notifications:** react-hot-toast
- **Deployment:** Netlify (drag `dist/` — `_redirects` proxies `/api/*` to Render backend)

### Mobile (`mobile/`)
- **Framework:** React Native 0.83.2 + Expo SDK 55
- **Router:** Expo Router v4
- **Data fetching:** TanStack Query v5
- **Storage:** expo-secure-store, AsyncStorage
- **Push notifications:** expo-notifications
- **Image picker:** expo-image-picker
- **HTTP:** axios

---

## Database schema (SQLite)
63 tables including:

| Domain | Tables |
|--------|--------|
| Core entities | `influencers`, `users`, `agencies`, `brands` |
| Campaign management | `campaigns`, `campaign_influencers`, `campaign_notes`, `campaign_messages`, `content_calendar`, `deliverables`, `post_metrics` |
| Offers & deals | `portal_offers`, `portal_deliverables`, `offer_messages`, `offer_ratings`, `offer_templates` |
| Proposals | `proposals`, `proposal_influencers`, `proposal_comments` |
| Payments & revenue | `escrow_transactions`, `commissions` |
| Fan/creator economy | `fan_services`, `fan_bookings`, `fan_ratings`, `fan_users`, `fan_requests` |
| Loyalty | `loyalty_points` |
| Influencer portal | `portal_users` |
| Talent management | `talent_manager_relationships` |
| Store | `store_products`, `store_orders` |
| Academy | `academy_courses`, `academy_enrollments`, `academy_certifications` |
| Audience intelligence (Phyllo) | `phyllo_users`, `audience_demographics`, `audience_quality`, `audience_interests`, `content_performance`, `sentiment_analysis` |
| AI Agent | `agent_briefings` |
| Outreach | `outreach_log`, `shadow_profiles` |
| Ad network / fraud | `custom_audiences`, `audience_members`, `fraud_alerts` |
| Misc | `edit_log`, `settings`, `notifications`, `social_accounts`, `platform_stats`, `influencer_posts`, `trust_scores`, `direct_requests`, `direct_request_messages`, `brand_collaborations`, `studio_tool_usage`, `trending_topics`, `profile_views`, `shortlists`, `shortlist_influencers`, `creator_presets`, `import_sessions` |

---

## User roles
| Role | Access |
|------|--------|
| `platform_admin` | Full admin dashboard — users, agencies, brands, analytics, revenue, integrations |
| `agency` | Full agency dashboard — influencers, campaigns, pipeline, calendar, offers, deals, payments, outreach, AI agent |
| `brand` | Brand portal — discover, requests, campaigns |
| `talent_manager` | Manager portal — roster, offers, earnings |
| `influencer` | Influencer portal — dashboard, offers, profile, connections, fan requests, loyalty |
| `public` / fan | Fan access — discover creators, book fan services, delivery |

---

## API routes (backend/src/routes/)
`adnetwork` · `agencies` · `agent` · `analytics` · `auth` · `billing` · `brands` · `campaigns` · `discover` · `enrichment` · `fan` · `import` · `influencers` · `intelligence` · `loyalty` · `messages` · `notifications` · `oauth` · `offerTemplates` · `offers` · `outreach` · `payments` · `pdf` · `portal` · `ratings` · `revenue` · `settings`

---

## Frontend pages
- **Agency dashboard:** Dashboard, Influencers, InfluencerDetail, InfluencerMediaKit, Campaigns, CampaignDetail, CampaignKanban (Pipeline), CampaignCalendar, CampaignReport, DealTracker, Offers, Payments, Revenue, Billing, Discover, Outreach, AgentPage (AI), Deduplicate, Settings
- **Admin:** AdminDashboard, AdminAnalytics, AdminUsers, AdminAgencies, AdminBrands, AdminIntegrations, RevenuePage
- **Brand portal:** BrandDashboard, BrandInfluencers, BrandCampaigns, BrandRequests
- **Manager portal:** ManagerDashboard, ManagerEarnings
- **Influencer portal:** PortalDashboard, PortalOffers, PortalProfile, PortalConnections, PortalFanRequests, PortalLoyalty
- **Fan access:** FanDiscover, FanInfluencer, FanRequests, FanDelivery, FanProfile
- **Public:** PublicProfile (`/p/:id`), PublicCreators (`/creators`)
- **Auth:** Login, Register (multi-role), ForgotPassword, ResetPassword

---

## The three founding promises of Falak
1. **Instant payment on content delivery** — escrow model (`escrow_transactions` table, Stripe integration)
2. **Built-in regulatory compliance per GCC market** — Mawthouq certificate tracking (`mawthouq_certificate`, `mawthouq_link` per influencer), verified status field, filterable in discovery
3. **Multi-currency payouts** — currency field on all financial tables; currently defaults to SAR; KWD, AED, QAR are planned (schema supports it, conversion logic not yet built)

---

## Revenue streams — built vs planned

| Stream | Status |
|--------|--------|
| Agency SaaS subscriptions (Starter / Pro / Enterprise via Stripe) | Built — billing routes + Stripe Checkout/Portal |
| Platform commission on offer transactions (configurable %, default 10%) | Built — commissions table + revenue dashboard |
| Escrow fee on payouts | Built (schema + transactions); Stripe payout flow partial |
| Fan service bookings (influencer-to-fan paid interactions) | Built in schema + portal; payment flow partial |
| Creator store / digital products | Schema built (`store_products`, `store_orders`); UI not yet wired |
| Academy / courses | Schema built; UI not yet built |
| Ad network / audience retargeting (custom audiences for Meta/Google) | Backend built (`adnetwork` routes); frontend not yet built |
| Brand direct-request marketplace | Schema + backend built; brand UI partial |

---

## AI features (OpenAI `gpt-4o-mini`)
- **AI Match** — scores and ranks influencers against a campaign brief
- **Outreach Writer** — generates personalised DM/email copy per influencer
- **Campaign Briefings** — auto-generates a PDF-ready campaign brief from campaign data
- All three stub gracefully (return demo data) when `OPENAI_API_KEY` is not set
- Phyllo integration provides real audience data to feed into AI scoring

---

## Current build status (as of 2026-04-12)
- **Frontend build:** ✅ Passes `tsc && vite build` — 1,269 kB JS bundle (gzip ~324 kB)
- **Backend:** TypeScript compiles; runs via ts-node in dev, node dist/ in prod
- **Mobile:** Expo SDK 55 / RN 0.83 — not yet built for production APK
- **Stripe:** Keys not configured in prod `.env` — billing routes return 503 until set
- **OpenAI:** Key not configured — AI Agent page returns demo/stub responses
- **Phyllo:** Not configured — Intelligence page returns demo data
- **Email (SMTP):** Not configured — email notifications silently skipped
- **OAuth (Instagram/TikTok/Snap/YouTube/Twitter):** App IDs in `.env` but secrets not set

---

## Environment variables required for full functionality
| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Auth token signing |
| `TOKEN_ENCRYPTION_KEY` | Token encryption |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` | Billing |
| `OPENAI_API_KEY` | AI Agent features |
| `PHYLLO_CLIENT_ID` / `PHYLLO_CLIENT_SECRET` | Audience intelligence |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email notifications |
| `INSTAGRAM_APP_ID` / etc. | Social OAuth |
| `RAPIDAPI_KEY` | Public follower count fallback scraper |

---

## Do not touch
- `petcare-egypt/` directory — completely separate project (PawMate Egypt pet care marketplace)
- Any files outside `influencer-dashboard/`
