# Case Study Simulator

An interactive, browser-based business case simulator built with React and Vite. Users sign in via Supabase Auth (OAuth or magic link), start scenario sessions, and interact with an AI advisor through an OpenAI-compatible endpoint. Sessions and transcripts are stored in Supabase.

## Features
- OAuth login via Supabase (Google, GitHub) and email magic link
- Dark/light/auto theme toggle persisted to localStorage
- Start new sessions, continue past sessions, and delete sessions
- Chat UI with optional streaming AI responses; markdown rendering for rich output
- LLM endpoint and API key configurable at runtime (OpenAI-compatible)
- Linting with oxlint; fast dev build with Vite

## Tech Stack
- React 19 and Vite 7
- Bootstrap 5 and Bootstrap Icons
- Supabase (Auth + Postgres + RLS)
- asyncllm and bootstrap-llm-provider for OpenAI-compatible requests
- react-markdown for safe markdown display

## Project Structure
```
.
+- index.html
+- vite.config.js
+- package.json
+- src/
¦  +- main.jsx  # App entry; auth, game, LLM config, Supabase client
¦  +- App.css   # Basic styles
```

## Prerequisites
- Node.js 18+ and npm 9+
- A Supabase project (Auth enabled; Postgres database)
- Optional: an OpenAI-compatible LLM endpoint and API key

## Setup
1) Install dependencies
```
npm install
```

2) Configure Supabase
- Create a Supabase project and enable OAuth providers you want (Google, GitHub).
- In `Authentication -> URL configuration`, add your site domain to Site URL and Allowed Redirect URLs.
- Create the database tables and RLS policies:

```sql
-- Sessions initiated by a user
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz default now()
);

-- Chat messages linked to a session
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  role text not null check (role in ('user','ai')),
  content text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.game_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Users may manage only their own sessions
create policy if not exists "manage own sessions"
  on public.game_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users may manage only messages belonging to their sessions
create policy if not exists "manage own messages"
  on public.chat_messages for all
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.game_sessions s where s.id = session_id and s.user_id = auth.uid()));
```

- Update the Supabase client credentials in `src/main.jsx`:
  - `supabaseUrl`: your project URL
  - `supabaseKey`: your anon public key (never use the service role key in the client)

3) Configure the LLM endpoint (optional)
- Click the "Configure LLM" button in the app navbar.
- Set an OpenAI-compatible Base URL and API key.
- Choose a model name supported by your endpoint.
- These settings are stored in localStorage for the current browser only.

## Development
- Start the dev server:
```
npm run dev
```
- Lint code:
```
npm run lint
```

## Build and Preview
- Production build:
```
npm run build
```
- Preview the build locally:
```
npm run preview
```

## Deployment
- Static hosting (Netlify, Vercel, GitHub Pages) works out of the box.
- The project sets `base: '/supabase-game/'` in `vite.config.js`. If your repository or hosting path differs, update `vite.config.js` accordingly.
- Ensure your deployed domain is added to Supabase Auth "Site URL" and "Redirect URLs".

## Usage
- Sign in with Google, GitHub, or request a magic link.
- Click "Start" to create a new session. The advisor introduces the scenario.
- Type your decision and send. The advisor responds; messages are stored in Supabase.
- Open "Profile" to view, continue, or delete past sessions.
- Use the theme toggle and "Configure LLM" as needed.

## Security Notes
- Do not expose service role keys in client-side code. Use only the anon public key.
- RLS policies above restrict data access to the authenticated user.
- The app stores theme and LLM config in localStorage; no sensitive server secrets are stored there.

## Known Limitations
- Supabase credentials are currently hardcoded in `src/main.jsx`. Consider moving to environment variables (e.g., `import.meta.env`) for deployments.
- The default model string in code is a placeholder; set a valid model name for your endpoint.
- Error handling for network issues is basic; streaming falls back to a non-streamed response.

## Contributing
- Open issues or PRs with clear problem statements and repro steps.
- Keep changes small; add tests or manual steps to verify behavior.

## License
Choose a license (e.g., MIT) and update this section as appropriate.
