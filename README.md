# Outlet performance dashboard

Plain JavaScript + Vite. Reads weekly outlet figures from the Supabase table
`public.outlet_weekly` and falls back to built-in sample data if Supabase
isn't configured or can't be reached (a note under the title says so).

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

## Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel, or run `npx vercel`
   from this folder. Vercel detects Vite automatically: build command
   `npm run build`, output directory `dist`.
2. In Vercel, open Project Settings > Environment Variables and add:
   - `VITE_SUPABASE_URL` = `https://ntonyxwnmjamhthqveiu.supabase.co`
   - `VITE_SUPABASE_KEY` = your Supabase publishable key (see `.env.example`)
3. Redeploy after adding or changing the variables. They are baked in at build time.

The publishable key is meant to be public. The table's row-level security only
allows reads, so visitors can't change the data.

## Database

`supabase.sql` creates the table, the read-only policy and the sample rows.
It has already been run on the project above. Re-running it is safe.

## Files

- `index.html` – page layout
- `src/main.js` – data loading (`loadData()`) and rendering
- `src/style.css` – styles
