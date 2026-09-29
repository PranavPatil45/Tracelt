# Tracelt — Landing Page

A premium, dark-themed landing page for Tracelt, a smart lost & found portal.
Built with React + Vite, plain CSS (no framework), and `lucide-react` icons.

## Getting started

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Routes

- `/` — the landing page
- `/login` — the login page (split-screen brand panel + form)
- `/signup` — the create-account page (same brand panel + longer form)

`Log In` and `Get Started` in the navbar both link to `/login`. The login
card's "Create an account" link goes to `/signup`; "Sign in" on the signup
page goes back to `/login`. Successful signup lands on a success screen that
links to (and auto-redirects to) `/dashboard`, which isn't built yet — add
that route when the dashboard exists.

## Structure

```
src/
  App.jsx                  router: "/" -> LandingPage, "/login" -> LoginPage, "/signup" -> SignupPage
  index.css                design tokens, resets, shared utility classes
  hooks/useReveal.js       scroll-reveal intersection observer hook
  api/auth.js              real fetch wrappers for POST /login and POST /register (no mock auth)
  data/campuses.js         sample campus/department lists — swap for a real endpoint
  pages/
    LandingPage.jsx        assembles all landing sections
    LoginPage.jsx           AuthLayout + LoginForm
    SignupPage.jsx          AuthLayout + SignupForm
  components/
    Navbar.jsx / .css
    Hero.jsx / .css        signature "trace" visual (lost → match → found)
    Stats.jsx / .css       animated counters
    HowItWorks.jsx / .css
    Features.jsx / .css
    ProductPreview.jsx / .css   mock dashboard / item feed
    EmotionalCTA.jsx / .css
    Community.jsx / .css
    FAQ.jsx / .css          accordion
    FinalCTA.jsx / .css
    Footer.jsx / .css
    auth/
      AuthLayout.jsx / .css       shared split-screen layout used by Login and Signup
      BrandPanel.jsx / .css       left panel: journey visual (Lost→Traced→Matched→Reconnected)
      LoginForm.jsx / .css        validation, loading state, error display
      SignupForm.jsx / .css       longer form: name, email, password, confirm, campus, department, terms
      SignupSuccess.jsx / .css    post-registration success state
      PasswordStrength.jsx        live requirement checklist + strength meter
      CampusSelect.jsx            searchable dropdown, shares field styling
      InputField.jsx
      PasswordInput.jsx           adds the show/hide toggle; accepts children (used for PasswordStrength)
      SocialLoginButton.jsx       Google-branded button, reused by both forms
```

## Connecting the forms to FastAPI

`src/api/auth.js` has real (not mocked) fetch wrappers for both endpoints.
Point them at your backend:

```bash
# .env
VITE_API_BASE_URL=https://your-api.example.com
```

- `loginUser({ email, password, remember })` → `POST {base}/login`
  Expects `{ access_token, user }` on success, `{ detail }` on failure.
- `registerUser({ fullName, email, password, campus, department })` → `POST {base}/register`
  Sends `{ full_name, email, password, campus, department }`. Expects
  `{ access_token, user }` on success (201), `{ detail }` on failure — a 409
  is treated as "email already registered".

Both `LoginForm.jsx` and `SignupForm.jsx` have a `// TODO` where you should
persist the token and redirect to your dashboard route once you have one.
`src/data/campuses.js` is sample data — replace it with a real campus/department
list from your backend when that endpoint exists.

## Design tokens

Defined in `src/index.css` under `:root`:
- `--bg-primary` / `--bg-elevated` — deep navy/charcoal backgrounds
- `--cyan` / `--violet` — signal accents (electric cyan-blue, violet)
- `--font-display` (Space Grotesk), `--font-body` (Inter), `--font-mono` (IBM Plex Mono for data/labels/status)

Fonts are loaded via Google Fonts `<link>` tags in `index.html`.
