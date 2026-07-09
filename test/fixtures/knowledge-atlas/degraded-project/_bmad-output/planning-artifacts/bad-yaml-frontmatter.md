---
title: Bad YAML Frontmatter
status: [unclosed list
invalid: yaml: : here
  bad indent:
---

# Bad YAML Frontmatter Document

This document has malformed YAML frontmatter that should not crash the Atlas.
The scanner/extractor must tolerate parse errors and either omit or note the file.
