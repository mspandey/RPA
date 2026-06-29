# 🛰️ RPA Telemetry Console

> **Mission Control for Enterprise Automation**
> A high-performance, real-time telemetry dashboard designed to monitor and manage over 50,000+ Robotic Process Automation (RPA) projects simultaneously without dropping a frame.

[![Live Deployment](https://img.shields.io/badge/Live-Vercel_Deployment-black?style=for-the-badge&logo=vercel)](https://frontbattle.vercel.app/)
[![GitHub](https://img.shields.io/badge/Source-GitHub-blue?style=for-the-badge&logo=github)](https://github.com/mspandey/RPA.git)

---

## 🎥 Demo Video

[👉 **Watch the Full Demo Video Here**](https://drive.google.com/file/d/1q1vsTtazT-wpAAgm1-13DLxZRnGE6sZK/view?usp=sharing)

---

## 📖 The Vision (Non-Technical Overview)

### The Problem
As enterprises scale their automation efforts, they deploy thousands of RPA bots across multiple departments. Tracking the real-time status of these bots—knowing which are active, paused, failing, or completed—becomes an impossible task. Traditional dashboards freeze or crash when fed with high-frequency telemetry data for tens of thousands of rows. 

### Our Solution
The **RPA Telemetry Console** is built like an aircraft's instrument panel. It provides operation managers with a God's-eye view of their entire automation fleet. It ingests a massive live data stream and visualizes it instantly. Operators can search, filter, sort, and analyze massive datasets on the fly, empowering them to detect failing bots in milliseconds and export actionable reports without ever interrupting the live feed.

---

## ✨ Key Features

- **Massive Scale Monitoring:** Tracks 50,000+ concurrent RPA tasks in real-time.
- **Instant Analytics Overlay:** Deep-dive into department-level metrics with a responsive, live-updating visual analytics panel.
- **Lightning-fast Data Manipulation:** Multi-column sorting and fuzzy-search filtering that reacts instantly, even on datasets larger than 50,000 rows.
- **Live KPI Strip:** Animated, real-time counters tracking global fleet health and statuses (Active, Paused, Failed, Completed).
- **Non-Blocking Snapshot Export:** Export the exact rows you are currently viewing (respecting all sorts and filters) to a CSV file instantly, entirely on the client-side, without freezing the application.
- **High-Density "Mission Control" UI:** A dark-mode, terminal-inspired aesthetic focusing on pure data density and readability over flashy, distracting elements.

---

## 🛠 Technical Architecture (Under the Hood)

To achieve 60FPS performance while processing a continuous stream of 50k+ records, we had to rethink standard React state management:

 ### 1. Headless Data Engine (`viewEngine.js` & `rpaStore.js`)
Instead of relying on React `useState` (which would trigger catastrophic re-renders on every tick), we implemented a custom, highly optimized in-memory data store. The telemetry stream mutates this store directly.

### 2. Virtualized Rendering Grid
Rendering 50,000 DOM nodes would crash the browser. We implemented a **Custom Virtualized Grid** that calculates the exact scroll position and only renders the ~30 rows visible in the user's viewport. As the user scrolls, DOM nodes are recycled and repopulated in milliseconds.

### 3. Decoupled UI Updates
The grid component uses mutable React `refs` to track the viewport, bypassing the React render cycle entirely for scroll events. We manually trigger micro-updates only when strictly necessary (e.g., when a user clicks a row to open the inspector).

### 4. Client-Side CSV Generation
The Snapshot Export feature compiles massive datasets into memory using `Blob` objects and triggers a secure client-side download. This ensures absolute data privacy and zero server latency, completely detached from the main rendering thread.

---

## 🚀 Getting Started (Run Locally)

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mspandey/RPA.git
   cd RPA
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`

---

*Built with passion for high-performance web engineering.*
