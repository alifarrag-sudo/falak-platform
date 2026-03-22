# Influencer Management Dashboard

A production-ready influencer management platform for agencies. Import Excel files, manage your influencer database, plan campaigns, and export branded PDF proposals.

---

## Quick Start (Windows)

**Double-click `start.bat`** — it automatically opens the dashboard in your browser.

Or manually:

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev

# Open browser at http://localhost:5173
```

---

## Excel Import

The import engine handles all your existing Excel files automatically. It maps columns even when:
- Column names are in Arabic (الاسم، انستقرام، عدد المتابعين)
- Columns are named differently across files (e.g. "IG" = "Instagram" = "انستقرام")
- Files have header rows starting on row 2 or 3
- Files have merged cells or blank rows

### Supported Files (pre-analyzed)

| File | Rows | Key Columns |
|------|------|-------------|
| Shory.xlsx | 247 | Name, Platform, Follower, Price, Phone, Address |
| Influencers for shawky.xlsx | 920 | Name, Platform, Type, #followers, Link, Price |
| Bionnex Final Influncers.xlsx | 999 | Name, Platform, Link, No. of Followers, Category, Price |
| BIC Recommended Influencers for UGC.xlsx | 43 | Influencer name, platform link, Followers, Rate |
| bio influncers list.xlsx | 80 | Name (Arabic), Instagram URL, TikTok URL, Price |
| ايتوال مؤثرين نهائي.xlsx | 122 | Arabic name, Link, Platform, Price |
| etoile ramadan inf.xlsx | 53 | Arabic name, Instagram, TikTok, Follower counts, Rate |
| Deraah influncer i conncet 31.xlsx | 60 | Saudis + Non-Saudis sheets |

**To import:** Go to **Import Data** → drag and drop any Excel file → review column mappings → click Import.

---

## Features

### Influencer Database
- Table + card/grid view (toggle)
- Full-text search in English AND Arabic
- Filters: Category, Platform, Follower range, Rate range, Country, Mawthouq, Source
- Bulk select → bulk enrich or delete

### Campaign Planning
1. Create campaign with name, client, dates, budget, platform
2. Browse database and add influencers with one click
3. Set platform, number of posts, rate, and deliverables per influencer
4. Auto-calculates total cost vs. budget

### PDF Export
- Professional branded proposal with cover page
- One section per influencer (photo, social stats, rates)
- Summary table with total cost
- Configurable company name, logo, and colors (in Settings)

### Auto-Enrichment
- Automatically fetches follower counts from Instagram and TikTok
- Uses RapidAPI (enter your key in Settings) or falls back to public page scraping
- Per-influencer "Refresh Data" button + bulk refresh

---

## Settings

Go to **Settings** to configure:
- Company name and logo (shown on PDF proposals)
- PDF colors
- RapidAPI key (for enrichment)
- Default currency (SAR / EGP / USD / AED)
- Export all data as Excel

### RapidAPI Setup (for automatic follower counts)
1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Subscribe to **Instagram Scraper API2** and **TikTok API23** (both have free tiers)
3. Copy your API key to Settings → RapidAPI Key

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (via Node 24 built-in `node:sqlite`) — no setup required |
| Search | SQLite FTS5 (full-text search, Arabic supported) |
| Excel parsing | xlsx library |
| PDF generation | pdfmake |
| HTTP client | axios + TanStack Query |

---

## Project Structure

```
influencer-dashboard/
├── backend/
│   ├── src/
│   │   ├── db/schema.ts          # SQLite schema + FTS5 setup
│   │   ├── routes/
│   │   │   ├── influencers.ts    # CRUD + search + filters
│   │   │   ├── import.ts         # Excel import endpoints
│   │   │   ├── campaigns.ts      # Campaign management
│   │   │   ├── pdf.ts            # PDF generation
│   │   │   ├── settings.ts       # App settings
│   │   │   └── enrichment.ts     # Social data enrichment
│   │   ├── services/
│   │   │   ├── importService.ts  # Excel parsing + column mapping
│   │   │   ├── pdfService.ts     # PDF generation
│   │   │   └── enrichmentService.ts # API/scraping
│   │   └── utils/
│   │       ├── columnMapper.ts   # Fuzzy column name matching
│   │       └── normalizer.ts     # Data normalization
│   └── data/                     # SQLite database file
├── frontend/
│   └── src/
│       ├── pages/                # Full page components
│       ├── components/           # Reusable UI components
│       ├── types/                # TypeScript interfaces
│       └── utils/                # API client + helpers
└── start.bat                     # One-click launcher
```

---

## Notes

- **Data is never deleted** — influencers are only archived (soft delete)
- **Every edit is logged** with timestamp (see History on any influencer page)
- **Duplicate detection** uses handle matching + 90% name similarity threshold
- **Arabic text** is fully supported in search, display, and PDF export
- The SQLite database is stored at `backend/data/influencers.db` — back it up regularly
