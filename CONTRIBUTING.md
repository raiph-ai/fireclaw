# Contributing to FireClaw

Thank you for considering contributing to FireClaw! This skill is **community-driven** — your contributions help keep all OpenClaw agents safer.

## How to Contribute

### 1. Report New Injection Patterns

Found a prompt injection that bypasses FireClaw? Help us fix it!

**Steps:**
1. Create a sample file in `tests/injection-samples/`
2. Name it descriptively (e.g., `markdown-code-fence-escape.txt`)
3. Add the injection payload
4. Run the test suite: `npm test`
5. If the pattern isn't detected, add it to `patterns.json`
6. Submit a PR with both the sample and the pattern

**Example PR:**
```
Title: Add detection for markdown code fence injection
Files:
- tests/injection-samples/code-fence-injection.txt (new)
- patterns.json (added pattern: "code_fence_escape")
```

### 2. Report False Positives

Is legitimate content being flagged? Help us tune the patterns!

**Steps:**
1. Open an issue with:
   - The URL or content that was flagged
   - The pattern that matched (from metadata)
   - Why it's a false positive
2. Suggest a fix (optional):
   - More specific regex
   - Different severity weight
   - Bypass rule

We'll review and update patterns to reduce false positives.

### 3. Improve Documentation

Found a typo? Want to clarify something? PRs welcome for:
- `SKILL.md` — Main documentation
- `README.md` — Quick reference
- `examples/usage.mjs` — Usage examples
- Comments in code

### 4. Add Features

Want to implement a new feature? Great! Please:
1. Open an issue first to discuss the approach
2. Keep PRs focused (one feature per PR)
3. Add tests if applicable
4. Update documentation

**High-value contributions:**
- Multimodal sanitization (images, PDFs)
- Physical isolation mode (Docker)
- Canary token detection
- Performance optimizations
- Browser content sanitization

### 5. Suggest Trusted Domains

Should a domain be in the default bypass list? Open an issue with:
- The domain
- Why it's trustworthy (official docs, established reputation, etc.)
- Whether it's universally safe or context-specific

We're conservative with the bypass list — only widely-trusted sources.

## Development Setup

```bash
# Clone the skill (or your fork)
cd skills/fireclaw

# Install dependencies
npm install

# Run tests
npm test

# Run examples
node examples/usage.mjs
```

## Code Style

- Use modern JavaScript (ES modules, async/await)
- Document with JSDoc comments
- Keep functions focused (one responsibility)
- Handle errors gracefully
- Log important events

## Pattern Guidelines

When adding to `patterns.json`:

### Good Patterns
✅ Specific and targeted  
✅ Low false positive rate  
✅ Include examples in test suite  
✅ Document the attack vector  

### Bad Patterns
❌ Too broad (e.g., matching common words)  
❌ High false positive rate  
❌ No test case  
❌ Unclear purpose  

**Example of a good pattern:**
```json
{
  "injection_signatures": {
    "jailbreak_dan": "you are (now )?(DAN|Do Anything Now)",
    "comment": "Detects 'DAN' jailbreak attempt"
  }
}
```

## Testing

Before submitting a PR:

1. **Run the test suite:** `npm test`
2. **Test your change** with real examples
3. **Check for false positives** (test on legitimate content)
4. **Verify performance** (patterns should be fast)

## Commit Messages

Use clear, descriptive commit messages:

```
✅ Good:
- Add pattern for markdown code fence escape
- Fix false positive in homoglyph detection
- Update README with installation instructions

❌ Bad:
- Fix
- Update
- Changes
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** (`feature/new-pattern` or `fix/false-positive`)
3. **Make your changes**
4. **Test thoroughly**
5. **Update CHANGELOG.md** (under "Unreleased")
6. **Submit PR** with clear description

We'll review within a few days and provide feedback.

## Pattern Contribution Checklist

- [ ] Added sample to `tests/injection-samples/`
- [ ] Added pattern to `patterns.json`
- [ ] Pattern has a descriptive name
- [ ] Test suite passes (`npm test`)
- [ ] Pattern detects the sample correctly
- [ ] Tested on legitimate content (no false positives)
- [ ] Updated CHANGELOG.md
- [ ] PR description explains the attack vector

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPLv3).

## Developer Certificate of Origin (DCO)

All contributors must sign off on their commits to certify that they have the right to submit the code under the project's AGPLv3 license.

**Sign off your commits with:**

```bash
git commit -s -m "Your commit message"
```

This adds a "Signed-off-by" line to your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

By signing off, you certify that:

1. The contribution was created in whole or in part by you and you have the right to submit it under the AGPLv3 license; or
2. The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications, whether created in whole or in part by you, under the AGPLv3 license; or
3. The contribution was provided directly to you by some other person who certified (1) or (2) and you have not modified it.
4. You understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information you submit with it, including your sign-off) is maintained indefinitely and may be redistributed consistent with this project or the AGPLv3 license.

For more information, see [developercertificate.org](https://developercertificate.org/).

## Questions?

Open an issue or reach out to the OpenClaw community. We're here to help!

---

**Together we can make AI agents safer for everyone.** 🔥🛡️
