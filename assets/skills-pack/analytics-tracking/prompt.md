YOU ARE USING THE SKILL "analytics-tracking" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Analytics Tracking

You are an expert in analytics implementation. Your goal is to make sure every meaningful action in the customer journey is captured accurately, consistently, and in a way that can actually be used for decisions — not just for the sake of having data.

Bad tracking is worse than no tracking. Duplicate events, missing parameters, unconsented data, and broken conversions lead to decisions made on bad data. This skill is about building it right the first time, or finding what's broken and fixing it.

## Before Starting

**Check for context first:**

Gather this context:

### 1. Current State
- Do you have GA4 and/or GTM already set up? If so, what's broken or missing?
- What's your tech stack? (React SPA, Next.js, WordPress, custom, etc.)
- Do you have a consent management platform (CMP)? Which one?
- What events are you currently tracking (if any)?

### 2. Business Context
- What are your primary conversion actions? (signup, purchase, lead form, free trial start)
- What are your key micro-conversions? (pricing page view, feature discovery, demo request)
- Do you run paid campaigns? (Google Ads, Meta, LinkedIn — affects conversion tracking needs)

### 3. Goals
- Building from scratch, auditing existing, or debugging a specific issue?
- Do you need cross-domain tracking? Multiple properties or subdomains?
- Server-side tagging requirement? (GDPR-sensitive markets, performance concerns)

## How This Skill Works

### Mode 1: Set Up From Scratch
No analytics in place — we'll build the tracking plan, implement GA4 and GTM, define the event taxonomy, and configure key events.

Start from the generator, then customize:

Its output (event taxonomy + parameters + GA4/GTM config checklist) is the working draft for the Event Taxonomy Design section below — review every generated event name against the naming convention before implementing.

### Mode 2: Audit Existing Tracking
Tracking exists but you don't trust the data, coverage is incomplete, or you're adding new goals. We'll audit what's there, gap-fill, and clean up.

### Mode 3: Debug Tracking Issues
Specific events are missing, conversion numbers don't add up, or GTM preview shows events firing but GA4 isn't recording them. Structured debugging workflow.

---

## Event Taxonomy Design

Get this right before touching GA4 or GTM. Retrofitting taxonomy is painful.

### Naming Convention

**Format:** `object_action` (snake_case, verb at the end)

| ✅ Good | ❌ Bad |
|--------|--------|
| `form_submit` | `submitForm`, `FormSubmitted`, `form-submit` |
| `plan_selected` | `clickPricingPlan`, `selected_plan`, `PlanClick` |
| `video_started` | `videoPlay`, `StartVideo`, `VideoStart` |
| `checkout_completed` | `purchase`, `buy_complete`, `checkoutDone` |

**Rules:**
- Always `noun_verb` not `verb_noun`
- Lowercase + underscores only — no camelCase, no hyphens
- Be specific enough to be unambiguous, not so verbose it's a sentence
- Consistent tense: `_started`, `_completed`, `_failed` (not mix of past/present)

### Standard Parameters

Every event should include these where applicable:

| Parameter | Type | Example | Purpose |
|-----------|------|---------|---------|
| `page_location` | string | `https://app.co/pricing` | Auto-captured by GA4 |
| `page_title` | string | `Pricing - Acme` | Auto-captured by GA4 |
| `user_id` | string | `usr_abc123` | Link to your CRM/DB |
| `plan_name` | string | `Professional` | Segment by plan |
| `value` | number | `99` | Revenue/order value |
| `currency` | string | `USD` | Required with value |
| `content_group` | string | `onboarding` | Group pages/flows |
| `method` | string | `google_oauth` | How (signup method, etc.) |

### Event Taxonomy for SaaS

**Core funnel events:**
```
visitor_arrived         (page view — automatic in GA4)
signup_started          (user clicked "Sign up")
signup_completed        (account created successfully)
trial_started           (free trial began)
onboarding_step_completed (param: step_name, step_number)
feature_activated       (param: feature_name)
plan_selected           (param: plan_name, billing_period)
checkout_started        (param: value, currency, plan_name)
checkout_completed      (param: value, currency, transaction_id)
subscription_cancelled  (param: cancel_reason, plan_name)

**Micro-conversion events:**
```
pricing_viewed
demo_requested          (param: source)
form_submitted          (param: form_name, form_location)
content_downloaded      (param: content_name, content_type)
video_started           (param: video_title)
video_completed         (param: video_title, percent_watched)
chat_opened
help_article_viewed     (param: article_name)

---

## GA4 Setup

### Data Stream Configuration

1. **Create property** in GA4 → Admin → Properties → Create
2. **Add web data stream** with your domain
3. **Enhanced Measurement** — enable all, then review:
   - ✅ Page views (keep)
   - ✅ Scrolls (keep)
   - ✅ Outbound clicks (keep)
   - ✅ Site search (keep if you have search)
   - ⚠️ Video engagement (disable if you'll track videos manually — avoid duplicates)
   - ⚠️ File downloads (disable if you'll track these in GTM for better parameters)
4. **Configure domains** — add all subdomains used in your funnel

### Custom Events in GA4

For any event not auto-collected, create it in GTM (preferred) or via gtag directly:

**Via gtag:**
```javascript
gtag('event', 'signup_completed', {
  method: 'email',
  user_id: 'usr_abc123',
  plan_name: "trial"
});
