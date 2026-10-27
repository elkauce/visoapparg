package com.teaviso.app;

import android.os.Bundle;
import android.view.View;
import android.graphics.Color;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(TeAvisoNativePlugin.class);
    registerPlugin(VisoTimbrePlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
    WindowInsetsControllerCompat bars = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    bars.setAppearanceLightStatusBars(true);
    bars.setAppearanceLightNavigationBars(true);
    View root = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
      Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      int keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
      view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard));
      return insets;
    });
    ViewCompat.requestApplyInsets(root);
  }
}
