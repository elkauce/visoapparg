package com.viso.deck;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VisoNativePlugin.class);
        // Plugin.load runs while creating the bridge, before Activity STARTED.
        // Home APIs can therefore register the official permission launcher.
        registerPlugin(VisoGoogleHomePlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    // A reload creates a new document, so its CSS variables need fresh insets.
                    VisoNativePlugin.applyImmersive(MainActivity.this, webView);
                    ViewCompat.requestApplyInsets(webView);
                }
            });
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && getBridge() != null) {
            VisoNativePlugin.applyImmersive(this, getBridge().getWebView());
        }
    }

    /** Called by VisoNativePlugin's single inset listener, in normal and immersive modes. */
    public void applyWebViewInsets(View view, WindowInsetsCompat insets, boolean immersive) {
        int types = WindowInsetsCompat.Type.displayCutout();
        if (!immersive) types |= WindowInsetsCompat.Type.systemBars();
        Insets safe = insets.getInsets(types);
        boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
        int keyboardBottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;

        // Only the keyboard resizes the native viewport. CSS handles safe margins once.
        view.setPadding(0, 0, 0, keyboardBottom);
        if (!(view instanceof WebView)) return;
        float density = getResources().getDisplayMetrics().density;
        String script = String.format(Locale.US,
            "(function(){var root=document.documentElement;if(!root)return;" +
            "root.dataset.visoNative='true';" +
            "root.style.setProperty('--viso-safe-top','%.3fpx');" +
            "root.style.setProperty('--viso-safe-right','%.3fpx');" +
            "root.style.setProperty('--viso-safe-bottom','%.3fpx');" +
            "root.style.setProperty('--viso-safe-left','%.3fpx');})();",
            safe.top / density, safe.right / density,
            (keyboardVisible ? 0 : safe.bottom) / density, safe.left / density);
        ((WebView) view).evaluateJavascript(script, null);
    }
}
