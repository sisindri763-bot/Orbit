# VITHI Data Observability Dashboard

A production-grade Data Observability Dashboard built with **React + Vite**, connected to a live FastAPI backend on AWS RDS MySQL.

## Features
- 📊 **Overview** — Real-time KPIs, pipeline runs chart, success rate, incidents
- 🔄 **Pipelines** — Full pipeline monitoring with source→destination, success rates, trend sparklines
- 🌡️ **Data Observability** — Freshness, Volume, Data Quality, Schema drift pages
- 🔗 **Lineage** — End-to-end data lineage graph
- ⚠️ **Incidents** — Incident tracking with severity and blast radius
- 📈 **Metrics** — Row-level volume and duration analytics
- 📝 **Logs** — Searchable execution logs with query traces

## Tech Stack
- **Frontend**: React 19 + Vite 8
- **Charts**: Recharts
- **Routing**: React Router DOM v7
- **HTTP**: Axios
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (dark theme)

## Setup

```bash
# Install dependencies
npm install

# Create .env from template
cp .env.example .env

# Start dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

| Variable | Description |
|---|---|
| `API_BACKEND_URL` | Backend host (local `.env` + Vercel env). Never commit a real value. |

## API
Connected to: `https://vithi-observability-dasboard.vercel.app`

**Endpoints used:**
- `GET /api/overview/kpis`
- `GET /api/overview/charts`
- `GET /api/overview/health`
- `GET /api/overview/recent-incidents`
- `GET /api/overview/pipeline-monitoring`
- `GET /api/pipelines`
- `GET /api/observability/freshness`
- `GET /api/observability/volume`
- `GET /api/observability/schema`
- `GET /api/observability/data-quality`
- `GET /api/observability/metrics`
- `GET /api/lineage`
- `GET /api/logs`
