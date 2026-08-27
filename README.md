# HVAC & Plumbing CRM

A full-stack CRM built for commercial HVAC and plumbing service sales teams.

## Features

- **Companies** — Track every account with property type, contract status, HVAC unit count, address, notes
- **Contacts** — Multiple contacts per company, with primary contact flag, preferred contact method
- **Proposals** — Create proposals manually OR upload an Excel workbook to auto-fill line items; download professional PDF proposals
- **Activity Log** — Log calls, visits, emails, notes per account
- **Dashboard** — Pipeline value, won revenue, contract breakdown at a glance

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Frontend | React 18 + Vite |
| PDF | PDFKit |
| Excel | SheetJS (xlsx) |

## Quick Start

### Prerequisites
- Node.js 18+ installed on your machine
- npm

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the backend (in one terminal)

```bash
cd backend
npm start
# API runs on http://localhost:3001
```

### 4. Start the frontend (in another terminal)

```bash
cd frontend
npm run dev
# App runs on http://localhost:3000
```

Open your browser to **http://localhost:3000**

---

## Excel Upload Format

When uploading an Excel file to generate proposal line items, your spreadsheet should have these columns (names are flexible — the system auto-detects):

| Description | Quantity | Unit | Unit Price |
|-------------|----------|------|------------|
| RTU #1 Annual PM | 1 | ea | 450.00 |
| Filter replacement | 12 | ea | 35.00 |
| Labor — refrigerant check | 2 | hr | 125.00 |

**Tips:**
- Column headers can vary (e.g. "Desc", "Qty", "Hours", "Price", "Rate" all work)
- CSV files are also accepted
- The system reads the first sheet/tab

---

## Customizing Your Company Name on PDFs

In `backend/routes/proposals.js`, find this line (~line 90) and update it:

```js
.text('Your Company Name | (555) 000-0000 | yourcompany@example.com', 50, 58)
```

---

## Production Deployment

To serve both frontend and backend from one Node.js process:

```bash
# Build the frontend
cd frontend && npm run build

# Start backend in production mode (serves the built frontend too)
cd backend && NODE_ENV=production npm start
```

Then visit **http://localhost:3001**

---

## Database

The SQLite database (`backend/crm.db`) is created automatically on first run. Back it up by copying that file.
