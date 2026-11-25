# Signing in with Sampoerna University Microsoft accounts

The client asked for sign-in with university accounts. Universities that use
Microsoft 365 manage those accounts in **Microsoft Entra ID** (the cloud
version of Active Directory, formerly called Azure AD). This guide explains
how to add a **"Sign in with Sampoerna University (Microsoft)"** button. It is
not built yet, because it needs the university's IT team to register the app.

## How it works

The website never sees the university password. It uses **OpenID Connect**, the
standard Microsoft uses for single sign-on:

```
User clicks "Sign in with Microsoft"
  → our server redirects to login.microsoftonline.com (the university's Microsoft sign-in page)
  → the user signs in there (with the university's MFA, password reset, etc.)
  → Microsoft redirects back to our server with a one-time code
  → our server exchanges the code for an ID token, checks it came from the university's tenant,
    reads the user's email, finds the matching account in our database, and starts the normal session
```

Roles (Student, Lecturer, Lab Assistant, Academic Registry, Admin) stay in our
database, so nothing else in the system changes.

## What the university's IT team must do

In the **Microsoft Entra admin center** → **App registrations** → **New registration**:

1. **Name:** AI Lab Booking.
2. **Supported account types:** *Accounts in this organizational directory only*
   (single tenant), so only university accounts can sign in.
3. **Redirect URI:** platform *Web*,
   `https://<your-domain>/api/auth/microsoft/callback`. For local testing, also add
   `http://localhost:3001/api/auth/microsoft/callback`.
4. After creating it, note the **Application (client) ID** and **Directory (tenant) ID**.
5. **Certificates & secrets** → **New client secret**; note the value (it is shown only once).
6. **API permissions:** the default delegated `User.Read` plus `openid`, `profile`,
   `email` is enough. Grant admin consent if the tenant requires it.
7. Optional: **Token configuration** → add the optional claim `email` to the ID token.

They then give us the client ID, tenant ID and secret, which go in `.env`:

```
MS_TENANT_ID=...
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_REDIRECT_URI=https://<your-domain>/api/auth/microsoft/callback
```

## What we would change in the code

1. Install Microsoft's library: `npm install @azure/msal-node`.
2. Add `server/routes/microsoft.ts` with two routes, using `ConfidentialClientApplication`
   from `@azure/msal-node` with authority `https://login.microsoftonline.com/<MS_TENANT_ID>`:
   - `GET /api/auth/microsoft/login`: create a random `state` (and PKCE values), save
     them in a short-lived cookie, and redirect to `getAuthCodeUrl(...)` with scopes
     `openid profile email`.
   - `GET /api/auth/microsoft/callback`: check `state`, call `acquireTokenByCode(...)`,
     then read the ID token claims: `tid` must equal `MS_TENANT_ID`; the email comes from
     `preferred_username` (or `email`). Look up that email in the `users` table.
     If found and active, call the existing `startSession(res, user.id)` and redirect
     to `/app/dashboard`. If not found, redirect to `/login` with "Your account is not
     registered; ask the administrator".
3. Add the button to `src/app/pages/LoginPage.tsx`, linking to `/api/auth/microsoft/login`.
4. Decide with the client:
   - **Account creation:** keep the admin registering users (safest, current behaviour),
     or create a Student account automatically the first time someone signs in.
   - **Roles from Microsoft:** IT can define *app roles* (e.g. `Lab.Assistant`) in the
     registration and assign them to people; the `roles` claim in the ID token could
     then set the role instead of the admin.
   - **Local passwords:** once everyone uses Microsoft sign-in, forgot/change password
     is handled by Microsoft (the university's own self-service password reset), and the
     local password sign-in can be turned off except for an emergency admin account.

## Things to know

- It needs **HTTPS** in production; Microsoft rejects plain-HTTP redirect URIs except `localhost`.
- On-premises Active Directory without Entra ID would need AD FS (also OpenID Connect)
  or LDAP instead; most universities on Microsoft 365 already have Entra ID.
- It can only be tested with an app registration in the university's tenant, so it has to
  be done together with the university's IT team.
