# FireClaw Threat Intelligence Dataset Terms

The FireClaw Threat Intelligence Dataset ("Dataset") is a collection of domain reputation data, injection pattern signatures, and threat reports contributed by opt-in FireClaw community members. The Dataset is separate from the FireClaw software and is governed by these terms, not the AGPLv3 license.

## Data Collection Transparency

### What We Collect (opt-in only)
- Domain names where injection patterns were detected
- Pattern type (e.g., "prompt_injection", "data_exfiltration")
- Severity level
- Timestamp
- Anonymous instance identifier (cryptographic hash — not reversible to identity)

### What We Do NOT Collect
- Web page content or text
- User queries or prompts
- Personal information of any kind
- IP addresses of FireClaw instances
- Browsing history or fetch URLs beyond the flagged domain

### Opt-In Only
Data sharing is **disabled by default**. Users must explicitly enable it in FireClaw Settings. Users can disable sharing at any time.

### Retention
- Active threat data: retained as long as it remains relevant to the community feed
- Stale data (no new reports in 180 days): archived and removed from active feeds
- Users may request deletion of data associated with their anonymous instance ID

---

## Community Feed (Free Tier)

The Community Feed is available to all FireClaw users at no cost.

- **Access:** Public REST API, rate-limited
- **Rate Limit:** 100 requests per hour per IP
- **Update Frequency:** Updated every 6 hours (delayed from real-time)
- **Data:** Domain blocklist, pattern signatures, basic reputation scores
- **Attribution Required:** If you use Community Feed data in a product or publication, you must credit "FireClaw Threat Intelligence (fireclaw.app)"
- **No Bulk Redistribution:** You may not redistribute the full dataset. You may share individual entries for security research or incident response.

## Commercial Feed (Paid Tier — Future)

For organizations needing real-time, high-fidelity threat data:

- **Access:** Authenticated API, higher rate limits
- **Update Frequency:** Real-time (as reports arrive)
- **Data:** Enriched metadata, confidence scores, source diversity metrics, historical trends
- **SLA:** Uptime and response time guarantees
- **Redistribution:** Negotiable per agreement
- **Pricing:** Contact fireclaw@scarwear.com

---

## Abuse Policy

### False Reports
FireClaw uses confidence scoring based on report volume, source diversity, and pattern consistency. Single reports from a single instance do not result in blocklisting. Deliberate false reporting may result in instance API key revocation.

### Appeals Process
If your domain has been flagged and you believe it is in error:
1. Check your domain's reputation at fireclaw.app
2. Submit an appeal via the dashboard or email fireclaw@scarwear.com
3. Appeals are reviewed within 5 business days
4. If upheld, the domain is removed from the blocklist and flagged as reviewed

### Disclaimer
Domains in the FireClaw Dataset are **reported as suspicious based on automated detection**. Inclusion in the dataset does not constitute a definitive determination that a domain is malicious. FireClaw provides this data "as is" for security research and protection purposes. Users should apply their own judgment and additional verification.

---

## Changes to These Terms

These terms may be updated from time to time. Material changes will be announced via the FireClaw website and GitHub repository. Continued use of the Dataset after changes constitutes acceptance.

---

*Last updated: February 2026*
*Contact: fireclaw@scarwear.com*
