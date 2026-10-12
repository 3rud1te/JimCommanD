# Publication verification — 12 October 2026

Checks were run from the new repository copy on an Intel Mac, macOS 26.7.1 (Darwin 25.6.0), using Node 26.7.0 and Apple clang 21.0.0.

| Check | Result |
| --- | --- |
| `npm test` | 32 passed; 0 failed |
| `npm run build:mac` | Web bundle and x86_64 native app built successfully |
| `node --check dist/app.bundle.js` | Passed |
| `file build/JimCommanD.app/Contents/MacOS/JimCommanD` | Mach-O 64-bit executable x86_64 |
| `codesign --verify --deep --strict build/JimCommanD.app` | Passed |
| `plutil -lint build/JimCommanD.app/Contents/Info.plist` | Passed |
| Native receive replay test | Passed |
| Offline AMP probe test | Passed |
| Archived Python protocol tests | 8 passed; 0 failed |
| New documentation relative links | All resolved |
| Publication scan | No matches for the scanned credential formats, personal home paths, email addresses, or non-placeholder MAC addresses; historical ZIP contents included in scan |

The scan is a publication check, not a comprehensive security audit. No live hardware probes, MIDI transmissions, firmware operations, or model writes were performed. A GUI/device smoke test, older-macOS compatibility, the independent archived application variants, and historical release binaries were not revalidated. The repository's CI runs the offline JavaScript/build/Python checks; native tests were run locally.
