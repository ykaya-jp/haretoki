# VenueLens — Design Specification

## Overview

Wedding venue comparison tool that guides couples through the entire venue selection process — from initial research to final decision. The core value proposition: **make it effortless for brides to compare what matters most, with AI-powered analysis**.

### Target Users

- **Primary**: Couples planning their wedding (initially the product owner and partner)
- **Quality bar**: BtoC-ready — designed for public release from day one

### Core Principle

Every feature serves one goal: **reduce the cognitive load of comparing wedding venues across the dimensions brides care about most**.

---

## User Flow — 6-Step Guided Process

The app maps directly to the recommended venue selection workflow in Japan. Steps are non-linear — users can skip ahead or return to any step at any time.

| Step | Screen | Purpose | Available From |
|------|--------|---------|---------------|
| 1 | Conditions Setup | Align on area, date, guest count, budget, ceremony style | Phase 1 |
| 2 | Venue Explorer | Add venues via URL paste (auto-extraction) or manual entry | Phase 1 |
| 3 | Visit Manager | Checklist, schedule, quick memo/photo/rating at the venue | Phase 3 |
| 4 | Comparison Board | Side-by-side multi-axis comparison with AI analysis | Phase 1 (basic), Phase 2 (AI) |
| 5 | Shortlist & Re-evaluation | Narrow to 2-3 finalists, manage re-visits and revised estimates | Phase 1 |
| 6 | Final Decision | Record decision rationale for future reference | Phase 1 |

A progress bar is always visible, showing which step the couple is on.

**Onboarding**: All condition fields in Step 1 are optional with "skip for now" option. Users can jump directly to "Add a venue" to start exploring immediately. Conditions can be set or refined at any time.

---

## Bride's Key Comparison Dimensions

These are the primary axes the comparison engine optimizes for. Derived from research on Japanese wedding venue selection (interview patterns, review site analysis, common regret factors).

### Tier 1 — Decision Drivers (always visible in comparison views)

| Dimension | Data Sources | Why It Matters |
|-----------|-------------|----------------|
| **Atmosphere / Ambiance** | Photos, review keywords, visit notes | #1 factor in bride satisfaction surveys |
| **Hospitality** | Review scores, visit notes, planner impression | Strongly correlates with overall satisfaction |
| **Cuisine** | Tasting notes, review scores, menu tier | Top regret factor when underweighted |
| **Cost Transparency** | Initial estimate, predicted final cost, line-item breakdown | Average +¥1,020,000 gap between initial and final estimates |
| **Reviews & Ratings** | Aggregated from Zexy, Wedding Park, Hanayume, Mynavi, Minna no Wedding | Multi-source aggregation provides balanced view |
| **Access / Location** | Station distance, shuttle, parking, barrier-free | Practical factor for guests, especially elderly/families |

### Tier 2 — Important Factors (expandable in comparison views)

| Dimension | Data Sources |
|-----------|-------------|
| **Dress / Attire** | Bring-in policy, partner shops, fitting notes |
| **Photo / Video** | Bring-in policy, recommended vendors, quality samples |
| **Flowers / Décor** | Included arrangements, upgrade cost, customization flexibility |
| **Staff Continuity** | Same planner from first visit to wedding day (frequent regret factor in reviews) |
| **Capacity / Flexibility** | Min/max guests, layout options, weather backup |
| **Cancellation Policy** | Fee schedule by months-before-wedding |

### Tier 3 — Situational (available on detail pages)

- Night/evening ambiance (often not seen at daytime fairs)
- Guest amenities (waiting rooms, nursing rooms)
- Ceremony style options (chapel, shrine, outdoor, civil)

**Radar chart uses 6 Tier 1 dimensions**: atmosphere, hospitality, cuisine, cost, access, reviews.

---

## Estimate Analysis — The +¥1M Problem

Research shows initial estimates are built at minimum tier. The average actual increase is +¥1,020,000. VenueLens makes this transparent — framed as **preparation, not alarm**.

### Tracked Estimate Line Items

| Category | Avg. Upgrade Rate | Typical Increase |
|----------|------------------|-----------------|
| Attire (dress, tuxedo) | 62% | +¥200,000 ~ ¥400,000 |
| Cuisine (course upgrade) | 65% | +¥150,000 ~ ¥300,000 |
| Photo / Video / Endroll | 50% | +¥200,000 ~ ¥350,000 |
| Flowers / Table décor | 45% | +¥100,000 ~ ¥250,000 |
| Performances / Effects | 40% | +¥50,000 ~ ¥150,000 |
| AV / Sound equipment | 30% | +¥30,000 ~ ¥80,000 |

