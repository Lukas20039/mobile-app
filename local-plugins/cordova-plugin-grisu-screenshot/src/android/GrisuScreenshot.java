package at.lex.grisu.noe.screenshot;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.PixelCopy;
import android.view.View;
import android.view.Window;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Captures the current window and writes it to the shared Pictures collection.
 *
 * The legacy plugin this replaces wrote straight to external storage, which stopped working
 * with scoped storage. From API 29 on we hand the bitmap to MediaStore instead, which needs
 * no runtime permission; below that we keep the classic file write.
 */
public class GrisuScreenshot extends CordovaPlugin {

    private static final String ACTION_SAVE = "saveScreenshot";
    private static final String ALBUM = "Grisu";

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (!ACTION_SAVE.equals(action)) {
            return false;
        }

        final String format = args.optString(0, "jpg");
        final int quality = args.optInt(1, 100);
        final String filename = args.optString(2, "screenshot");

        captureWindow(format, quality, filename, callbackContext);
        return true;
    }

    /**
     * PixelCopy is the only reliable way to read back a hardware accelerated WebView;
     * View.draw() into a software canvas yields blank or partial output.
     */
    private void captureWindow(final String format, final int quality, final String filename,
                               final CallbackContext callbackContext) {
        cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Window window = cordova.getActivity().getWindow();
                    View decorView = window.getDecorView();

                    int width = decorView.getWidth();
                    int height = decorView.getHeight();

                    if (width <= 0 || height <= 0) {
                        callbackContext.error("Window has no measurable size yet");
                        return;
                    }

                    final Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);

                    PixelCopy.request(window, bitmap, new PixelCopy.OnPixelCopyFinishedListener() {
                        @Override
                        public void onPixelCopyFinished(int copyResult) {
                            if (copyResult != PixelCopy.SUCCESS) {
                                bitmap.recycle();
                                callbackContext.error("PixelCopy failed with result " + copyResult);
                                return;
                            }

                            // Compression and I/O must not run on the UI thread.
                            cordova.getThreadPool().execute(new Runnable() {
                                @Override
                                public void run() {
                                    persist(bitmap, format, quality, filename, callbackContext);
                                }
                            });
                        }
                    }, new Handler(Looper.getMainLooper()));
                } catch (Exception e) {
                    callbackContext.error("Could not capture screen: " + e.getMessage());
                }
            }
        });
    }

    private void persist(Bitmap bitmap, String format, int quality, String filename,
                         CallbackContext callbackContext) {
        boolean isPng = "png".equalsIgnoreCase(format);
        Bitmap.CompressFormat compressFormat = isPng
                ? Bitmap.CompressFormat.PNG
                : Bitmap.CompressFormat.JPEG;
        String extension = isPng ? "png" : "jpg";
        String mimeType = isPng ? "image/png" : "image/jpeg";
        String displayName = stripExtension(filename) + "." + extension;

        try {
            String location = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveViaMediaStore(bitmap, compressFormat, quality, displayName, mimeType)
                    : saveViaLegacyFile(bitmap, compressFormat, quality, displayName);

            JSONObject result = new JSONObject();
            result.put("filePath", location);
            callbackContext.success(result);
        } catch (Exception e) {
            callbackContext.error("Could not save screenshot: " + e.getMessage());
        } finally {
            bitmap.recycle();
        }
    }

    private String saveViaMediaStore(Bitmap bitmap, Bitmap.CompressFormat format, int quality,
                                     String displayName, String mimeType) throws Exception {
        String relativePath = Environment.DIRECTORY_PICTURES + File.separator + ALBUM;

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, relativePath);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        ContentResolver resolver = cordova.getContext().getContentResolver();
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

        if (uri == null) {
            throw new IllegalStateException("MediaStore returned no target URI");
        }

        try {
            OutputStream out = resolver.openOutputStream(uri);
            if (out == null) {
                throw new IllegalStateException("MediaStore returned no output stream");
            }
            try {
                bitmap.compress(format, quality, out);
                out.flush();
            } finally {
                out.close();
            }

            // Clearing IS_PENDING publishes the image to the gallery.
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
        } catch (Exception e) {
            resolver.delete(uri, null, null);
            throw e;
        }

        return relativePath + File.separator + displayName;
    }

    @SuppressWarnings("deprecation")
    private String saveViaLegacyFile(Bitmap bitmap, Bitmap.CompressFormat format, int quality,
                                     String displayName) throws Exception {
        File albumDir = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);

        if (!albumDir.exists() && !albumDir.mkdirs()) {
            throw new IllegalStateException("Could not create " + albumDir.getAbsolutePath());
        }

        File target = new File(albumDir, displayName);
        FileOutputStream out = new FileOutputStream(target);
        try {
            bitmap.compress(format, quality, out);
            out.flush();
        } finally {
            out.close();
        }

        // Without this the screenshot stays invisible to the gallery until the next boot.
        MediaScannerConnection.scanFile(cordova.getContext(),
                new String[] { target.getAbsolutePath() }, null, null);

        return target.getAbsolutePath();
    }

    private String stripExtension(String filename) {
        if (filename.endsWith(".jpg") || filename.endsWith(".png") || filename.endsWith(".jpeg")) {
            return filename.substring(0, filename.lastIndexOf('.'));
        }
        return filename;
    }
}
