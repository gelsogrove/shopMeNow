# 📚 eChatbot Documentation

## Quick Links

- [PRD.md](PRD.md) - Product Requirements Document (specifica completa)
- [testing-policy.md](testing-policy.md) - Tests are specification; changes require approval

---

## 📁 Structure

### `/setup` - Deployment & Configuration
| File | Description |
|------|-------------|
| [production.md](setup/production.md) | Production deployment guide |

### `/architecture` - System Design
| File | Description |
|------|-------------|
| [billing.md](architecture/billing.md) | Billing & subscription flow |
| [blocking.md](architecture/blocking.md) | Customer blocking system |
| [invoice.md](architecture/invoice.md) | Invoice generation service |
| [link-tokens.md](architecture/link-tokens.md) | Secure link tokens reference |
| [multi-agent-flow.md](architecture/multi-agent-flow.md) | LLM multi-agent architecture |
| [storage.md](architecture/storage.md) | File storage (Local/Cloudinary) |
| [support-tickets.md](architecture/support-tickets.md) | Support ticket system |
| [template-system.md](architecture/template-system.md) | Prompt template system |
| [ui-standards.md](architecture/ui-standards.md) | Frontend UI standards |

### `/security` - Security Documentation
| File | Description |
|------|-------------|
| [audit-general.md](security/audit-general.md) | Security audit report |
| [audit-2024-12.md](security/audit-2024-12.md) | December 2024 audit |
| [workspace-isolation.md](security/workspace-isolation.md) | Multi-tenant isolation |

### `/prompts` - LLM Prompts
Agent prompt templates and configurations.

### `/archived` - Historical Documentation

> ⚠️ **WARNING**: This directory contains **completed features, obsolete specs, and historical documentation**.
> 
> - Documents here are **NOT current specifications**
> - Use only for historical reference or understanding past decisions
> - All files have `ARCHIVED` warning headers with status and date
> - For current documentation, see [PRD.md](PRD.md) and `/architecture`

Old specs, completed tasks, and deprecated docs. Kept for reference only.

---

## 📝 Naming Convention

- **Lowercase kebab-case**: `my-document.md`
- **Descriptive names**: `billing.md` not `BILLING_FLOW.md`
- **No prefixes**: No task numbers, no dates in filenames