### How It Works

1. User uploads estimate PDF or enters line items manually
2. Claude extracts and categorizes each line item
3. System compares against statistical upgrade rates
4. Displays waterfall chart: initial → predicted upgrades → predicted final cost
5. Highlights items most likely to increase, with specific warnings

### Presentation Tone

Estimate predictions are framed positively: "Your chosen conditions typically add ¥XXX — other couples adjust by similar amounts. Here's how to prepare." Avoid fear-inducing language. Focus on empowering informed negotiation.

---

## Partner Collaboration

### Rating Comparison

When both partners rate the same venue, the UI shows:
- Side-by-side star ratings per dimension
- **Highlighted disagreements** (difference >= 2 stars) with prompt to add a comment explaining why
- AI-generated summary of alignment ("You agree on atmosphere and hospitality, but differ on cuisine — worth discussing")

### Permission Model

| Action | Owner | Partner |
|--------|-------|---------|
| Add/edit venues | Yes | Yes |
| Add notes/ratings | Yes | Yes |
| Upload estimates | Yes | Yes |
| Delete venues | Yes | No |
| Delete project | Yes | No |
| Final decision | Yes (with partner agreement) | Can vote but not unilaterally decide |
| Invite partner | Yes | No |

---

## AI Features (Claude API)

All AI features use Claude API via Anthropic SDK. API key stored as `ANTHROPIC_API_KEY` environment variable. Called exclusively from Next.js Server Actions (never client-side). Personal data sent to Claude is limited to venue-related content; PII (names, addresses) is stripped before API calls.

### 1. URL Content Extraction

- User pastes a venue URL (Zexy, Wedding Park, Hanayume, Mynavi, etc.)
- System fetches page content via server-side HTTP (BeautifulSoup for static pages)
- Claude extracts: venue name, location, capacity, style, base price, features
- Creates a structured venue card automatically
- **Fallback**: If site blocks automated access, user can paste page text manually

### 2. Review Analysis (AI Summary Only)

- User provides review source URLs
- Claude analyzes review content and generates **AI-authored summaries only**
- **No review text is stored** — only AI-generated summaries and sentiment scores are persisted
- Original reviews are linked via URL for user reference
- Calculates dimension-specific scores from review analysis

### 3. Estimate Intelligence

- PDF upload → Claude extracts line items and amounts (via PDF text extraction, not OCR)
- Compares against known upgrade patterns
- Predicts final cost range with confidence intervals
- Flags items that are suspiciously low (likely minimum tier)
- **PDF validation**: Max 10MB, MIME type check, sanitized before processing

### 4. Comparison Analysis

- Given 2-3 venues and the couple's conditions (budget, guest count, priorities)
- Generates natural-language comparison highlighting tradeoffs
- Recommends specific actions (e.g., "request revised estimate at standard tier")
- Displayed inline on comparison board, not in a separate chat

### 5. Visit Preparation

- Before a scheduled visit, generates personalized checklist
- Based on venue-specific concerns from reviews and the couple's priorities
- Suggests specific questions to ask the planner
- Limited to 5 key items for practicality (avoid "phone out the whole time" problem)

---

## Technical Architecture

### Stack

Aligned with existing CLAUDE.md project configuration.

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend + API** | Next.js 15 (App Router) + TypeScript | SSR, Server Actions, single repo |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first, design tokens, pre-built accessible components |
| **Database** | Supabase (PostgreSQL) | Auth + DB + Storage in one, generous free tier |
| **ORM** | Prisma | Type-safe queries, migrations, schema management |
| **Auth** | Supabase Auth | Email/password, magic link, Google OAuth |
| **File Storage** | Supabase Storage | Photos, PDFs, visit recordings |
| **AI** | Claude API (Anthropic SDK) | Max plan, called via Server Actions |
| **Data Collection** | Python (BeautifulSoup, pandas) | Static page parsing, data analysis scripts |
| **Charts** | Recharts | Radar chart + bar chart. Waterfall via custom BarChart with transparent stacks |
| **Animation** | framer-motion | Micro-interactions, page transitions |
| **Forms** | react-hook-form + zod | Validation, type-safe form handling |
| **Testing** | Vitest (unit) + Playwright (E2E) | Fast unit tests + browser-based E2E |
| **Deployment** | Vercel (Pro plan) | 60s function timeout for AI operations |
| **Realtime** | Supabase Realtime | Partner sync via postgres_changes channels |

