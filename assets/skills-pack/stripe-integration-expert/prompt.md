YOU ARE USING THE SKILL "stripe-integration-expert" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Stripe Integration Expert

**Tier:** POWERFUL  
**Category:** Engineering Team  
**Domain:** Payments / Billing Infrastructure

---

## Overview

Implement production-grade Stripe integrations: subscriptions with trials and proration, one-time payments, usage-based billing, checkout sessions, idempotent webhook handlers, customer portal, and invoicing. Covers Next.js, Express, and Django patterns.

---

## Core Capabilities

- Subscription lifecycle management (create, upgrade, downgrade, cancel, pause)
- Trial handling and conversion tracking
- Proration calculation and credit application
- Usage-based billing with metered pricing
- Idempotent webhook handlers with signature verification
- Customer portal integration
- Invoice generation and PDF access
- Full Stripe CLI local testing setup

---

## When to Use

- Adding subscription billing to any web app
- Implementing plan upgrades/downgrades with proration
- Building usage-based or seat-based billing
- Debugging webhook delivery failures
- Migrating from one billing model to another

---

## Subscription Lifecycle State Machine

```
FREE_TRIAL ──paid──► ACTIVE ──cancel──► CANCEL_PENDING ──period_end──► CANCELED
     │                  │                                                    │
     │               downgrade                                            reactivate
     │                  ▼                                                    │
     │             DOWNGRADING ──period_end──► ACTIVE (lower plan)           │
     │                                                                        │
     └──trial_end without payment──► PAST_DUE ──payment_failed 3x──► CANCELED
                                          │
                                     payment_success
                                          │
                                          ▼
                                        ACTIVE

### DB subscription status values:
`trialing | active | past_due | canceled | cancel_pending | paused | unpaid`

---

## Stripe Client Setup

```typescript
// lib/stripe.ts
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true,
  appInfo: {
    name: "myapp",
    version: "1.0.0",
  },
})

// Price IDs by plan (set in env)
export const PLANS = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID!,
    features: ["5 projects", "10k events"],
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    features: ["Unlimited projects", "1M events"],
  },
} as const

---

## Checkout Session (Next.js App Router)

```typescript
// app/api/billing/checkout/route.ts
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getAuthUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { priceId, interval = "monthly" } = await req.json()

  // Get or create Stripe customer
  let stripeCustomerId = user.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: "username-undefined"
      metadata: { userId: user.id },
    })
    stripeCustomerId = customer.id
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId } })
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: user.hasHadTrial ? undefined : 14,
      metadata: { userId: user.id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId: user.id },
  })

  return NextResponse.json({ url: session.url })
}

---

## Subscription Upgrade/Downgrade

```typescript
// lib/billing.ts
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string,
  immediate = false
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const currentItem = subscription.items.data[0]

  if (immediate) {
    // Upgrade: apply immediately with proration
    return stripe.subscriptions.update(subscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "always_invoice",
      billing_cycle_anchor: "unchanged",
    })
  } else {
    // Downgrade: apply at period end, no proration
    return stripe.subscriptions.update(subscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
    })
  }
}

// Preview proration before confirming upgrade
export async function previewProration(subscriptionId: string, newPriceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const prorationDate = Math.floor(Date.now() / 1000)

  const invoice = await stripe.invoices.retrieveUpcoming({
    customer: subscription.customer as string,
    subscription: subscriptionId,
    subscription_items: [{ id: subscription.items.data[0].id, price: newPriceId }],
    subscription_proration_date: prorationDate,
  })
