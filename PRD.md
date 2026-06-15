# CRM Product Requirements Document

**Project:** Voice-first relationship intelligence system  
**Status:** In progress  
**Last updated:** 2026-06-15

---

## 1. Problem

Managing a high-velocity relationship network across investors, founders, sponsors, fellows, and community members is impossible with static spreadsheets. Context lives in people's heads. Follow-ups get dropped. The right person for the right ask is never surfaced quickly enough.

This CRM exists to make the team's collective relationship knowledge queryable, actionable, and self-updating — starting with voice.

---

## 2. Who Uses This

- **The core team** — logging contact context after every meeting, event, or intro
- **Partners and associates** — looking up who to call for a specific ask
- **Future:** portfolio founders, fellows, and GPs who want warm intros surfaced automatically

---

## 3. Customer Stories

### 3.1 Events & Programming

> **"I'm putting together an invite list for our next summit. I need investors who are active in climate tech, based in the DMV, and who we've actually had a real relationship with — not cold contacts."**

- Filter contacts by `region = DC/MD/VA`, `investing_sectors includes climate`, `engagement_level = warm or above`
- Export a curated invite list with email addresses in one click

> **"We need 3 sponsors for the spring cohort kickoff. Who do we know at firms that have sponsored us before or have expressed interest?"**

- Filter organizations by `relationship_status = active`, cross-reference with past sponsorship history
- Surface key contacts at each org with their `role_type` and best outreach channel

> **"I need a venue in DC that can hold 150 people and has hosted us before."**

- Filter organizations by `type = venue` (or tagged), `region = DC`, `relationship_status = active`

> **"I'm looking for 4 panelists on the topic of defense tech — people who have real operator credibility, not just investors."**

- Filter contacts by `sector_expertise includes defense`, `role_type = operator or founder`, `can_help_with includes speaking`

---

### 3.2 Deals & Investing

> **"A founder just sent us a deck. Before I respond, I want to know if anyone in our network has met her or if we have a warm path in."**

- Search contacts by founder name + organization → surface any connections, prior interactions, who introduced them

> **"I want to share this deal with LPs who specifically invest in pre-seed B2B SaaS."**

- Filter contacts by `role_type = lp`, `investing_sectors includes B2B SaaS`, `investing_stage_pref = pre_seed or seed`, `check_size = 100k+`

> **"What's the status of every deal we sourced from conferences in Q1?"**

- Filter deals by `source_type = conference`, `received_date = Q1 2026`

---

### 3.3 Targeted Outreach

> **"We're putting together a cohort spotlight on female-led companies. Who in our investor network has publicly stated they prioritize gender-diverse founders?"**

- Filter contacts by `investing_thesis contains female-led` or tagged accordingly

> **"We have a government contract opportunity — who do we know in the DMV with defense or cyber backgrounds?"**

- Filter by `region = DC/MD/VA`, `sector_expertise includes defense or cyber`

> **"We're partnering with a Lagos-based accelerator. Who in our network is Nigerian or has active Africa exposure?"**

- Filter by `region = africa` or `country = Nigeria` on organizations; `notable_background` text search

> **"I need to connect our DC-based health founder with a mentor who's navigated FDA approvals."**

- Filter by `sector_expertise includes health`, `can_help_with includes regulatory`, `region = DC/MD/VA`

---

### 3.4 Community & Ecosystem Building

> **"Which angel groups in our network could we co-invest with on this deal?"**

- Filter organizations by `type = angel_network`, `relationship_status = active or warm`

> **"Who are our fellow GPs running emerging funds that we should be partnering with more?"**

- Filter by `role_type = gp`, `relationship_to_da = partner or community`

> **"Which impact-focused funds have we talked to but never formally partnered with?"**

- Filter organizations by `type = vc_firm`, tag `impact`, `relationship_status = warm or cold`

> **"What LP support orgs or fund-of-funds have we engaged with this year?"**

- Filter by `type = lp` or `other_communities`, `last_interaction = within 12 months`

> **"I want to send a note to every fellowship alum we're still in touch with."**

- Filter contacts by `relationship_to_da = portfolio` or fellowship membership join; `engagement_level = warm or above`

---

### 3.5 High-Trust Asks

> **"I need to make 3 warm intros this week. Who are the most connected people in our inner circle who could open doors for our new founder?"**

- Filter `inner_circle = true`, `can_help_with includes intros`, sort by `engagement_level`

> **"Who should I actually call for real advice on structuring an SPV?"**

- Filter `inner_circle = true`, `can_help_with includes SPV structure` or `sector_expertise includes fund formation`

---

## 4. Core Data Model

Three primary tables. Everything else is downstream.

### `contacts` — one row per person
The atomic unit. A person can exist independently of any company or deal.

