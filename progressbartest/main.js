#!/usr/bin/env gjs

imports.gi.versions.Gtk = '3.0'; // Sticking with GTK3 as initially used
imports.gi.versions.WebKit2 = '4.1'; // Or '4.0' depending on your system
const { Gtk, GObject, GLib, Gio, WebKit2 } = imports.gi;

// Basic logging - replace with more robust logging if needed
const log = (...args) => console.log('[ProgressBarApp]', ...args);
const logError = (...args) => console.error('[ProgressBarApp ERROR]', ...args);


class ProgressBarWindow extends Gtk.ApplicationWindow {
    static {
        GObject.registerClass({
            GTypeName: 'ProgressBarWindow',
            Template: Gio.File.new_for_path('main.ui').get_uri(),
            // Only mainGrid is from the template
            InternalChildren: ['mainGrid'],
        }, this);
    }

    _init(application) {
        super._init({ application });
        log('ProgressBarWindow init');

        try {
            log('ProgressBarWindow init: Try block entered.');
            this._webViewReady = false; // Flag to track WebView page load state
            this._jsReady = false; // Flag to track if the JS environment is ready

            // --- Create and attach widgets programmatically ---
            log("Creating WebView with custom context...");
            // Get default context and register custom scheme
            const context = WebKit2.WebContext.get_default();
            context.register_uri_scheme('app', (request) => {
                const uri = request.get_uri();
                const path = uri.substring('app://localhost'.length); // Get path part after app://localhost
                const baseDir = GLib.get_current_dir();
                const filePath = GLib.build_filenamev([baseDir, path]);
                const file = Gio.File.new_for_path(filePath);

                log(`Custom scheme request: URI=${uri}, Path=${path}, FilePath=${filePath}`);

                try {
                    if (!file.query_exists(null)) {
                        logError(`File not found for custom scheme: ${filePath}`);
                        request.finish_error(new GLib.Error(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND, `File not found: ${path}`));
                        return;
                    }

                    const info = file.query_info('standard::content-type,standard::size', Gio.FileQueryInfoFlags.NONE, null);
                    const contentType = info.get_content_type();
                    const size = info.get_size();
                    const stream = file.read(null);

                    log(`Serving file: ${filePath}, Content-Type: ${contentType}, Size: ${size}`);
                    request.finish(stream, size, contentType);

                } catch (e) {
                    logError(e, `Error handling custom scheme request for ${filePath}`);
                    request.finish_error(new GLib.Error(Gio.io_error_quark(), Gio.IOErrorEnum.FAILED, e.message));
                }
            });
            // Create UserContentManager and register script message handler
            const manager = new WebKit2.UserContentManager();
            manager.register_script_message_handler('gjsCallback'); // Match the name used in JS
            manager.connect('script-message-received::gjsCallback', (manager, result) => {
                const jsValue = result.get_js_value();
                const message = jsValue?.to_string(); // Get the message as string
                log(`Received script message: ${message}`);
                if (message === 'ready') {
                    this._jsReady = true;
                    log("JavaScript environment is ready.");
                    // Now that JS is ready, try to apply the current slider value
                    this.updateWebviewProgress(this._progressSlider.get_value() / 100.0);
                }
            });
            log("UserContentManager and script message handler set up.");

            // Create WebView with the context AND the content manager
            this._webView = new WebKit2.WebView({
                web_context: context,
                user_content_manager: manager // Inject the manager
            });

            // Apply settings *before* loading content
            const settings = this._webView.get_settings();
            settings.set_enable_developer_extras(true); // Re-enable developer tools
            settings.set_allow_file_access_from_file_urls(true); // Allow file:// URIs to access other file:// URIs
            settings.set_allow_universal_access_from_file_urls(true); // Allow file:// URIs to access any origin (use with caution)
            log("WebView settings applied.");

            // Connect signals *before* loading content
            this._webView.connect('load-changed', (webView, loadEvent) => {
                switch (loadEvent) {
                    case WebKit2.LoadEvent.STARTED:
                        log("WebView 'load-changed' event: STARTED");
                        this._webViewReady = false; // Reset flag on new load
                        break;
                    case WebKit2.LoadEvent.FINISHED:
                        log("WebView 'load-changed' event: FINISHED - Page loaded.");
                        this._webViewReady = true; // Set flag when loaded
                        // Don't immediately update here; wait for the 'ready' message from JS
                        // this.updateWebviewProgress(this._progressSlider.get_value() / 100.0);
                        break;
                    case WebKit2.LoadEvent.FAILED:
                        logError("WebView 'load-changed' event: FAILED to load URI:", appUri);
                        this._webViewReady = false; // Ensure flag is false on failure
                        this._jsReady = false; // Also reset JS ready state on failure
                        break;
                }
            });
            log("WebView 'load-changed' signal connected.");

            // Load the initial URI
            const appUri = 'app://localhost/index.html'; // Define appUri here
            log(`Loading URI: ${appUri}`);
            this._webView.load_uri(appUri);

            // Add WebView to the grid
            log("Adding WebView to mainGrid...");
            this._mainGrid.attach(this._webView, 0, 0, 1, 1); // column, row, width, height
            this._webView.set_size_request(-1, 150); // Keep height request
            this._webView.show();
            log("WebView added and shown.");

            // --- Create Slider Programmatically ---
            log("Creating progress slider...");
            const adjustment = new Gtk.Adjustment({
                value: 50, // Initial value (e.g., 50%)
                lower: 0,
                upper: 100,
                step_increment: 1,
                page_increment: 10,
                page_size: 0,
            });
            this._progressSlider = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: adjustment, // Set adjustment explicitly
                digits: 0, // Number of decimal places
                value_pos: Gtk.PositionType.RIGHT, // Show value on the right
                draw_value: true, // Draw the value
                hexpand: true, // Allow horizontal expansion
                margin_start: 10, // Add some margin
                margin_end: 10,
                margin_top: 5,
                margin_bottom: 10,
            });
            log("GtkScale created.");

