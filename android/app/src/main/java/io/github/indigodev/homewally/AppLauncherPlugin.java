package io.github.indigodev.homewally;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * The launcher functions the web app needs: list the installed apps, start one, open the Android
 * settings, check whether HomeWally is the home app, and keep the screen on.
 * Counterpart in the web app: src/native/launcher.ts
 */
@CapacitorPlugin(name = "AppLauncher")
public class AppLauncherPlugin extends Plugin {

    private static final int ICON_PX = 128;
    private BroadcastReceiver packageReceiver;

    @Override
    public void load() {
        // tell the web app when apps are installed or removed, so its list stays current
        packageReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                notifyListeners("appsChanged", new JSObject());
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addDataScheme("package");
        ContextCompat.registerReceiver(getContext(), packageReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        if (packageReceiver != null) {
            try {
                getContext().unregisterReceiver(packageReceiver);
            } catch (IllegalArgumentException ignored) {
                // already unregistered
            }
            packageReceiver = null;
        }
    }

    /** All startable apps (except HomeWally itself) with name and icon as PNG data URL. */
    @PluginMethod
    public void getApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> infos = pm.queryIntentActivities(main, 0);
        String self = getContext().getPackageName();
        boolean withIcons = call.getBoolean("icons", true);
        JSArray apps = new JSArray();
        for (ResolveInfo ri : infos) {
            if (ri.activityInfo == null || self.equals(ri.activityInfo.packageName)) continue;
            JSObject app = new JSObject();
            app.put("packageName", ri.activityInfo.packageName);
            app.put("activity", ri.activityInfo.name);
            CharSequence label = ri.loadLabel(pm);
            app.put("label", label != null ? label.toString() : ri.activityInfo.packageName);
            if (withIcons) {
                try {
                    app.put("icon", toDataUrl(ri.loadIcon(pm)));
                } catch (Exception ignored) {
                    // no icon: the web app shows the first letter
                }
            }
            apps.put(app);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    /** Starts an app; with `activity` exactly that entry, otherwise the app's default start screen. */
    @PluginMethod
    public void launch(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("packageName fehlt");
            return;
        }
        String activity = call.getString("activity");
        Intent intent;
        if (activity != null && !activity.isEmpty()) {
            intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setClassName(pkg, activity);
        } else {
            intent = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        }
        if (intent == null) {
            call.reject("App ist nicht installiert");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("App lässt sich nicht starten", e);
        }
    }

    /** Opens the Android settings: `page` = "home" (choose the home app), "app" (HomeWally's app info) or the main page. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String page = call.getString("page", "");
        Intent intent;
        if ("home".equals(page)) {
            intent = new Intent(Settings.ACTION_HOME_SETTINGS);
        } else if ("app".equals(page)) {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(android.net.Uri.fromParts("package", getContext().getPackageName(), null));
        } else {
            intent = new Intent(Settings.ACTION_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
        } catch (Exception e) {
            // some devices have no "home app" page: fall back to the main settings
            getActivity().startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    /** Is HomeWally the current home app? */
    @PluginMethod
    public void isDefaultLauncher(PluginCall call) {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo ri = getContext().getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        boolean isDefault = ri != null && ri.activityInfo != null && getContext().getPackageName().equals(ri.activityInfo.packageName);
        JSObject ret = new JSObject();
        ret.put("value", isDefault);
        call.resolve(ret);
    }

    /** Keeps the screen on while HomeWally is in front (replaces the browser's Wake Lock). */
    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(() -> {
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    private static String toDataUrl(Drawable icon) {
        Bitmap bmp = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        icon.setBounds(0, 0, ICON_PX, ICON_PX);
        icon.draw(canvas);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Build.VERSION.SDK_INT >= 30 ? Bitmap.CompressFormat.WEBP_LOSSLESS : Bitmap.CompressFormat.PNG, 100, out);
        bmp.recycle();
        String mime = Build.VERSION.SDK_INT >= 30 ? "image/webp" : "image/png";
        return "data:" + mime + ";base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
