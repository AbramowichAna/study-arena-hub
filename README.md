# Study Buddies Arena

Build a full-stack web app called **Study Arena** — a social, gamified study platform for university students.

---

## TECH STACK

- React + TypeScript + Vite

- Supabase (auth, database, realtime)

- Tailwind CSS + shadcn/ui

- Lucide React icons

---

## DESIGN SYSTEM

- Color palette: primary blue #2A6B9E, success green #0F6E56, warning amber #BA7517, danger red #A32D2D

- Clean, flat UI. White cards with 0.5px borders. No gradients.

- Font: Inter or similar clean sans-serif

- Dark mode support via Tailwind

---

## AUTH (Epic 6)

Pages: `/register` and `/login`

- Register: name, email, password

- Login: email, password

- Supabase Auth

- Protected routes redirect to `/login` if not authenticated

---

## DATABASE SCHEMA (Supabase)

Tables:

- `profiles` (id, name, email, avatar_url, total_points, streak_days, created_at)

- `groups` (id, name, admin_id, invite_code, created_at)

- `group_members` (id, group_id, user_id, role: 'admin'|'member', joined_at)

- `rooms` (id, name, group_id, created_by, status: 'waiting'|'active'|'finished', created_at)

- `room_participants` (id, room_id, user_id, joined_at, left_at, points_earned)

- `sessions` (id, room_id, phase: 'focus'|'break', duration_seconds, started_at, ended_at, timer_state)

- `study_materials` (id, name, type: 'flashcard_set'|'quiz'|'file', subject, group_id, user_id, ai_generated, created_at)

- `flashcards` (id, material_id, front, back, order)

- `quiz_questions` (id, material_id, question, options: jsonb, correct_index, order)

- `quiz_attempts` (id, material_id, user_id, score, completed_at)

- `point_events` (id, user_id, type: 'session_complete'|'abandon_penalty'|'quiz_score', points, created_at)

- `user_goals` (id, user_id, type: 'daily_hours'|'weekly_sessions'|'weekly_quizzes', target, created_at)

---

## PAGES & FEATURES

### `/dashboard` — Home

Left sidebar:

- Logo "Study Arena" with sword icon

- Nav: Dashboard, Active Session, Materials, Profile

- "My Groups" section listing user's groups with colored dots

Top navbar:

- Points badge (trophy icon + points total)

- User avatar

Main area:

- Greeting: "Good morning, [Name]"

- 3 stat cards: sessions this week, study time today (with goal progress), current streak

- "Active Rooms" grid (2 columns):

  - Room card shows: name, group, live/scheduled badge, participant count, timer pill

  - If live: "Join" button, navigates to session

  - "Create room" card with dashed border

Right panel:

- Weekly leaderboard (rank, avatar initials, name, points, small bar)

- Recent activity feed (completed sessions, points earned, abandoned penalties, new quizzes shared)

---

### `/session/:roomId` — Study Session

- Room header with name, group, live badge

- Central Pomodoro timer (large font, 25min focus / 5min break)

- Timer synced in real-time via Supabase Realtime on `sessions` table

- Controls: Pause/Resume, Skip phase, Abandon (with confirm dialog that applies -20 pts penalty)

- Participants grid: avatar initials, name, status dot (studying/paused), points earned this session

- Chat panel below timer (real-time messages via Supabase Realtime)

- On session complete: award +100 pts, show celebration modal

---

### `/groups` — Groups management

- List of user's groups

- Create group button → modal (name field, creates group + sets user as admin)

- Each group card: name, member count, "Manage" button

- Group detail page `/groups/:groupId`:

  - Member list with roles

  - Invite link (auto-generated code, copy button)

  - If admin: remove member button, invite by email input

  - Leave group button (non-admin)

---

### `/materials` — Study Materials

- Tabs: All, Flashcards, Quizzes, Files

- Filter by subject/group

- Material cards: icon, name, subject tag, AI badge if ai_generated

- Upload file button → file picker, associates to group/subject

- "Create flashcards" button → modal to add cards (front/back pairs)

- "Create quiz" button → modal to add questions with 4 options, mark correct answer

- "Generate with AI" button → text input → call Anthropic API to generate flashcards or quiz from uploaded text

- Each material: action buttons (Practice/Play, Share to group, View leaderboard for quizzes)

Quiz play modal:

- Show questions one by one

- Multiple choice

- Show score at end

- Update `quiz_attempts` table

- Show leaderboard of group members' scores

---

### `/profile` — User Profile

- Avatar circle with initials, name, email, join date

- Points badge, streak badge

- 3 metric cards: hours this week, daily average, group sessions completed

- Personal goals section: progress bars for each goal (daily hours, weekly sessions, weekly quizzes)

- "Edit goals" button → inline edit targets

---

## GAMIFICATION LOGIC

- `point_events` table tracks all point changes

- Completing a session (staying until timer ends): +100 pts

- Abandoning session early: -20 pts (shown in activity feed as penalty)

- Completing a quiz: +10 to +50 pts based on score

- `total_points` on `profiles` is updated via Supabase trigger or client-side after each event

- Weekly leaderboard: query `point_events` from last Monday, sum by user, join with profiles

---

## REAL-TIME (Supabase Realtime)

Subscribe to changes on:

- `sessions` → sync timer for all room participants

- `room_participants` → update participant list live

- Chat messages via a `messages` table (room_id, user_id, content, created_at)

---

## AI INTEGRATION

- Use Anthropic API (`claude-sonnet-4-20250514`) to generate flashcards or quiz questions from user-provided text

- Input: raw text (paste or from uploaded file summary)

- Output: JSON array of flashcard objects `{front, back}` or quiz question objects `{question, options: string[4], correct_index}`

- Show "Generate with AI ✨" button on material creation modal

- AI-generated materials get `ai_generated: true` badge

---

## NAVIGATION FLOW

1. Unauthenticated → `/login`

2. After login → `/dashboard`

3. Click room card → `/session/:roomId`

4. Sidebar "Materials" → `/materials`

5. Sidebar "Profile" → `/profile`

6. Sidebar group name → `/groups/:groupId`

---

## UX REQUIREMENTS

- A new user should be able to create or join a session in under 3 minutes

- Responsive for desktop browsers (min 1024px)

- All actions have loading states and error toasts

- Confirm dialogs for destructive actions (abandon session, leave group, remove member)

- Empty states with CTA buttons on every list page

---

Start by scaffolding the full project structure, setting up Supabase client, auth context, protected routes, and the dashboard page. Then implement features in this order: Auth → Groups → Rooms/Sessions → Materials → Gamification → Profile.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://study-arena-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/83c7c213-77f5-4033-a4d9-a8eb931f7da2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