            log("Adding slider to mainGrid...");
            // Add slider below the webViewContainer (assuming grid layout)
            // Adjust row number (e.g., 1) as needed based on your main.ui grid structure
            this._mainGrid.attach(this._progressSlider, 0, 1, 1, 1); // column, row, width, height
            this._progressSlider.show();
            log("Slider added and shown.");
            // --- End Slider Creation ---

            // --- Connect Signals ---
            log("Connecting slider 'value-changed' signal...");
            this._progressSlider.connect('value-changed', () => {
                // Only update if both the webview page is loaded AND the JS environment is ready
                if (this._webViewReady && this._jsReady) {
                    const progress = this._progressSlider.get_value() / 100.0;
                    this.updateWebviewProgress(progress);
                } else {
                    log(`Slider changed, but WebView/JS not ready yet (webViewReady: ${this._webViewReady}, jsReady: ${this._jsReady}).`);
                }
            });
            log("Slider signal connected.");

            // WebView 'load-changed' signal connection moved earlier (before load_uri)
            log("ProgressBarWindow _init completed.");

        } catch (e) {
            logError(e, 'Error initializing ProgressBarWindow');
            // Optionally destroy the window or show an error message
            this.destroy();
        }
    }

    // updateWebviewProgress method
    updateWebviewProgress(progress) {
        // Check if both the webview page is loaded AND the JS environment is ready
        if (!this._webViewReady || !this._jsReady) {
             log(`updateWebviewProgress called, but WebView/JS not ready (webViewReady: ${this._webViewReady}, jsReady: ${this._jsReady}). Aborting.`);
             return;
        }

        // Ensure progress is between 0 and 1
        const clampedProgress = Math.max(0, Math.min(1, progress));
        // Check if the function exists in the webview context before calling
        const script = `if (typeof window.setProgressBarProgress === 'function') { window.setProgressBarProgress(${clampedProgress}, '#FFBF00', '#332200'); } else { console.error('window.setProgressBarProgress function not found in WebView'); }`; // Pass default amber colors for now
        // log(`Running script: ${script}`); // Can be noisy, uncomment for debugging
        this._webView.run_javascript(script, null, (webView, result) => {
            try {
                // Important: Check if the operation was cancelled (e.g., page navigated away)
                if (result) {
                    webView.run_javascript_finish(result);
                    // log("JavaScript executed successfully."); // Uncomment for debugging
                } else {
                     log("JavaScript execution cancelled or failed to initialize.");
                }
            } catch (e) {
                // Check if the error is due to the context being destroyed
                if (e.message.includes("JavaScript execution context destroyed")) {
                    log("JS context destroyed, likely due to page navigation or closure.");
                } else {
                    logError(e, "Error running JavaScript in WebView");
                }
            }
        });
    }
}


class Application extends Gtk.Application {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            application_id: 'org.example.progressbar',
            flags: Gio.ApplicationFlags.FLAGS_NONE
        });
        log('Application constructor');
    }

    vfunc_activate() {
        log('Application activate');
        try {
            let window = this.active_window;

            if (!window) {
                // Ensure the template is loaded correctly before creating the window
                window = new ProgressBarWindow(this);
                // Default size is set in the UI file now
            }

            window.present();
            log('Window presented');
        } catch (e) {
            logError(e, 'Error activating application');
            // Attempt to quit gracefully if activation fails
             if (this.active_window) {
                 this.active_window.destroy();
             }
             this.quit();
        }
    }

    vfunc_startup() {
        super.vfunc_startup();
        log('Application startup');
    }

    vfunc_shutdown() {
        log('Application shutdown');
        super.vfunc_shutdown();
    }
}

// --- Main Execution ---
log('Starting application script');


const app = new Application();

// Connect signals for debugging lifecycle
app.connect('startup', () => log('App startup signal received.'));
app.connect('activate', () => log('App activate signal received.'));
app.connect('shutdown', () => log('App shutdown signal received.'));

// Run the application
// Pass ARGV correctly for GApplication; imports.system.programInvocationName is for extensions
const status = app.run(null); // Pass null or ARGV if processing command line args

log(`Application finished with exit status: ${status}`);
// Exit explicitly using GLib's main loop quit if necessary,
// but Gtk.Application usually handles this.
