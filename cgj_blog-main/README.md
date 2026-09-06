# CGJ Club · NUSRL Ranchi

This is the CGJ public site and editorial workspace. It uses Google only to prove a
person's identity. The application creates and validates its own database-backed
sessions; Supabase Authentication is not used.

## Authentication and authorization model

1. A visitor can view public content without signing in.
2. An editor starts `/api/auth/google`, which starts a Google OAuth 2.0 authorization-code flow with PKCE, a one-time state value, and an OpenID Connect nonce.
3. The callback verifies the state cookie and server-side transaction, exchanges the code on the server, and verifies the signed Google ID token (issuer, audience, signature, expiry, nonce, verified email, and subject).
4. The server creates a fresh, opaque `HttpOnly` application session. Only a SHA-256 hash of its random token is stored in `app_sessions`.
5. Every protected page and API request looks up the session and then checks the current, active `admin_members.google_subject` record. A Google sign-in alone never grants CMS access.

Sessions last eight hours, survive a browser refresh, and are invalidated in the database on logout. Production cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and scoped to `/`.

## Required environment variables

Copy `.env.example` to `.env.local` for local development. Put the same values in your hosting provider's server-side environment settings.

| Variable | Purpose | Browser-visible? |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | No |
| `SUPABASE_ANON_KEY` | Server-side public-content reads | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted server database and Storage operations | **Never** |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret | **Never** |
| `GOOGLE_OAUTH_REDIRECT_URI` | Exact Google callback URL | No |

No `NEXT_PUBLIC_*` authentication variables are required. Do not place the Google client secret or Supabase service-role key in a `NEXT_PUBLIC_` variable, source file, or browser configuration.

## Google Cloud Console setup

1. In the intended Google Cloud project, configure the OAuth consent screen. For a testing app, add every editor as a test user; for production, complete the applicable publishing/verification steps.
2. Create an **OAuth client ID** of type **Web application**.
3. Add each exact callback to **Authorized redirect URIs**. For example:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-domain.example/api/auth/google/callback`
4. Set `GOOGLE_OAUTH_REDIRECT_URI` to the one exact callback for the environment being deployed. It must match character-for-character.
5. Add the local and production site origins to **Authorized JavaScript origins** if Google Cloud Console requires origins for the web client (for example, `http://localhost:3000` and `https://your-domain.example`). This server-redirect flow does not load Google's JavaScript in the browser.
6. Copy the client ID and secret to the server environment variables above. Never expose the secret to a client bundle.

## Supabase setup and migration

Apply the SQL files in `supabase/migrations` in timestamp order. Existing projects must apply `20260906000000_replace_supabase_auth_with_google_oauth.sql`; it adds the application-session tables and removes policies that depended on Supabase JWT claims. Also apply `20260906020000_add_cms_taxonomy_and_media.sql`, which adds the tracked media library, atomic post-tag updates, and reliable post update timestamps.

Supabase remains the PostgreSQL and Storage provider. Its role is deliberately limited:

- `anon` may read only published/public content through RLS.
- Browser clients have no direct CMS write policies.
- The application server uses the service-role key only after it validates the session and database allowlist.
- The `cgj-media` bucket is public for serving public cover images; uploads occur only through the protected server endpoint.

## Editorial CMS

The protected `/admin` workspace supports:

- creating, editing, publishing, unpublishing, and deleting journal posts;
- one category and multiple tags per post, with category/tag create, edit, and delete controls;
- server-validated URL slugs, post fields, image URLs, and tag associations;
- image uploads to `cgj-media`, with MIME and file-signature checks, a 5 MB limit, editable alt text, tracked media records, and deletion protection for images still used by an article;
- public journal listings, category/tag filtering, search, individual post metadata, and sitemap entries for published posts.

The media library starts tracking uploads made after the CMS migration. Existing untracked files in the bucket remain usable through their existing URLs, but are not shown in the library until they are uploaded again or manually added to `media_assets`.

After deploying this change, disable unused Supabase Authentication providers/settings in the Supabase dashboard so they cannot be mistaken for a supported sign-in path. The application does not call Supabase Authentication APIs.

### Admin allowlist

`admin_members.google_subject` is the authorization key: it stores the stable Google `sub` value, not a mutable email address. `email` and `display_name` are supporting metadata.

The initial `cgj@nusrlranchi.ac.in` and `ankisha.vandana@nusrlranchi.ac.in` rows are intentionally one-time bootstrap rows with empty `google_subject` values. The first Google sign-in with each verified email binds that row to the account's `sub`. Afterwards, future checks use the stable subject. To authorize another editor, create an active `admin_members` row for the official email with an empty subject; that editor's first verified Google sign-in binds it. Review these bootstrap rows carefully and do not leave stale active rows behind.

Deactivating an allowlist row takes effect immediately on the next protected request, even if that browser still holds an unexpired session.

## Run locally

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000`. Use `npm run typecheck` and `npm run build` before deployment.

## Verification checklist

- Public pages render with no sign-in and published articles remain readable.
- `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/categories`, and `/admin/media` redirect unauthenticated visitors to the Google login page.
- An active allowlisted Google account reaches the dashboard, stays signed in after refresh, and can use protected CMS APIs.
- A Google-authenticated account with no active matching `google_subject` reaches the explicit “Admin access required” page and receives `403` from CMS APIs.
- Logging out invalidates the matching `app_sessions` record and clears the cookie.
- Tampering with client state does not help: routes and API mutations re-check the HTTP-only session and database allowlist server-side. OAuth callbacks require the one-time state cookie/transaction and verified Google ID token.

## Operational notes

Periodically delete expired `oauth_transactions` and expired/invalidated `app_sessions` as routine database housekeeping. Keep the service-role key restricted to the deployment environment, monitor allowlist changes, and maintain a tested database/media backup process.