**Note on Vercel constraints**: AI-heavy operations (review analysis, estimate extraction) that may exceed even 60s timeout are processed as background jobs via Supabase Edge Functions + pg_cron, with status polling from the client.

### Data Model (Prisma / PostgreSQL)

```
users
  id: uuid (PK)
  email: text
  name: text
  created_at: timestamptz
  updated_at: timestamptz

project_members (replaces direct owner_id/partner_id)
  id: uuid (PK)
  project_id: uuid → projects
  user_id: uuid → users
  role: enum (owner, partner)
  invited_at: timestamptz
  accepted_at: timestamptz (nullable — null means pending invitation)
  UNIQUE(project_id, user_id)

projects (one per couple)
  id: uuid (PK)
  name: text
  conditions: jsonb (area, date_range, guest_count, budget, style)
  current_step: int (1-6)
  created_at: timestamptz
  updated_at: timestamptz
  INDEX(created_at)

venues
  id: uuid (PK)
  project_id: uuid → projects
  name: text
  location: text
  access_info: text
  capacity_min: int
  capacity_max: int
  ceremony_styles: text[]
  source_urls: text[]
  status: enum (researching, visit_scheduled, visited, shortlisted, selected, rejected)
  created_at: timestamptz
  updated_at: timestamptz
  INDEX(project_id)

venue_scores
  id: uuid (PK)
  venue_id: uuid → venues
  dimension: enum (atmosphere, hospitality, cuisine, cost, access, reviews, dress, photo_video, flowers, staff_continuity, capacity, cancellation)
  score: decimal (1.0-5.0)
  source: enum (zexy, wedding_park, hanayume, mynavi, minna_no_wedding, user_rating, ai_analysis)
  review_count: int
  updated_at: timestamptz
  UNIQUE(venue_id, dimension, source)
  INDEX(venue_id)

reviews
  id: uuid (PK)
  venue_id: uuid → venues
  source: enum (zexy, wedding_park, hanayume, mynavi, minna_no_wedding)
  source_url: text
  rating: decimal
  ai_summary: text
  sentiment: jsonb (per-dimension sentiment scores)
  fetched_at: timestamptz
  INDEX(venue_id)
  -- NOTE: No review original text stored (copyright compliance)

estimates
  id: uuid (PK)
  venue_id: uuid → venues
  project_id: uuid → projects
  version: int (1 = initial, 2 = revised, etc.)
  total: int
  predicted_final: int
  source_type: enum (pdf_upload, manual, ai_extracted)
  pdf_url: text
  created_at: timestamptz
  updated_at: timestamptz
  INDEX(venue_id)
  INDEX(project_id)

estimate_items
  id: uuid (PK)
  estimate_id: uuid → estimates
  category: enum (attire, cuisine, photo_video, flowers, performance, av_equipment, venue_fee, other)
  item_name: text
  amount: int
  tier: enum (minimum, standard, premium, unknown)
  predicted_upgrade: int
  upgrade_probability: decimal
  created_at: timestamptz
  updated_at: timestamptz

visits
  id: uuid (PK)
  venue_id: uuid → venues
  scheduled_at: timestamptz
  status: enum (scheduled, completed, cancelled)
  completed_at: timestamptz
  created_at: timestamptz
  updated_at: timestamptz
  INDEX(venue_id)

visit_checklist_items
  id: uuid (PK)
  visit_id: uuid → visits
  item: text
  category: text
  checked: boolean (default false)
  checked_at: timestamptz
  sort_order: int

visit_notes
  id: uuid (PK)
  visit_id: uuid → visits
  content: text
  tags: text[]
  location_lat: decimal
  location_lng: decimal
  created_at: timestamptz

visit_note_media
  id: uuid (PK)
  visit_note_id: uuid → visit_notes
  type: enum (photo, voice)
  media_url: text
  created_at: timestamptz

visit_ratings
  id: uuid (PK)
  visit_id: uuid → visits
  user_id: uuid → users
  dimension: enum (atmosphere, hospitality, cuisine, cost, access, reviews)
  score: int (1-5)
  comment: text (nullable — prompted when partner ratings differ)
  created_at: timestamptz
  updated_at: timestamptz
  UNIQUE(visit_id, user_id, dimension)

ai_analyses
  id: uuid (PK)
  venue_id: uuid → venues (nullable)
  project_id: uuid → projects
  type: enum (review_summary, estimate_prediction, comparison, visit_prep)
  input_hash: text (SHA-256 of input for deduplication, not full context)
  output: text
  created_at: timestamptz
  INDEX(project_id, type)

decisions
  id: uuid (PK)
  project_id: uuid → projects
  selected_venue_id: uuid → venues
  rationale: text
  decided_at: timestamptz
  updated_at: timestamptz
  UNIQUE(project_id)
```

