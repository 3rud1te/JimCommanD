#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import "MosaicMidi.h"

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler>
@property NSWindow *window;
@property WKWebView *webView;
@property MosaicMidi *midi;
@property NSURL *indexURL;
@end

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = NO;
    self.midi = [MosaicMidi new];
    __weak AppDelegate *weakSelf = self;
    self.midi.eventHandler = ^(NSDictionary *event) {
        AppDelegate *strongSelf = weakSelf;
        if (!strongSelf) return;
        NSData *json = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
        NSString *text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
        [strongSelf.webView evaluateJavaScript:[NSString stringWithFormat:@"window.__mosaicEvent && window.__mosaicEvent(%@)", text] completionHandler:nil];
    };
    [configuration.userContentController addScriptMessageHandler:self name:@"mosaic"];

    self.webView = [[WKWebView alloc] initWithFrame:NSMakeRect(0, 0, 1180, 800) configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;
    self.webView.allowsMagnification = YES;

    NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                              NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable;
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1180, 800)
                                             styleMask:style backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"JimCommanD";
    self.window.minSize = NSMakeSize(900, 680);
    self.window.contentView = self.webView;
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    NSURL *webRoot = [[NSBundle mainBundle].resourceURL URLByAppendingPathComponent:@"web" isDirectory:YES];
    NSURL *index = [webRoot URLByAppendingPathComponent:@"index.html"];
    self.indexURL = index;
    [self.webView loadFileURL:index allowingReadAccessToURL:webRoot];
}

- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    if (!message.frameInfo.mainFrame || ![message.frameInfo.request.URL.URLByStandardizingPath isEqual:self.indexURL.URLByStandardizingPath]) return;
    if (![message.body isKindOfClass:NSDictionary.class]) return;
    NSDictionary *body = message.body;
    NSNumber *requestId = body[@"id"];
    NSString *action = body[@"action"];
    if (![requestId isKindOfClass:NSNumber.class] || ![action isKindOfClass:NSString.class]) return;
    MosaicReply reply = ^(NSDictionary *result, NSString *error) {
        NSDictionary *payload = @{@"id": requestId, @"result": result ?: @{}, @"error": error ?: NSNull.null};
        NSData *json = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
        NSString *text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
        [self.webView evaluateJavaScript:[NSString stringWithFormat:@"window.__mosaicReply && window.__mosaicReply(%@)", text] completionHandler:nil];
    };
    if ([action isEqualToString:@"connect"]) [self.midi connect:reply];
    else if ([action isEqualToString:@"disconnect"]) { [self.midi disconnect]; reply(@{}, nil); }
    else if ([action isEqualToString:@"readSlot"]) {
        NSNumber *slot = body[@"slot"];
        if (![slot isKindOfClass:NSNumber.class] || slot.doubleValue < 0 || slot.doubleValue > 29 || slot.doubleValue != slot.integerValue) { reply(nil, @"Invalid slot."); return; }
        [self.midi readSlot:slot.unsignedIntegerValue reply:reply];
    } else if ([action isEqualToString:@"sendControlChange"]) {
        NSNumber *controllerNumber = body[@"controller"], *valueNumber = body[@"value"];
        BOOL valid = [controllerNumber isKindOfClass:NSNumber.class] && [valueNumber isKindOfClass:NSNumber.class] &&
                     controllerNumber.doubleValue >= 0 && controllerNumber.doubleValue <= 127 && controllerNumber.doubleValue == controllerNumber.integerValue &&
                     valueNumber.doubleValue >= 0 && valueNumber.doubleValue <= 127 && valueNumber.doubleValue == valueNumber.integerValue;
        if (!valid) { reply(nil, @"Invalid MIDI control change."); return; }
        [self.midi sendControlChange:controllerNumber.unsignedIntegerValue value:valueNumber.unsignedIntegerValue reply:reply];
    } else reply(nil, @"Unsupported Mosaic action.");
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    BOOL local = [action.request.URL.URLByStandardizingPath isEqual:self.indexURL.URLByStandardizingPath];
    decisionHandler(local ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}

- (void)webView:(WKWebView *)webView runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSArray<NSURL *> *))completionHandler {
    if (!frame.mainFrame || ![frame.request.URL.URLByStandardizingPath isEqual:self.indexURL.URLByStandardizingPath]) {
        completionHandler(nil);
        return;
    }
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO;
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    panel.allowedFileTypes = @[@"nam", @"nam2", @"eadl", @"wav", @"ir"];
    panel.allowsOtherFileTypes = NO;
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        completionHandler(response == NSModalResponseOK ? panel.URLs : nil);
    }];
}

- (void)applicationWillTerminate:(NSNotification *)notification { [self.midi disconnect]; }

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return YES; }

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSAlert *alert = [NSAlert new]; alert.messageText = @"JimCommanD could not load"; alert.informativeText = error.localizedDescription; [alert runModal];
}
@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = NSApplication.sharedApplication;
        app.activationPolicy = NSApplicationActivationPolicyRegular;
        AppDelegate *delegate = [AppDelegate new];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
