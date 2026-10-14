package com.akrual.pembukuan;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupRestorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