### Row Level Security (RLS)

All table access controlled via `project_members`:

```sql
-- Base policy pattern (applied to all project-scoped tables)
CREATE POLICY "project_member_access" ON venues
  USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
    )
  );

-- Owner-only actions (delete, project settings)
CREATE POLICY "owner_only_delete" ON venues
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );
```

### Key API Routes (Next.js Server Actions)

| Action | Purpose |
|--------|---------|
| `addVenueFromUrl(url)` | Fetch page + AI extract → create venue card |
| `addVenueManually(data)` | Manual venue entry |
| `analyzeReviews(venueId)` | Fetch review pages → AI summary (no original text stored) |
| `uploadEstimate(venueId, pdf)` | PDF → AI extract → line items + prediction |
| `compareVenues(venueIds)` | Multi-venue AI analysis |
| `generateChecklist(visitId)` | AI-generated visit checklist (max 5 items) |
| `quickNote(visitId, content)` | Save memo at venue |
| `addNoteMedia(noteId, file)` | Attach photo/voice to a note |
| `rateVenue(visitId, ratings)` | Save star ratings per dimension → triggers venue_scores update |
| `invitePartner(projectId, email)` | Send partner invitation |
| `syncVenueScores(venueId)` | Aggregate user ratings + review scores into venue_scores |

---

## Design System

### Style: Soft UI Evolution

Evolved soft UI with better contrast than neumorphism. Modern shadows, WCAG AA compliant. Conveys trust and premium quality fitting for a major life decision tool.

### Color Palette: Luxury Navy + Gold

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#1E3A8A` | Navigation, headings, primary actions |
| `--color-on-primary` | `#FFFFFF` | Text on primary |
| `--color-secondary` | `#3B82F6` | Secondary actions, highlights |
| `--color-accent` | `#A16207` | Gold accents, star ratings, AI indicators |
| `--color-background` | `#F8FAFC` | Page background |
| `--color-foreground` | `#0F172A` | Body text (neutral dark, not blue) |
| `--color-foreground-muted` | `#64748B` | Secondary text |
| `--color-muted` | `#E9EEF5` | Muted backgrounds |
| `--color-border` | `#BFDBFE` | Borders, dividers |
| `--color-destructive` | `#DC2626` | Errors, warnings, negative scores |
| `--color-success` | `#16A34A` | Positive indicators |
| `--color-card` | `#FFFFFF` | Card backgrounds |

**Rationale**: Gender-neutral (unlike pink-dominant wedding platforms). Navy + gold conveys trust and luxury. Differentiates from Zexy/Mynavi branding. Body text uses neutral `#0F172A` (slate-900) for optimal readability.

### Typography

| Role | Font | Weight |
|------|------|--------|
| Heading (JP) | Noto Serif JP | 500, 600, 700 |
| Body (JP) | Noto Sans JP | 300, 400, 500, 700 |
| Brand / Logo | Noto Serif JP | 700 |

Serif headings add formality befitting a wedding context. Sans body ensures readability for data-heavy comparison views.

### Spacing & Layout

- 8dp spacing rhythm (4/8/12/16/24/32/48)
- Card border-radius: 12-16px
- Soft shadow: `4px 4px 12px rgba(0,0,0,0.06), -2px -2px 8px rgba(255,255,255,0.8)`
- Breakpoints: 375 / 768 / 1024 / 1440
- Mobile-first responsive design

### Icons

SVG icons only (Lucide Icons). No emoji in structural UI elements.

