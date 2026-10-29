<h1 align="center">Full-Stack Cal AI Clone</h1>

![Demo App](/assets/images/screenshot-for-readme.png)

✨ **Highlights:**

- 📱 Build and Launch a Real AI Calorie Tracker App
- 📸 Analyze Meals from Photos with OpenAI
- ⚛️ React Native and Expo for iOS and Android
- 🔐 Google and Apple Sign-In with Clerk
- 🗄️ PostgreSQL Database with Neon
- ⚡ Background AI Jobs and Automatic Retries with Trigger.dev
- 🔄 Real-Time Calorie and Macro Updates
- 🖼️ Image Storage and Optimization with ImageKit
- 🐞 Error Tracking and AI Code Reviews with Sentry
- 🎨 Generate App Designs, Mockups, and a Landing Page with AI
- 🌐 Create Privacy Policy, Terms, and Support Pages
- 🍎 Prepare and Publish the App to the App Store
- 🤖 Create AI Influencers for TikTok and Instagram Marketing
- ✅ Follow a Structured AI Workflow

---

# 🧪 `.env` Setup

Create a `.env` file in the **root of the project** and add the following variables:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
DATABASE_URL=
TRIGGER_SECRET_KEY=
OPENAI_API_KEY=
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_SECRET_KEY=
IMAGEKIT_URL_ENDPOINT=
SENTRY_AUTH_TOKEN=
```

---

## 🔧 Run the App

```bash
npm install
npx expo run:ios
```

or

```bash
npx expo run:android
```

## 📱 Features Overview

### 🔐 Authentication

Users must sign in before using the app.

Supported authentication options:

- Google Sign-In
- Apple Sign-In

Authentication is handled using Clerk, making the login flow production-ready and easy to extend later.

### 🌐 Web Pages

The project also includes App Store-ready web pages:

- Landing page
- Privacy policy
- Terms of service
