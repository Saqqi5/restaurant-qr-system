package com.saqlain.tableqr;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Local plugin: ask Android to offer saving the login credentials
        // (see AutofillPlugin — called from the login page after sign-in).
        registerPlugin(AutofillPlugin.class);
        allowScreenshots();
        enableAutofill();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-clear on every foreground return: if anything re-sets
        // FLAG_SECURE while the app is backgrounded, screenshots stay allowed.
        allowScreenshots();
    }

    // Screenshots must always be allowed in this app — FLAG_SECURE on the
    // window blocks them with a "screenshot not allowed" error.
    private void allowScreenshots() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    // Let Android Autofill (Google password save) work in the login form:
    // opt the WebView into autofill so that after a successful sign-in the
    // "Save password?" prompt can appear. The login form already carries
    // the right autocomplete hints (email + current-password).
    private void enableAutofill() {
        try {
            getBridge().getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        } catch (Exception e) {
            // WebView not ready yet — autofill stays at its default.
        }
    }
}
