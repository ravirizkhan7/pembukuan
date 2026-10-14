package com.akrual.pembukuan;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import android.Manifest;
import android.content.pm.PackageManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Plugin Native Capacitor untuk Backup, Restore & Utilitas Sistem Android
 * Menggunakan Storage Access Framework (SAF) via ACTION_CREATE_DOCUMENT dan ACTION_OPEN_DOCUMENT.
 * Menyediakan pemeriksaan izin kamera runtime & pembukaan pengaturan aplikasi untuk QR Scanner.
 */
@CapacitorPlugin(
    name = "NativeBackupRestore",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class BackupRestorePlugin extends Plugin {

    @PluginMethod
    public void saveBackupFile(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (content == null) {
            call.reject("Konten berkas cadangan kosong.");
            return;
        }

        if (filename == null || filename.trim().isEmpty()) {
            filename = "spbu_backup.json";
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);

        startActivityForResult(call, intent, "saveBackupCallback");
    }

    @ActivityCallback
    public void saveBackupCallback(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        // Pengguna membatalkan dialog simpan file
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();
        String content = call.getString("content");
        if (content == null) {
            call.reject("Konten berkas cadangan tidak ditemukan pada sesi penyimpanan.");
            return;
        }

        try {
            ContentResolver resolver = getContext().getContentResolver();
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);

            try (OutputStream os = resolver.openOutputStream(uri);
                 BufferedOutputStream bos = new BufferedOutputStream(os)) {
                if (os == null) {
                    call.reject("Gagal membuka stream penulisan pada lokasi yang dipilih.");
                    return;
                }
                bos.write(bytes);
                bos.flush();
            }

            // Dapatkan nama berkas aktual yang disimpan
            String savedFilename = call.getString("filename");
            try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        String name = cursor.getString(nameIndex);
                        if (name != null && !name.trim().isEmpty()) {
                            savedFilename = name;
                        }
                    }
                }
            } catch (Exception ex) {
                Logger.warn("Tidak dapat membaca display name dokumen: " + ex.getMessage());
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("cancelled", false);
            ret.put("filename", savedFilename);
            ret.put("uri", uri.toString());
            ret.put("bytesWritten", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            Logger.error("Gagal menulis berkas backup ke Storage Access Framework", e);
            call.reject("Gagal menulis berkas backup: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void pickBackupFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        String[] mimeTypes = new String[] {
            "application/json",
            "text/plain",
            "application/octet-stream",
            "*/*"
        };
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

        startActivityForResult(call, intent, "pickBackupCallback");
    }

    @ActivityCallback
    public void pickBackupCallback(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        // Pengguna membatalkan dialog pemilih file
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();
        try {
            ContentResolver resolver = getContext().getContentResolver();
            String displayName = "backup.json";
            try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        String name = cursor.getString(nameIndex);
                        if (name != null && !name.trim().isEmpty()) {
                            displayName = name;
                        }
                    }
                }
            } catch (Exception ex) {
                Logger.warn("Tidak dapat membaca display name dokumen: " + ex.getMessage());
            }

            StringBuilder sb = new StringBuilder();
            try (InputStream is = resolver.openInputStream(uri);
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                if (is == null) {
                    call.reject("Gagal membuka stream pembacaan dari dokumen.");
                    return;
                }
                char[] buf = new char[8192];
                int n;
                while ((n = reader.read(buf)) != -1) {
                    sb.append(buf, 0, n);
                    if (sb.length() > 50 * 1024 * 1024) {
                        call.reject("Ukuran berkas melebihi batas wajar (maksimal 50 MB).");
                        return;
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("cancelled", false);
            ret.put("filename", displayName);
            ret.put("content", sb.toString());
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            Logger.error("Gagal membaca berkas backup dari Storage Access Framework", e);
            call.reject("Gagal membaca berkas backup: " + e.getMessage(), e);
        }
    }

    /**
     * Memeriksa status izin kamera Android secara akurat
     */
    @PluginMethod
    public void checkCameraPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean shouldShowRationale = getActivity() != null && ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.CAMERA);
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("shouldShowRationale", shouldShowRationale);
        call.resolve(ret);
    }

    /**
     * Meminta izin kamera Android secara native
     */
    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("shouldShowRationale", false);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PermissionCallback
    public void cameraPermissionCallback(PluginCall call) {
        if (call == null) return;
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean shouldShowRationale = getActivity() != null && ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.CAMERA);
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("shouldShowRationale", shouldShowRationale);
        call.resolve(ret);
    }

    /**
     * Membuka layar Pengaturan Aplikasi Android (App Info) secara langsung
     * jika izin ditolak permanen oleh pengguna ("Jangan tanya lagi")
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Logger.error("Gagal membuka pengaturan aplikasi", e);
            call.reject("Gagal membuka pengaturan aplikasi: " + e.getMessage(), e);
        }
    }
}
