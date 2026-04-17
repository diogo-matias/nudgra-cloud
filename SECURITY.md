# Security Policy

## Supported Versions

This project is still pre-1.0. Security fixes are only supported for the latest
state of the main development branch and the latest deployed version.

| Version | Supported |
| --- | --- |
| latest `develop` | yes |
| older commits, forks, and custom deployments | no |

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting feature from the repository's
   Security tab if it is enabled.
2. If private reporting is not available, contact the maintainer privately
   through GitHub before disclosing details publicly.

Include:

- a clear description of the issue
- steps to reproduce
- affected routes, modules, or environments
- any proof-of-concept details that help confirm impact

## What Counts as Sensitive

This repository touches authentication, OAuth callbacks, webhook ingestion,
tracked links, and token-backed integrations. Please report issues privately if
they involve:

- auth bypass
- token leakage
- webhook forgery
- privilege escalation
- secret exposure
- remote code execution
- account takeover

## Response Expectations

The project aims to acknowledge reports within 7 days and follow up with a fix
or mitigation plan as soon as practical. Coordinated disclosure is appreciated.
