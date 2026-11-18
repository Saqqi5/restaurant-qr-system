package com.saqlain.tableqr;

import android.view.autofill.AutofillManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Autofill — ask Android to offer saving the login credentials.
//
// A WebView login form on its own often never triggers the Google
// "Save password?" prompt: the app is a single-page app, so after sign-in
// there is no full page navigation for the WebView to read as "login
// succeeded". Calling AutofillManager.commit() right after a successful
// sign-in tells the system the credentials in the current autofill
// session are good, and it shows the save prompt. If the user has no
// autofill service (or Google is not it), this is a harmless no-op.
@CapacitorPlugin(name = "Autofill")
public class AutofillPlugin extends Plugin {
    @PluginMethod
    public void commit(PluginCall call) {
        try {
            AutofillManager afm = getActivity().getSystemService(AutofillManager.class);
            if (afm != null) {
                afm.commit();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "autofill commit failed");
        }
    }
}
