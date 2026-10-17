# Pulse

**Live website:** [Open Pulse](https://pulse-market-dashboard-two.vercel.app/)

A crypto and foreign-exchange dashboard with market tables, price history, a currency converter and account-owned watchlists. Built with React, TypeScript, Vinext, Cloudflare Workers, D1 and Better Auth.

## Development

Use Node 22.13 or newer. Run `npm install`, copy `.dev.vars.example` to `.dev.vars`, configure a strong `BETTER_AUTH_SECRET`, and run `npm run dev`. Keep `.dev.vars` out of version control.

Run `npm run check`, `npm run test:core`, `npm run test:auth` and `npm run test:interactions` for the maintained checks. `npm run build` creates the client bundle and Worker deployment.



## Accounts

Email/password accounts use Better Auth. Google sign-in requires both Google OAuth credentials and the matching `/api/auth/callback/google` redirect URL. Email verification and password reset require a configured Resend sender. Unconfigured options remain unavailable. Diagnostics require a verified customer account whose email is in `PULSE_ADMIN_EMAILS`; public visitors cannot open system data.

## Data and credits

The keyless market adapter uses CoinLore. The optional CoinGecko Demo adapter needs a server key. Fiat reference data comes from Frankfurter. Reference quotes can be delayed and unavailable; the interface reports data age and failures. They are not executable trading prices. Vendor links and attribution remain in the interface.
