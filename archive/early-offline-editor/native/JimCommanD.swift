import AppKit
import UniformTypeIdentifiers
import WebKit

// A local document workspace. Hardware access deliberately belongs to a future,
// separately validated backend, not to this web view.
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate,
                         WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var webRoot: URL!
    private var exportInProgress = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        guard let resources = Bundle.main.resourceURL else {
            showLaunchError("The application resources are missing.")
            return
        }
        webRoot = resources.appendingPathComponent("Web", isDirectory: true)
            .resolvingSymlinksInPath().standardizedFileURL
        let entry = webRoot.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: entry.path) else {
            showLaunchError("The bundled GUI is missing. Run native/build.sh after building gui/dist.")
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "exportDraft")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "JimCommanD — Offline Workspace"
        window.minSize = NSSize(width: 1000, height: 680)
        window.collectionBehavior.insert(.canJoinAllSpaces)
        window.contentView = webView
        webView.loadFileURL(entry, allowingReadAccessTo: webRoot)
        showMainWindow(reposition: true)
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        showMainWindow()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication,
                                       hasVisibleWindows flag: Bool) -> Bool {
        showMainWindow()
        return true
    }

    private func showMainWindow(reposition: Bool = false) {
        guard window != nil else { return }
        if reposition, let visible = NSScreen.main?.visibleFrame {
            let width = min(CGFloat(1320), visible.width)
            let height = min(CGFloat(860), visible.height)
            let frame = NSRect(x: visible.midX - width / 2,
                               y: visible.midY - height / 2,
                               width: width, height: height)
            window.setFrame(frame, display: true)
        }
        window.deminiaturize(nil)
        window.alphaValue = 1
        window.isOpaque = true
        window.level = .normal
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.unhide(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func isBundled(_ url: URL?) -> Bool {
        guard let url, url.isFileURL, let root = webRoot else { return false }
        let path = url.resolvingSymlinksInPath().standardizedFileURL.path
        return path == root.path || path.hasPrefix(root.path + "/")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(isBundled(navigationAction.request.url) ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // No external windows or implicit browser handoff from the bundled GUI.
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard isBundled(frame.request.url), let parentWindow = webView.window else {
            completionHandler(nil)
            return
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: parentWindow) { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "exportDraft", message.frameInfo.isMainFrame,
              isBundled(message.frameInfo.request.url), !exportInProgress else { return }
        guard let body = message.body as? [String: Any],
              let text = body["text"] as? String,
              let data = text.data(using: .utf8), data.count <= 8 * 1024 * 1024,
              let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              parsed["schema"] as? String == "jimcommand-draft",
              let version = parsed["version"] as? NSNumber,
              CFGetTypeID(version) != CFBooleanGetTypeID(), version.doubleValue == 1 else {
            exportResult("error", message: "Export requires a version 1 JimCommanD draft no larger than 8 MiB.")
            return
        }
        var filename = ((body["name"] as? String) ?? "JimCommanD-project.json")
            .components(separatedBy: CharacterSet(charactersIn: "/\\:").union(.controlCharacters))
            .joined(separator: "-")
        filename = String(filename.prefix(160))
        if filename.isEmpty { filename = "JimCommanD-project.json" }
        if !filename.lowercased().hasSuffix(".json") { filename += ".json" }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.allowsOtherFileTypes = false
        panel.nameFieldStringValue = filename
        panel.title = "Export JimCommanD project"
        panel.message = "Save the offline project as JSON. This does not write to the pedal."
        exportInProgress = true
        panel.beginSheetModal(for: window) { [weak self] result in
            guard let self else { return }
            self.exportInProgress = false
            guard result == .OK, let target = panel.url else {
                self.exportResult("cancelled")
                return
            }
            do {
                try data.write(to: target, options: .atomic)
                self.exportResult("saved")
            } catch {
                self.exportResult("error", message: error.localizedDescription)
            }
        }
    }

    private func exportResult(_ status: String, message: String? = nil) {
        var detail = ["status": status]
        if let message { detail["message"] = message }
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('jimcommand-export-result', {detail: \(json)}));")
    }

    private func installMenu() {
        let main = NSMenu()
        let appMenu = NSMenu(title: "JimCommanD")
        appMenu.addItem(withTitle: "About JimCommanD", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide JimCommanD", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit JimCommanD", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let appItem = NSMenuItem()
        appItem.submenu = appMenu
        main.addItem(appItem)

        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let editItem = NSMenuItem()
        editItem.submenu = edit
        main.addItem(editItem)
        NSApp.mainMenu = main
    }

    private func showLaunchError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "JimCommanD could not start"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
