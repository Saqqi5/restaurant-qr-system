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
        // A delayed re-clear: the WebView is created after onCreate, and
        // if anything sets FLAG_SECURE during that setup, the login page
        // (the first screen) would block screenshots. Clear again once
        // the window is fully up.
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::allowScreenshots, 500);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-clear on every foreground return: if anything re-sets
        // FLAG_SECURE while the app is backgrounded, screenshots stay allowed.
        allowScreenshots();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // The login page is the FIRST screen — if FLAG_SECURE is set while
        // the window gains focus (before onResume's clear lands), the
        // login page blocks screenshots while every other page allows
        // them. Re-clear on every focus gain so no page is ever blocked.
        if (hasFocus) allowScreenshots();
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
