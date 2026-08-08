# SORTIO preventive QA hardening – 2026-08-08

Before the SORTIO upload, the local visual/critical/headless QA static server was aligned with the Lesson Hub fix: when explicitly enabled by `qaAppId`, it serves the central AI Studio access/config endpoints from the local harness. Production access control is unchanged.

- Visual evidence consistency: DOM checks now run after screenshot capture, preventing a transient rerender from producing a verdict that disagrees with the saved evidence image.
