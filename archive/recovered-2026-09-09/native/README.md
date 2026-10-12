# JimCommanD Intel macOS wrapper

This is an AppKit / WKWebView shell for the bundled offline GUI. It has no MIDI,
Bluetooth, USB, firmware, model-transfer, or hardware-discovery implementation.
It does not start a web server or require Node.js at runtime.

## Build and launch

On an Intel Mac with the Xcode command-line tools installed, first build `gui/dist`
using the GUI's documented build command. The Vite build must use relative asset
URLs (`base: './'`) and bundle all fonts and assets for local use. Then, from the
JimCommanD project directory:

```sh
bash native/build.sh
open JimCommanD.app
```

The compiler targets `x86_64-apple-macosx12.0`. The resulting executable contains
the Intel slice and uses the system AppKit/WebKit frameworks. A target of macOS
12 does not constitute testing on that release; see `verification.json` for the
actual validation host and checks. The script signs the app ad hoc for local
development. It is not Developer ID signed or notarized for distribution.

## Local files and export

The shell loads `Contents/Resources/Web/index.html` and permits file access only
within the bundled Web directory through WKWebView's file loading API. Navigation
outside that directory, remote navigation, and new browser windows are cancelled.
The UI uses standard native file selection panels for HTML file inputs. The page
receives only files chosen by the user; the panel does not enable arbitrary file
system access.

Project export uses a small native message handler:

```js
window.webkit.messageHandlers.exportDraft.postMessage({
  name: 'My-rig.json',
  text: JSON.stringify(project)
});
```

Only the bundled main frame can call this handler. The text must parse as a JSON
object with `schema: 'jimcommand-draft'` and `version: 1`, with a maximum UTF-8 size
of 8 MiB. A native save panel asks for
the destination, and the app writes the JSON atomically. The GUI validates the
project's full schema; the wrapper validates its identity and version. Model binaries
and device transfers do not pass through this handler.

Completion emits `jimcommand-export-result` on `window`, with `event.detail.status`
equal to `saved`, `cancelled`, or `error`. Errors also include `detail.message`.
The GUI must wait for `saved` before claiming that an export succeeded.

Standard Command-Q, Command-H, undo/redo, cut/copy/paste, and select-all menus are
provided. These use the normal macOS responder chain.

## Limits

- This build provides an offline application shell, not a connected pedal editor.
- WKWebView local storage may persist between launches but is not a substitute for
  exported project backups.
- The build script copies the current `gui/dist`; rebuild the shell after GUI edits.
- Native chooser/save-sheet interaction and visual layout require a manual smoke
  test when native UI automation is unavailable.
- Navigation restrictions do not constitute an application sandbox. The audited
  bundled GUI is trusted code; no external web pages should be bundled.