---

## UX Patterns

### Comparison UX

- **Radar chart** for multi-axis overview (6 Tier 1 dimensions)
- **Side-by-side matrix** for detailed attribute comparison with sticky venue headers
- **Chip filters** for toggling comparison dimensions
- **Color-coded scores**: green (4.0+), gold (3.0-3.9), red (<3.0)
- **AI analysis inline** on comparison board (not separate chat)
- **Estimate waterfall chart** (custom Recharts BarChart with transparent stacks) showing initial → upgrades → predicted final

### Mobile UX

- **Swipe comparison** (Tinder-like) for quick initial screening
- **Bottom sheet** for venue details (maintains context)
- **Quick action bar** at venue: photo / memo / voice — one tap each
- **Quick star rating** — Tier 1 dimensions visible, tap to rate
- **Offline support** — notes and photos saved to IndexedDB (via Dexie.js), sync when online
- **GPS + timestamp** auto-attached to visit notes
- **Visit checklist limited to 5 items** — avoids "phone out the whole time" problem

### AI Display Pattern

- AI insights displayed as **inline cards** with gold left-border accent
- Structured output: strengths / concerns / recommendations
- Source attribution (e.g., "328 reviews from 3 sources to generate this summary")
- No separate chat UI — AI is embedded in context where the user needs it

### Progressive Disclosure

- Step-by-step onboarding (all fields optional, "skip for now" available)
- Comparison view starts with Tier 1 dimensions, expandable to Tier 2
- Visit checklist generated based on venue-specific concerns
- Smart reminders ("3 days since your visit — record your impressions?")

### Pair Sharing

- Partner invitation via email/link (pending until accepted)
- Real-time sync via Supabase Realtime (postgres_changes)
- Both partners' ratings visible side-by-side with disagreement highlighting
- Shared decision record (owner finalizes, partner confirms)

---

## Phased Delivery

### Phase 1 — Core Comparison (MVP)

Available steps: 1, 2, 4, 5, 6

- Conditions setup (all optional, skip-friendly)
- Manual venue entry + basic info
- Star rating per dimension (user input)
- Side-by-side comparison matrix
- Radar chart (6 Tier 1 dimensions)
- Shortlist management
- Final decision record
- Mobile responsive
- Auth (email + Google OAuth)

### Phase 2 — AI Intelligence

Enhances steps: 2, 4

- URL content extraction (BeautifulSoup + Claude)
- Review analysis → AI summary (no original text stored)
- Estimate PDF upload + AI extraction + prediction
- AI comparison analysis (inline)
- Background job processing (Supabase Edge Functions)

### Phase 3 — Visit Experience

Adds step: 3

- Visit scheduling + AI-generated checklist (5 items max)
- Mobile quick capture (photo, memo, voice)
- GPS + timestamp
- Offline support (IndexedDB + background sync)
- Smart reminders

### Phase 4 — Polish & Sharing

Enhances all steps:

- Partner invitation + real-time sync (Supabase Realtime)
- Partner rating comparison with disagreement detection
- Swipe comparison (mobile)
- Dark mode
- PWA install prompt

---

## Legal & Compliance Notes

- **No web scraping of protected content**: Server-side HTTP fetch of public pages only. If a site's robots.txt or ToS prohibits automated access, the system falls back to manual entry or user-pasted text. No headless browser automation (Playwright removed from scraping stack).
- **No review text storage**: Only AI-generated summaries are stored. Original review text is never persisted in the database. Users are linked to original sources.
- **Claude API privacy**: PII (personal names, addresses, phone numbers) is stripped before sending content to Claude API. Privacy policy must disclose AI processing. Anthropic's data usage policy (no training on API data) should be communicated to users.
- **PDF upload security**: Max 10MB file size, MIME type validation (application/pdf only), processing in sandboxed environment.
- **User data protection**: All tables use RLS via `project_members`. Environment-specific API keys on Vercel (separate for preview/production).
- **Copyright**: Venue photos from external sites are not stored — only URLs are referenced. User-uploaded photos are stored in Supabase Storage with project-scoped access.

---

## Non-Goals (Explicitly Out of Scope)

- Venue booking / reservation functionality
- Payment processing
- Vendor marketplace (florists, photographers, etc.)
- Wedding planning beyond venue selection
- Social features / community
- Venue-side admin panel
