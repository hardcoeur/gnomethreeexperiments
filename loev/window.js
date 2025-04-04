imports.gi.versions.WebKit = '6.0'; // Use WebKit (no 2) namespace, version 6.0
const { Gtk, Gdk, GObject, WebKit, Gio } = imports.gi; // Import WebKit, not WebKit2
const Adw = imports.gi.Adw;

var MainWindow = GObject.registerClass({
    GTypeName: 'SimplyLoevMainWindow',
    Template: `
        <interface>
          <template class="SimplyLoevMainWindow" parent="AdwApplicationWindow">
            <property name="title">SimplyLoev</property>
            <property name="default-width">1200</property>
            <property name="default-height">800</property>
            <property name="content">
              <object class="GtkGrid" id="main_grid">
                <property name="column-spacing">6</property>
                <property name="row-spacing">6</property>
                <property name="margin-top">6</property>
                <property name="margin-bottom">6</property>
                <property name="margin-start">6</property>
                <property name="margin-end">6</property>

                <!-- Left Toolbar Placeholder -->
                <child>
                  <object class="GtkBox" id="left_toolbar">
                    <property name="width-request">48</property> <!-- Standard icon size + padding -->
                    <property name="orientation">vertical</property>
                    <property name="vexpand">true</property>
                    <property name="valign">fill</property>
                    <property name="spacing">6</property>
                    <property name="margin-start">6</property>
                    <property name="margin-end">6</property>
                    <property name="margin-top">6</property>
                    <property name="margin-bottom">6</property>
                    <!-- Add actual buttons here -->
                    <child>
                      <object class="GtkButton" id="select_tool">
                        <property name="icon-name">select-all-symbolic</property> <!-- Example icon -->
                        <property name="tooltip-text">Select</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="move_tool">
                        <property name="icon-name">object-move-symbolic</property> <!-- Example icon -->
                        <property name="tooltip-text">Move</property>
                      </object>
                    </child>
                     <child>
                      <object class="GtkButton" id="rotate_tool">
                        <property name="icon-name">object-rotate-symbolic</property> <!-- Example icon -->
                        <property name="tooltip-text">Rotate</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="scale_tool">
                        <property name="icon-name">object-scale-symbolic</property> <!-- Example icon -->
                        <property name="tooltip-text">Scale</property>
                      </object>
                    </child>
                  </object>
                  <!-- Layout properties moved to <child> tag -->
                </child>
                <layout>
                  <property name="column">0</property>
                  <property name="row">0</property>
                  <property name="row-span">2</property> <!-- Span across GLArea and Timeline rows -->
                </layout>

                <!-- WebView Container Placeholder -->
                <child>
                  <object class="GtkBox" id="webview_container"> <!-- Placeholder Box -->
                    <property name="hexpand">true</property>
                    <property name="vexpand">true</property>
                  </object>
                </child>
                <layout>
                  <property name="column">1</property>
                  <property name="row">0</property>
                </layout>

                <!-- ViewCube removed for now -->

                <!-- Right Toolbar Placeholder -->
                <child>
                  <object class="GtkBox" id="right_toolbar">
                    <property name="width-request">48</property> <!-- Standard icon size + padding -->
                    <property name="orientation">vertical</property>
                    <property name="vexpand">true</property>
                    <property name="valign">fill</property>
                    <property name="spacing">6</property>
                    <property name="margin-start">6</property>
                    <property name="margin-end">6</property>
                    <property name="margin-top">6</property>
                    <property name="margin-bottom">6</property>
                    <!-- Add actual buttons here later -->
                    <child>
                       <object class="GtkButton" id="add_cube_button">
                         <property name="icon-name">list-add-symbolic</property>
                         <property name="tooltip-text">Add Cube</property>
                         <!-- Signal connected in code -->
                       </object>
                     </child>
                  </object>
                  <!-- Layout properties moved to <child> tag -->
                </child>
                <layout>
                  <property name="column">2</property>
                  <property name="row">0</property>
                  <property name="row-span">2</property> <!-- Span across GLArea and Timeline rows -->
                </layout>

                <!-- Bottom Timeline (Removed for now) -->
                <!--
                <child>
                  <object class="GtkBox" id="timeline">
                    ...
                  </object>
                </child>
                <layout>
                  <property name="column">1</property>
                  <property name="row">1</property>
                </layout>
                -->

              </object> <!-- End GtkGrid -->
            </property>
          </template>
        </interface>
    `,
    InternalChildren: [ // Added button IDs
        'main_grid', 'left_toolbar', 'select_tool', 'move_tool', 'rotate_tool', 'scale_tool',
        'webview_container', 'right_toolbar', 'add_cube_button', // Added test button
        // Removed timeline children
    ],
}, class MainWindow extends Adw.ApplicationWindow {
    constructor(options) {
        log("MainWindow constructor called.");
        // Store user content manager passed from options *after* calling super
        const userContentManager = options.user_content_manager;
        // Remove user_content_manager from options before passing to super
        delete options.user_content_manager;
        super(options);
        this._userContentManager = userContentManager; // Assign after super()
        // Timeline variables removed
        log("MainWindow constructor finished.");
        // Connect to window's map signal for setup that needs children
        this.connect('map', this._onWindowMap.bind(this));
    }

    vfunc_constructed() {
        // Call super first
        super.vfunc_constructed();
        log("MainWindow vfunc_constructed called.");
        // All setup requiring internal children moved to _onWindowMap
        log("MainWindow vfunc_constructed finished.");
    }

    _onWindowMap() {
        log("Window mapped, setting up UI elements.");

        // --- Setup Timeline Ruler (Removed for now) ---
        /*
        const timelineRuler = this._timeline_ruler;
        if (!timelineRuler) { ... }
        timelineRuler.set_draw_func(...);
        ... add controllers ...
        */

        // --- Setup WebView ---
        const webviewContainer = this._webview_container;
        if (!webviewContainer) {
            log("Error: _webview_container is undefined in _onWindowMap!");
            return;
        }
        log("Creating and adding WebView.");
        // Enable Developer Extras (Inspector)
        const settings = WebKit.Settings.new();
        settings.set_enable_developer_extras(true);
        settings.set_allow_file_access_from_file_urls(true); // Allow loading local JS
        settings.set_enable_javascript(true); // Explicitly enable JS

        // Pass the UserContentManager to the WebView instance
        this._webViewInstance = new WebKit.WebView({
            settings: settings,
            user_content_manager: this._userContentManager // Associate manager
        });
        this._webViewInstance.hexpand = true;
        this._webViewInstance.vexpand = true;
        webviewContainer.append(this._webViewInstance); // Add to container

        // --- Wait for WebView load before connecting signals ---
        this._signalsConnected = false; // Flag to connect only once
        this._webViewInstance.connect('load-changed', this._onWebViewLoadChanged.bind(this));

        // Load the HTML file
        const file = Gio.File.new_for_path('index.html');
        this._webViewInstance.load_uri(file.get_uri());

        log("Window mapping setup complete.");

        // Signal connection moved to _onWebViewLoadChanged
    }

    _onWebViewLoadChanged(webView, loadEvent) {
        log(`WebView load event: ${loadEvent}`); // Log all events for debugging
        if (!this._signalsConnected && loadEvent === WebKit.LoadEvent.FINISHED) {
            log("WebView finished loading. Connecting button signals.");
            this._connectButtonSignals();
            this._signalsConnected = true; // Ensure signals are connected only once
        }
    }

    _connectButtonSignals() {
        log("Connecting toolbar button signals.");
        // Helper function to call JS
        // Reverting to synchronous version with 6 arguments
        const callJs = (funcName, arg) => {
            if (!this._webViewInstance) {
                log("Error: WebView not ready for JS call.");
                return;
            }
            const argString = typeof arg === 'string' ? `'${arg}'` : arg;
            const script = `${funcName}(${argString});`;
            log(`Evaluating JS: ${script}`);
            try {
                // Using synchronous call with exactly 6 arguments
                this._webViewInstance.evaluate_javascript(script, -1, null, null, null, null);
                // Note: Synchronous version doesn't easily report JS execution errors here,
                // rely on Web Inspector console for those.
            } catch (e) {
                 log(`Error calling evaluate_javascript (GTK level): ${e}`);
            }
        };

        // Left Toolbar
        this._select_tool.connect('clicked', () => callJs('setActiveTool', 'select'));
        this._move_tool.connect('clicked', () => callJs('setActiveTool', 'move'));
        this._rotate_tool.connect('clicked', () => callJs('setActiveTool', 'rotate'));
        this._scale_tool.connect('clicked', () => callJs('setActiveTool', 'scale'));

        // Right Toolbar (Test Button)
        this._add_cube_button.connect('clicked', () => callJs('addCube'));

        log("Toolbar button signals connected.");
    }

    // --- Timeline related methods removed ---
});