Generate a complete modern mobile app UI design system and screen designs for an AI calorie tracking app called "Snapcal".

Snapcal is a photo-first calorie tracker. The user points their camera at a meal, an AI vision model identifies the food and returns calories plus protein/carbs/fat, and the meal is logged against a personalized daily target generated for them during onboarding. The whole product is one loop: photograph food → see numbers → stay on target.

The app helps users:
- log meals by taking a photo instead of searching a food database
- hit a personalized daily calorie target
- track protein, carbs and fat against daily macro targets
- lose, maintain or gain weight at a chosen pace
- correct the AI when it guesses portions wrong
- keep a daily logging streak
- review any past day, not just today

Design style:
- ultra modern 2026 consumer app aesthetic
- minimalistic, generous whitespace, calm
- light mode first, with a full dark mode variant of every screen
- clean layouts, smooth spacing, premium mobile design
- large friendly numbers — the data is the hero, not the chrome
- rounded corners, soft shadows, subtle depth
- no glassmorphism except optionally on the camera overlay
- food photography treated as the only saturated color on screen
- Apple Health / Apple Fitness level polish, warmer and friendlier
- NOT cluttered, NOT gamified-cartoon, NOT a bodybuilding or macro-nerd spreadsheet
- feels effortless and trustworthy, like logging a meal takes three seconds

Color palette:
- warm off-white / soft paper backgrounds in light mode
- near-black warm charcoal backgrounds in dark mode
- true black primary text, medium warm grey secondary text
- one confident accent for the calorie ring and primary CTAs
- three distinct, muted macro colors for protein / carbs / fat, consistent everywhere they appear
- one soft warning/error tone for failed scans and destructive actions
- premium cards with hairline borders in light mode and elevated surfaces in dark mode
- charts and rings drawn with smooth rounded caps, no gridline clutter

Typography:
- clean geometric sans-serif
- Apple-like hierarchy: oversized bold numerals, tight semibold headings, quiet small caps for labels
- tabular figures for all numbers so values don't jitter as they update
- highly readable at a glance while holding the phone one-handed

Design system to define up front (before the screens):
- color tokens for light and dark, named semantically (background, surface, surface-elevated, text-primary, text-secondary, accent, protein, carbs, fat, danger, border)
- type scale with sizes, weights and line heights
- 4pt spacing scale and corner radius scale
- component library: primary / secondary / ghost buttons, segmented control, text and numeric inputs, unit toggle (metric/imperial), stepper, selection cards, chips, list rows, bottom sheet, modal, toast, skeleton loader, empty state, circular calorie progress ring, horizontal macro bars, horizontal scrolling date strip, meal card
- bottom tab bar: Home and Profile, with a prominent center camera button
- icon style: single-weight rounded line icons

Screens to design:

1. Splash screen
   - Snapcal logo, minimal branding, no spinner

2. Welcome screen
   - short confident headline about photographing food instead of searching for it
   - clean visual: a phone photographing a plate, or a plate resolving into numbers
   - primary "Get started" CTA and a quiet "I already have an account" link

3. Onboarding questionnaire (one question per screen, back arrow + slim progress bar at top, large question, big tap targets, single primary CTA pinned at the bottom)
   - gender selection
   - date of birth (native-feeling wheel picker)
   - height and weight, with a metric/imperial toggle
   - goal: lose weight / maintain / gain weight
   - target weight (slider or wheel, showing the delta from current weight)
   - activity level: sedentary / light / moderate / very active, each with a one-line description
   - pace: how fast per week, with a gentle note when an aggressive pace is chosen
   - diet preference: classic / keto / vegan / vegetarian

4. "Building your plan" screen
   - full-screen AI generation state, calm and confident
   - animated progress with short reassuring status lines
   - takes several seconds on purpose — must not feel broken

5. Plan reveal screen
   - the emotional payoff: big daily calorie number
   - protein / carbs / fat targets as three cards
   - one-line explanation of how the plan was derived
   - a note that targets can be changed later
   - "Let's go" CTA

6. Authentication
   - sign up: continue with Apple, continue with Google (native buttons, no email/password form at all)
   - sign in: the same two buttons
   - one line of small legal text
   - a state showing the plan is saved and waiting for the account

7. Home dashboard — the screen users open ten times a day
   - horizontal scrolling date strip at the top, today selected, past days tappable
   - large circular calorie progress ring showing calories remaining as the primary number
   - three horizontal macro bars for protein / carbs / fat with grams eaten vs target
   - streak indicator (consecutive days logged)
   - "Today's meals" list: photo thumbnail, meal name, time, calories, small macro summary
   - empty state for a day with no meals, inviting the first photo
   - a meal card in the "Analyzing…" state: shimmering skeleton with the thumbnail already visible
   - a meal card in the failed state: "Couldn't identify this" with a retake action
   - state for a past day already complete, and for a future/blocked day

8. Camera capture screen
   - full-bleed live camera preview
   - minimal overlay: subtle framing guide, close button, flash toggle, gallery picker
   - one large shutter button
   - short hint: "Point at your meal"
   - camera permission request screen, and permission-denied screen with a link to settings
   - immediately-after-capture state: the photo frozen with an uploading/analyzing indicator, then dismissing back to Home

9. Meal detail screen
   - large meal photo at the top
   - meal name, time logged, total calories
   - protein / carbs / fat broken out, each editable
   - edit mode: inline numeric fields, save and cancel
   - delete meal, with a confirmation sheet
   - failed-analysis variant: explanation plus retake photo

10. Profile screen
    - name, avatar, current streak, member since
    - current daily targets summarized, with an "edit" affordance
    - edit body stats sheet: height, weight, goal, target weight, activity level, pace, diet preference
    - a subtle state showing targets are being regenerated in the background after an edit
    - units preference (metric/imperial)
    - sign out, and delete account as a quiet destructive row

11. System states to design once and reuse
    - skeleton loaders for the ring, macro bars and meal list
    - offline / no-connection banner
    - generic error state with retry
    - success toast after saving an edit
    - a slow-network variant of the analyzing state

Explicitly do NOT design: paywall or subscription screens, push notification screens, barcode scanning, manual food search or text entry, water tracking, exercise or calories-burned, weight history charts, social or sharing features, XP or level systems, any web or tablet layout.

Design it like a real App Store product that a solo founder shipped and 100k people use daily. Every screen must share the same tokens, spacing and components — one design system, not eleven pretty pictures. Show light mode and dark mode for the key screens (Welcome, Plan reveal, Home, Camera, Meal detail, Profile).

Deliver high quality iPhone-style mockups with realistic safe areas, status bars, home indicators and honest spacing. Prioritize the Home dashboard and the camera-to-result loop — those two are the product.

The UI should feel: effortless, trustworthy, quietly premium, fast, and satisfying enough that logging a meal becomes a habit.
