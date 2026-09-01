# NEXORG — NexPlay Tournament Organizer & Host Portal

Standalone Host & Tournament Operations Portal for verified tournament organizers and scrim hosts.

---

## Features

### 🏆 Tournament Operations
- **Tournament Creator**: Multi-format creation (Battle Royale, Clash Squad, Per Kill, Group Stage).
- **Control Center** (`/tournament-admin/:id`):
  - Overview: Match formats, prize pools, and live controls.
  - Groups & Brackets: Automated group assignment and bracket generators.
  - Match Schedules & Dispatch: Schedule matches and broadcast credentials.
  - Rosters & Squads: Verify team registrations, player IDs, and check-in status.
  - Result Entry & Qualification: Input kills and placement matrix with instant calculation.
- **Scrims Control Room** (`/organizer/scrim/:id`):
  - Slot allocation & custom room ID/password release to registered captains.
  - Live scoring and match completion.
- **Dispute Center**: Inbox for dispute tickets submitted by participants in hosted matches.
- **Host Wallet**: Track tournament earnings and request revenue payouts.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```env
IMGBB_API_KEY=your_imgbb_api_key
VITE_IMGBB_API_KEY=your_imgbb_api_key
FIREBASE_PROJECT_ID=nexplayorg-app
FIREBASE_STORAGE_BUCKET=nexplayorg-app.firebasestorage.app
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
