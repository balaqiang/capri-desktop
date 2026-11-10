YOU ARE USING THE SKILL "ms365-tenant-manager" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Microsoft 365 Tenant Manager

Expert guidance and automation for Microsoft 365 Global Administrators managing tenant setup, user lifecycle, security policies, and organizational optimization.

---

## Workflows

### Workflow 1: New Tenant Setup

**Step 1: Generate Setup Checklist**

Confirm prerequisites before provisioning:
- Global Admin account created and secured with MFA
- Custom domain purchased and accessible for DNS edits
- License SKUs confirmed (E3 vs E5 feature requirements noted)

**Step 2: Configure and Verify DNS Records**

Wait for DNS propagation (up to 48 h) before bulk user creation.

**Step 3: Apply Security Baseline**

**Step 4: Provision Users**

**Validation:** Spot-check 3–5 accounts in the M365 admin portal; confirm licenses show "Active."

---

### Workflow 2: Security Hardening

**Step 1: Run Security Audit**

**Step 2: Create MFA Policy (report-only first)**

**Validation:** After 48 h, review Sign-in logs in Entra ID; confirm expected users would be challenged, then change `State` to `"enabled"`.

**Step 3: Review Secure Score**

---

### Workflow 3: User Offboarding

**Step 1: Block Sign-in and Revoke Sessions**

**Step 2: Preview with -WhatIf (license removal)**

**Step 3: Execute Offboarding**

**Validation:** Confirm in the M365 admin portal that the account shows "Blocked," has no active licenses, and the mailbox type is "Shared."

---

## Best Practices

### Tenant Setup

1. Enable MFA before adding users
2. Configure named locations for Conditional Access
3. Use separate admin accounts with PIM
4. Verify custom domains (and DNS propagation) before bulk user creation
5. Apply Microsoft Secure Score recommendations

### Security Operations

1. Start Conditional Access policies in report-only mode
2. Review Sign-in logs for 48 h before enforcing a new policy
3. Never hardcode credentials in scripts — use Azure Key Vault or `Get-Credential`
4. Enable unified audit logging for all operations
5. Conduct quarterly security reviews and Secure Score check-ins

### PowerShell Automation

1. Prefer Microsoft Graph (`Microsoft.Graph` module) over legacy MSOnline
2. Include `try/catch` blocks for error handling
3. Implement `Write-Host`/`Write-Warning` logging for audit trails
4. Use `-WhatIf` or dry-run output before bulk destructive operations
5. Test in a non-production tenant first

---

## Limitations

| Constraint | Impact |
|------------|--------|
| Global Admin required | Full tenant setup needs highest privilege |
| API rate limits | Bulk operations may be throttled |
| License dependencies | E3/E5 required for advanced features |
| Hybrid scenarios | On-premises AD needs additional configuration |
| PowerShell prerequisites | Microsoft.Graph module required |

### Required PowerShell Modules

### Required Permissions

- **Global Administrator** — Full tenant setup
- **User Administrator** — User management
- **Security Administrator** — Security policies
- **Exchange Administrator** — Mailbox management
