# Study Arena — v2 Changes Plan

Large multi-area change. I'll batch by domain to minimize churn.

## 1. Database migration (single migration)

- `ALTER TABLE profiles DROP COLUMN streak_days`
- `ALTER TABLE rooms ADD focus_duration_minutes INT DEFAULT 25, ADD break_duration_minutes INT DEFAULT 5`
- `ALTER TABLE groups ADD invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6),'hex')`; backfill existing rows
- New table `group_invitations` (id, group_id, invited_email, invite_code, status, created_at) + GRANTs + RLS (admins of group can manage; invited email can read their own)
- New table `quiz_attempts` already exists per context — confirm; if not, create
- Storage bucket `study-files` (private; RLS: group members read, authenticated write into their group folder)

## 2. Remove streak + recent activity

- Dashboard: drop streak StatCard (replace with simple "Groups" count or just 2 cards), drop weekly leaderboard panel, drop recent activity panel. Right panel → "Your groups" summary list.
- Profile: remove streak references.
- AppShell: remove streak references if any.

## 3. Room creation modal with custom timer

- Dashboard "New room" dialog gets focus/break selects (15/20/25/30/45/50, 5/10/15).
- Insert into `rooms` with `focus_duration_minutes`, `break_duration_minutes`.
- `session.$roomId.tsx`: replace FOCUS/BREAK constants with values from `room.focus_duration_minutes * 60` etc. Initial session insert uses room's focus duration. Skip-phase uses room's break/focus duration.

## 4. Video call placeholder in session

- Above participants card: dark video grid (one tile per participant), avatar initials center, name below, mic icon bottom-left, camera-off icon center when off.
- Two toggle buttons: Mic / Camera (local UI state only).

## 5. Group detail page (`/groups/$groupId`)

- Weekly Ranking section: query `point_events` joined to user, filtered by group members and current week (Monday→now), summed per user, rendered with horizontal bar proportional to top.
- Member management:
  - Member list with role badge
  - Admin: "Remove" button per non-self member with AlertDialog
  - Non-admin member: "Leave group" button with AlertDialog
  - Admin: "Invite by email" input + button → insert `group_invitations`
  - Admin: "Copy invite link" → `${origin}/join/${group.invite_code}`

## 6. New route `/join/$inviteCode`

- If authenticated: lookup group by invite_code, upsert `group_members`, redirect to group page.
- If not: redirect to `/register?invite={code}`. Register page consumes `invite` query param and after sign-up calls join logic.

## 7. Materials page (full implementation)

Replace placeholder with three creation flows + listing:

- Top bar: 3 buttons (Upload file, Create flashcards, Create quiz) + group filter.
- **Upload file modal**: file input, subject, group select → upload to `study-files/{groupId}/{uuid}-{name}`, insert `study_materials` (type='file', file_url=public URL or signed).
- **Flashcards modal**: name, subject, group, dynamic Q/A list → insert material + flashcards rows.
- **Quiz modal**: name, subject, group, dynamic question list (4 options + correct index) → insert material + quiz_questions rows.
- Listing: cards per material with type badge. Actions:
  - file → View (opens URL)
  - flashcard_set → Practice (modal with flip animation, prev/next, progress)
  - quiz → Play (full-screen modal, score, save attempt, award points) + Leaderboard (modal listing group members' best attempts)

## 8. Files to add/edit

Add:
- `src/routes/join.$inviteCode.tsx` (public, redirects)
- `src/components/materials/UploadFileDialog.tsx`
- `src/components/materials/FlashcardsDialog.tsx`
- `src/components/materials/QuizDialog.tsx`
- `src/components/materials/PracticeFlashcardsDialog.tsx`
- `src/components/materials/PlayQuizDialog.tsx`
- `src/components/materials/QuizLeaderboardDialog.tsx`
- `src/components/session/VideoGrid.tsx`

Edit:
- `src/routes/_authenticated/dashboard.tsx` (remove streak/leaderboard/activity, new room modal)
- `src/routes/_authenticated/session.$roomId.tsx` (custom timer + video grid)
- `src/routes/_authenticated/groups.$groupId.tsx` (member mgmt + leaderboard + invites)
- `src/routes/_authenticated/groups.tsx` (generate invite_code on create — handled by DB default)
- `src/routes/_authenticated/materials.tsx` (full rewrite)
- `src/routes/_authenticated/profile.tsx` (drop streak)
- `src/routes/register.tsx` (consume `invite` param, auto-join post-register)
- `src/components/AppShell.tsx` (drop streak references)

## 9. Notes

- Camera/Mic toggles are local UI only — no WebRTC.
- File "view" uses signed URLs (bucket private) to respect group access.
- Invite-by-email creates a pending invitation; matching by email at sign-in/register-time auto-joins (handled in register flow + a small helper called on auth).

Ready to proceed with the migration first, then code in the order above.