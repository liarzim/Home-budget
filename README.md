# Multi-Tenant Household Budget Management System

A high-performance, clean and light **Multi-Tenant Household Budget Management** application built with **React + Vite** (optimized for **Vercel** deployment and **Android APK** packaging via Capacitor) and powered by **Supabase** with strict **Row Level Security (RLS)** tenant isolation.

---

## 🌟 Key Architecture & Features

### 1. Multi-Tenant Architecture & Data Isolation
- **PostgreSQL Row Level Security (RLS)**: Data across households is strictly isolated at the database engine level. Users can only read, insert, update, and delete records belonging to households where they hold an active membership (`public.household_members`).
- **Security Definer Helpers**: High-performance functions (`get_user_households(auth.uid())`, `is_household_admin(...)`) prevent recursive policy evaluations.
- **Automated Signup Trigger**: When a user registers via Social OAuth (Google, Apple, GitHub) or Email, a PostgreSQL trigger automatically initializes their user profile, creates their private tenant Household, assigns them as `owner`, and seeds essential categories and Israeli/international merchant auto-categorization rules.

### 2. Required Database Tables
All tables are defined in [`supabase/schema.sql`](./supabase/schema.sql):
1. **`Households`**: Tenant management container for all household transactions, categories, and budgets.
2. **`Profiles` / `Users`**: User metadata linked 1:1 with Supabase Auth (`auth.users`).
3. **`Household_Members`**: Multi-tenant membership and roles (`owner`, `admin`, `member`, `viewer`).
4. **`Categories`**: Expense and income categories with custom colors, icons, and hierarchy.
5. **`Business_Mapping`**: Auto-categorization rules mapping merchant name patterns (e.g., `SHUFERSAL`, `PAZ`, `NETFLIX`, `SUPER-PHARM`) to category IDs.
6. **`Transactions`**: Central ledger with date, amount, category ID, transaction type (`expense`, `income`, `transfer`), payee name, and a boolean **`is_hidden`** flag for soft deletes / reversible archiving.
7. **`Budgets`**: Strict monthly and yearly budgets per category with real-time spend vs limit progress tracking.
8. **`Savings`**: Opening and closing balances per calendar year across banking institutions and investment funds.

---

## 🚀 Running the Web App

### 1. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 2. Deploy to Vercel
This project is pre-configured with [`vercel.json`](./vercel.json):
1. Push your repository to GitHub / GitLab.
2. Go to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import this repository (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Add your Supabase environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
5. Click **Deploy**!

---

## 📱 Building the Android APK File

The app includes **Capacitor** integration to package the web build into a standalone Android APK:

```bash
# 1. Initialize Android platform (one-time)
npx cap add android

# 2. Build web bundle and sync to Android
npm run cap:sync

# 3. Open in Android Studio to build APK or run directly
npx cap open android
# In Android Studio: Build -> Build Bundle(s) / APK(s) -> Build APK(s)

# Or build directly via command line:
cd android
./gradlew assembleDebug
# The APK file will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🗄️ Database Setup (Supabase)

1. Open your [Supabase Dashboard](https://supabase.com) and navigate to **SQL Editor** -> **New Query**.
2. Copy and paste the entire script from [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
3. Under **Authentication** -> **Providers**, enable your desired OAuth providers:
   - **Google**: Add OAuth Client ID & Secret.
   - **Apple**: Add Services ID & Private Key.
   - **GitHub**: Add OAuth App Client ID & Secret.
4. Add your redirect URLs:
   - Local: `http://localhost:3000`
   - Production: `https://your-app.vercel.app`
5. Copy your **Project URL** and **anon public key** into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 📂 Project Structure

```
.
├── vercel.json                 # Vercel deployment rewrite rules
├── vite.config.ts              # Vite bundler configuration
├── capacitor.config.ts         # Android APK packaging configuration
├── package.json                # Dependencies and build scripts
├── index.html                  # HTML entry with Plus Jakarta Sans & JetBrains Mono
├── .env.example                # Supabase environment variables template
├── supabase/
│   └── schema.sql              # Complete PostgreSQL schema with RLS & onboarding triggers
└── src/
    ├── main.tsx                # React root entry
    ├── App.tsx                 # Main application view container
    ├── index.css               # Clean, light design system and token styling
    ├── context/
    │   └── AuthContext.tsx     # Supabase Auth, OAuth handlers & Multi-tenant state
    ├── lib/
    │   ├── supabase.ts         # Supabase client with OAuth redirect support
    │   ├── types.ts            # TypeScript definitions for all 7 tables & domain models
    │   └── mockData.ts         # Interactive seed data for preview & setup mode
    └── components/
        ├── LandingHero.tsx     # Clean light landing page with OAuth sign-in buttons
        ├── Header.tsx          # Navbar with tenant switcher, user profile & modal
        ├── KPICards.tsx        # Income, Expense, Cash Flow, and Budget Usage KPIs
        ├── TransactionsView.tsx# Ledger with soft-delete (is_hidden toggle) & auto-mapping
        ├── BudgetsView.tsx     # Strict monthly & yearly category progress bars
        ├── SavingsView.tsx     # Calendar-year opening/closing balance tracker
        ├── BusinessMappingView.tsx # Merchant auto-categorization rule manager
        └── SchemaViewer.tsx    # Live SQL schema inspector and 1-click copy tool
```
