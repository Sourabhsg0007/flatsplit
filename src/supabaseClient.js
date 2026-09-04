import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const configured = Boolean(url && anonKey)

if (!configured) {
  console.error(
    'Missing Supabase config. Copy .env.example to .env and fill in your project URL and anon key, then restart the dev server.'
  )
  // Show a friendly setup screen instead of a blank crash.
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = `
      <div style="max-width:460px;margin:14vh auto;padding:0 20px;font-family:system-ui,sans-serif;color:#21312a;line-height:1.55">
        <h1 style="font-size:1.3rem">FlatSplit needs its keys 🔑</h1>
        <p>No Supabase configuration found. To run locally:</p>
        <ol style="padding-left:20px">
          <li>Copy <code>.env.example</code> to <code>.env</code> in the project root</li>
          <li>Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code><br>
              <small>(Supabase Dashboard → Project Settings → API)</small></li>
          <li>Restart the dev server (<code>npm run dev</code>)</li>
        </ol>
        <p><small>Deploying to Vercel? Set the same two values under Project → Settings → Environment Variables.</small></p>
      </div>`
  })
}

// Placeholder values keep createClient from throwing before our message renders.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
)
