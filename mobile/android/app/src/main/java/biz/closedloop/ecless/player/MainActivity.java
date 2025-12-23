package biz.closedloop.ecless.player;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Grab WebView
        WebView webView = (WebView) findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();

        // The Magic
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        
        // Enable immersive full-screen mode
        enableImmersiveMode();
    }
    
    @Override
    public void onResume() {
        super.onResume();
        
        // Re-apply immersive mode when app resumes
        enableImmersiveMode();
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        
        // Re-apply immersive mode when window gains focus
        // This handles cases where system UI reappears after user interaction
        if (hasFocus) {
            enableImmersiveMode();
        }
    }
    
    /**
     * Enable full immersive mode - hides status bar and navigation bar
     * Uses modern WindowInsetsController for Android 11+ and fallback for older versions
     */
    private void enableImmersiveMode() {
        Window window = getWindow();
        View decorView = window.getDecorView();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11 (API 30) and above - Use WindowInsetsController
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                // Hide both status bar and navigation bar
                insetsController.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                
                // Set behavior for system bars - BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                // This makes the bars appear temporarily on swipe and then auto-hide
                insetsController.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            
            // Additional flags for immersive experience
            window.setFlags(
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            );
            
        } else {
            // Android 10 and below - Use system UI flags
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            
            decorView.setSystemUiVisibility(flags);
            
            // Keep screen on
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        
        // Make window extend into display cutout area (for devices with notch)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = 
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
    }
}
