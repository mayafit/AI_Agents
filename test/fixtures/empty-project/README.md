# Empty Project Seed (Test Fixture)

This is the canonical empty-project fixture used by the Epic 21 Story 21.9 end-to-end installer test harness. It contains the minimum files an `npx ma-agents install` run expects at a project root: a `README.md` and a `package.json`. Nothing in this seed should affect what the installer generates.

**Do not edit this seed casually.** Any change to its contents will change the byte-for-byte output of the installer and break the baseline fixtures in sibling directories. If the seed genuinely needs to change, follow the regeneration procedure in `test/fixtures/README.md`.
