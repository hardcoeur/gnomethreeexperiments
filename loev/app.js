const { Gtk, Gio, GObject, WebKit } = imports.gi; // Import WebKit
const Adw = imports.gi.Adw;

// Import the MainWindow class
const { MainWindow } = imports.window;

var Application = GObject.registerClass({
    GTypeName: 'SimplyLoevApplication',
}, class Application extends Adw.Application {
    constructor(options) {
        super(options);

        // --- Setup UserContentManager for WebView console logging ---
        this.userContentManager = new WebKit.UserContentManager();
        // Register 'console' as a message handler JS can post to in the default world
        this.userContentManager.register_script_message_handler('console', null);
        // Connect to the signal emitted when 'console.postMessage' is called
        this.userContentManager.connect('script-message-received::console', this._onConsoleMessage.bind(this));
        log("UserContentManager created and console handler connected.");
    }

    // --- Signal handler for script messages from WebView ---
    _onConsoleMessage(manager, message) {
        const text = message.get_text();
        // Log message from WebView to the terminal, prefixed
        log(`JS LOG: ${text}`);
    }

    vfunc_activate() {
        // Create and show the main window
        let window = this.active_window;
        if (!window) {
            // Pass the UserContentManager to the window
            window = new MainWindow({ application: this, user_content_manager: this.userContentManager });
        }
        window.present();
    }
});