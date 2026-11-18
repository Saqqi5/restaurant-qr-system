package com.saqlain.tableqr;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Screenshots must always be allowed in this app — make sure no
        // FLAG_SECURE is set on the window (it blocks screenshots with a
        // "screenshot not allowed" error).
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
}