Key fields: `first_name`, `last_name`, `email`, `title`, `organization_id`, `linkedin_url`, `phone`, `role_type`, `relationship_to_da`, `inner_circle`, `region`, `sector_expertise[]`, `investing_stage_pref`, `check_size`, `investing_sectors[]`, `investing_thesis`, `can_help_with[]`, `notable_background`, `source`, `introduced_by`, `first_contact`, `last_interaction` (computed), `description`, `engagement_level` (computed)

### `organizations` — one row per company / fund / firm
Contacts belong to organizations. Deals are tied to organizations.

Key fields: `name`, `type`, `website`, `sectors[]`, `region`, `country`, `relationship_status`, `primary_contact_id`, `description`, `notes`

### `deals` — one row per investment opportunity
Tracks pipeline from sourcing to close/pass.

Key fields: `organization_id`, `stage`, `sectors[]`, `round_type`, `valuation_cap`, `raise_amount`, `source_type`, `source_contact_id`, `founder_contact_id`, `received_date`, `decision_date`, `pass_reason`, `deck_url`, `memo_url`, `notes`

---

## 5. Enum Definitions (Working Draft)

These map to the schema enum fields. AI uses these to classify extracted voice content.

### contacts
| Field | Values |
|---|---|
| `role_type` | `gp`, `lp`, `partner`, `associate`, `founder`, `ceo`, `cto`, `coo`, `angel`, `advisor`, `operator`, `other` |
| `relationship_to_da` | `investor`, `founder`, `portfolio`, `advisor`, `partner`, `community`, `warm_intro`, `other` |
| `region` | `dmv` (DC/MD/VA), `northeast`, `southeast`, `midwest`, `west_coast`, `europe`, `latam`, `africa`, `asia_pacific`, `middle_east` |
| `source` | `conference`, `intro`, `linkedin`, `cold_outreach`, `community`, `event`, `referral`, `fellowship`, `other` |
| `investing_stage_pref` | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c_plus`, `growth`, `all_stages` |
| `check_size` | `under_25k`, `25k_100k`, `100k_250k`, `250k_1m`, `1m_5m`, `5m_plus` |

### organizations
| Field | Values |
|---|---|
| `type` | `vc_firm`, `angel_network`, `family_office`, `corporate_vc`, `accelerator`, `startup`, `lp_support_org`, `foundation`, `government`, `media`, `venue`, `fellowship`, `other` |
| `relationship_status` | `active`, `warm`, `cold`, `passed`, `portfolio`, `sponsor`, `partner`, `inactive` |

### deals
| Field | Values |
|---|---|
| `stage` | `sourced`, `intro_requested`, `first_meeting`, `under_review`, `term_sheet`, `committed`, `closed`, `passed`, `on_hold` |
| `round_type` | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c`, `bridge`, `safe`, `convertible_note`, `other` |
| `source_type` | `warm_intro`, `cold_inbound`, `conference`, `portfolio_referral`, `founder_network`, `other` |

---

## 6. Voice Ingestion Pipeline

The primary input method. No manual data entry.

```
Voice recording
    ↓
Browser Web Speech API → raw transcript text
    ↓
(Optional) Paste in Gemini / Google Meet transcript or typed notes
    ↓
GPT-4o extraction — maps to contacts + organizations + deals columns
    ↓
Confidence scoring — flags fields it's unsure about
    ↓
Human review UI — diff view, confirm or edit before save
    ↓
Supabase upsert — merge into existing records, never overwrite clean data
    ↓
Google Sheets sync — append row for stakeholder visibility
```

### Extraction targets per entity type

**From a single note, extract:**
- 1 contact (primary subject of the note)
- 0–1 organizations (their employer / fund)
- 0–1 deals (if they're a founder raising, or a deal was discussed)

**For multi-person notes:** AI splits into sub-sections first, then processes each independently.

### Merge logic
- **Contacts:** match on `email`. If found, fill empty fields only — never overwrite existing values.
- **Organizations:** match on `name` (normalized). Same merge-only logic.
- **Deals:** match on `organization_id` + `round_type`. If an open deal exists, update stage/notes.

---

## 7. Search & Filtering Requirements (future)

The stored data is only valuable if it's queryable. Phase 2 will add:

- **Saved segments** — named lists for common queries ("active DMV investors", "inner circle advisors", "cold sponsors to re-engage")
- **Natural language search** — "find me climate investors in the DMV who can write a $250K check"
- **Bulk outreach** — export a filtered segment as a CSV or push to an email tool
- **Relationship score** — computed from `last_interaction`, `first_contact`, `inner_circle`, and interaction frequency

---

## 8. Open Questions

- [ ] What does "DA" stand for in `relationship_to_da`? (Used to calibrate AI prompts)
- [ ] Confirm / correct the enum values above before they go into the schema
- [ ] Should deals be created from voice notes, or managed separately?
- [ ] Is there an existing Supabase project to connect to, or starting fresh?
- [ ] Which team members need access? (Drives Supabase Auth setup)
- [ ] Should the Google Sheet be the source of truth for stakeholders, or just a read-only mirror?
