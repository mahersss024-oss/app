package com.souqhamad.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class SouqHamadWebChromeClient extends BridgeWebChromeClient {
    private static final int REQUEST_PICK_IMAGES = 4101;
    private static final int REQUEST_CAPTURE_IMAGE = 4102;
    private static final int REQUEST_PICK_FILES = 4103;
    static final int REQUEST_CAMERA_PERMISSION = 4104;

    private final Activity activity;
    private ValueCallback<Uri[]> filePathCallback;
    private WebChromeClient.FileChooserParams fileChooserParams;
    private Uri cameraImageUri;

    public SouqHamadWebChromeClient(Bridge bridge, Activity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public boolean onShowFileChooser(
        WebView webView,
        ValueCallback<Uri[]> callback,
        WebChromeClient.FileChooserParams params
    ) {
        clearPendingCallback();
        filePathCallback = callback;
        fileChooserParams = params;

        new AlertDialog.Builder(activity)
            .setItems(
                new CharSequence[] { "مكتبة الصور", "التقاط صورة", "اختيار ملفات" },
                (dialog, which) -> {
                    if (which == 0) {
                        openImageLibrary();
                    } else if (which == 1) {
                        openCamera();
                    } else {
                        openFilePicker();
                    }
                }
            )
            .setOnCancelListener(dialog -> finishFileSelection(null))
            .show();

        return true;
    }

    public boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (
            requestCode != REQUEST_PICK_IMAGES &&
            requestCode != REQUEST_CAPTURE_IMAGE &&
            requestCode != REQUEST_PICK_FILES
        ) {
            return false;
        }

        Uri[] results = null;

        if (resultCode == Activity.RESULT_OK) {
            if (requestCode == REQUEST_CAPTURE_IMAGE && cameraImageUri != null) {
                results = new Uri[] { cameraImageUri };
            } else {
                results = parseResultUris(resultCode, data);
            }
        }

        finishFileSelection(results);
        return true;
    }

    public boolean handlePermissionResult(int requestCode, int[] grantResults) {
        if (requestCode != REQUEST_CAMERA_PERMISSION) {
            return false;
        }

        if (
            grantResults.length > 0 &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            openCamera();
        } else {
            finishFileSelection(null);
        }

        return true;
    }

    private void openImageLibrary() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowsMultipleFiles());
        launchIntent(intent, REQUEST_PICK_IMAGES);
    }

    private void openCamera() {
        if (
            ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                new String[] { Manifest.permission.CAMERA },
                REQUEST_CAMERA_PERMISSION
            );
            return;
        }

        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);

        if (intent.resolveActivity(activity.getPackageManager()) == null) {
            finishFileSelection(null);
            return;
        }

        try {
            cameraImageUri = createCameraImageUri();
        } catch (IOException exception) {
            finishFileSelection(null);
            return;
        }

        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        grantUriToCameraApps(intent, cameraImageUri);
        launchIntent(intent, REQUEST_CAPTURE_IMAGE);
    }

    private void openFilePicker() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowsMultipleFiles());
        launchIntent(intent, REQUEST_PICK_FILES);
    }

    private void launchIntent(Intent intent, int requestCode) {
        try {
            activity.startActivityForResult(intent, requestCode);
        } catch (ActivityNotFoundException | SecurityException exception) {
            finishFileSelection(null);
        }
    }

    private boolean allowsMultipleFiles() {
        return fileChooserParams != null &&
            fileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
    }

    private Uri createCameraImageUri() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File directory = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES);

        if (directory == null) {
            directory = activity.getCacheDir();
        }

        File image = File.createTempFile("souq_hamad_" + timestamp + "_", ".jpg", directory);

        return FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", image);
    }

    private void grantUriToCameraApps(Intent intent, Uri uri) {
        PackageManager packageManager = activity.getPackageManager();
        List<ResolveInfo> activities = packageManager.queryIntentActivities(
            intent,
            PackageManager.MATCH_DEFAULT_ONLY
        );

        for (ResolveInfo resolveInfo : activities) {
            if (resolveInfo.activityInfo == null || resolveInfo.activityInfo.packageName == null) {
                continue;
            }

            activity.grantUriPermission(
                resolveInfo.activityInfo.packageName,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        }
    }

    private Uri[] parseResultUris(int resultCode, Intent data) {
        if (data != null && data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            Uri[] uris = new Uri[count];

            for (int index = 0; index < count; index += 1) {
                uris[index] = data.getClipData().getItemAt(index).getUri();
            }

            return uris;
        }

        return WebChromeClient.FileChooserParams.parseResult(resultCode, data);
    }

    private void finishFileSelection(Uri[] results) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(results);
        }

        filePathCallback = null;
        fileChooserParams = null;
        cameraImageUri = null;
    }

    private void clearPendingCallback() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
    }
}
