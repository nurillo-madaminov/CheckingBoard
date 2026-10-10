# CheckingBoard - Dispatch Driver Tracker

Dynamic, Excel-inspired fleet dispatch management system built with **Vue 3** and **Tailwind CSS**.

---

## 🚀 Quick Start

Double-click `start.bat` or run:
```bash
npm run dev
```
Then open your browser at `http://localhost:5173`.

---

## 🎨 Status & Color Configuration
To change any status names, codes, or colors, open:
📁 `src/config/statusConfig.js`

You can change background colors (`bgColor`), text colors (`textColor`), border colors, and descriptions.

---

## 💾 Database Recommendations

The project supports both client-side storage and backend persistence. Depending on how your dispatch team works, here are the best database choices:

### 1. SQLite (Recommended for Local / Desktop / Single Office)
- **Why**: Zero configuration, single-file (`checkingboard.db`), blazingly fast, 100% free with zero monthly cloud cost.
- **How to use**: Run the included Node.js server (`npm run server`) on an office computer or local network server.

### 2. Supabase / PostgreSQL (Recommended if Dispatchers Work Remotely)
- **Why**: Cloud-hosted PostgreSQL with built-in WebSockets (Realtime). When Dispatcher A marks a driver "GOING DEL", Dispatcher B's screen updates immediately without refreshing.
- **Cost**: Free tier includes 500 MB database and unlimited API requests.

### 3. PocketBase (Single Executable + Realtime)
- **Why**: A single lightweight `.exe` file that embeds SQLite, real-time subscriptions, and an admin dashboard.
