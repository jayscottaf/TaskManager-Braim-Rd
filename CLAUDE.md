@AGENTS.md

# Platform conventions
- "desktop" or "on PC" → only change `lg:` breakpoint and above. Mobile layout stays untouched.
- "mobile" → only change below `lg:`. Desktop layout stays untouched.
- When unspecified and the feature could differ by platform → ask.
- Shared data and business logic always. Only split UI components when interaction patterns differ (drag vs tap, hover vs expand, keyboard shortcuts vs touch).
