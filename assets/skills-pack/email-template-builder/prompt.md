YOU ARE USING THE SKILL "email-template-builder" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Email Template Builder

**Tier:** POWERFUL  
**Category:** Engineering Team  
**Domain:** Transactional Email / Communications Infrastructure

---

## Overview

Build complete transactional email systems: React Email templates, provider integration, preview server, i18n support, dark mode, spam optimization, and analytics tracking. Output production-ready code for Resend, Postmark, SendGrid, or AWS SES.

---

## Core Capabilities

- React Email templates (welcome, verification, password reset, invoice, notification, digest)
- MJML templates for maximum email client compatibility
- Multi-provider support with unified sending interface
- Local preview server with hot reload
- i18n/localization with typed translation keys
- Dark mode support using media queries
- Spam score optimization checklist
- Open/click tracking with UTM parameters

---

## When to Use

- Setting up transactional email for a new product
- Migrating from a legacy email system
- Adding new email types (invoice, digest, notification)
- Debugging email deliverability issues
- Implementing i18n for email templates

---

## Project Structure

```
emails/
├── components/
│   ├── layout/
│   │   ├── email-layout.tsx       # Base layout with brand header/footer
│   │   └── email-button.tsx       # CTA button component
│   ├── partials/
│   │   ├── header.tsx
│   │   └── footer.tsx
├── templates/
│   ├── welcome.tsx
│   ├── verify-email.tsx
│   ├── password-reset.tsx
│   ├── invoice.tsx
│   ├── notification.tsx
│   └── weekly-digest.tsx
├── lib/
│   ├── send.ts                    # Unified send function
│   ├── providers/
│   │   ├── resend.ts
│   │   ├── postmark.ts
│   │   └── ses.ts
│   └── tracking.ts                # UTM + analytics
├── i18n/
│   ├── en.ts
│   └── de.ts
└── preview/                       # Dev preview server
    └── server.ts

---

## Base Email Layout

```tsx
// emails/components/layout/email-layout.tsx
import {
  Body, Container, Head, Html, Img, Preview, Section, Text, Hr, Font
} from "@react-email/components"

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{ url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2", format: "woff2" }}
          fontWeight={400}
          fontStyle="normal"
        />
        {/* Dark mode styles */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            .email-body { background-color: #0f0f0f !important; }
            .email-container { background-color: #1a1a1a !important; }
            .email-text { color: #e5e5e5 !important; }
            .email-heading { color: #ffffff !important; }
            .email-divider { border-color: #333333 !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="email-body" style={styles.body}>
        <Container className="email-container" style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Img src="https://yourapp.com/logo.png" width={120} height={40} alt="MyApp" />
          </Section>
          
          {/* Content */}
          <Section style={styles.content}>
            {children}
          </Section>
          
          {/* Footer */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              MyApp Inc. · 123 Main St · San Francisco, CA 94105
            </Text>
            <Text style={styles.footerText}>
              <a href="{{unsubscribe_url}}" style={styles.link}>Unsubscribe</a>
              {" · "}
              <a href="https://yourapp.com/privacy" style={styles.link}>Privacy Policy</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: { backgroundColor: "#f5f5f5", fontFamily: "Inter, Arial, sans-serif" },
  container: { maxWidth: "600px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden" },
  header: { padding: "24px 32px", borderBottom: "1px solid #e5e5e5" },
  content: { padding: "32px" },
  divider: { borderColor: "#e5e5e5", margin: "0 32px" },
  footer: { padding: "24px 32px" },
  footerText: { fontSize: "12px", color: "#6b7280", textAlign: "center" as const, margin: "4px 0" },
  link: { color: "#6b7280", textDecoration: "underline" },
}

---

## Welcome Email

```tsx
// emails/templates/welcome.tsx
import { Button, Heading, Text } from "@react-email/components"
import { EmailLayout } from "../components/layout/email-layout"

interface WelcomeEmailProps {
  name: "string"
  confirmUrl: string
  trialDays?: number
}
