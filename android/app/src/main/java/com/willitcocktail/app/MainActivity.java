package com.willitcocktail.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.willitcocktail.litertlm.LiteRtLmPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiteRtLmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
