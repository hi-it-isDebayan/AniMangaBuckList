package com.ambl.tracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

public class TrackerForegroundService extends Service {
    public static final String CHANNEL_ID = "ambl_tracker";
    private static final int NOTIF_ID = 1001;
    private static final long HEARTBEAT_PERIOD_MS = 5 * 60 * 1000L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable heartbeat = new Runnable() {
        @Override
        public void run() {
            if (Tracker.enabled(getApplicationContext())) {
                new ApiClient(getApplicationContext()).heartbeat();
            }
            if (!handler.hasCallbacks(this)) {
                handler.postDelayed(this, HEARTBEAT_PERIOD_MS);
            }
        }
    };

    public static void start(Context ctx) {
        try {
            ctx.startForegroundService(new Intent(ctx, TrackerForegroundService.class));
        } catch (Exception ignored) {
            // boot-time restrictions; accessibility service still works
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(ch);
        }
        startForeground(NOTIF_ID, buildNotification());
    }

    private Notification buildNotification() {
        Intent i = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        return b
            .setSmallIcon(R.drawable.ic_stat_tracker)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!handler.hasCallbacks(heartbeat)) {
            handler.post(heartbeat);
            handler.postDelayed(heartbeat, HEARTBEAT_PERIOD_MS);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(heartbeat);
        super.onDestroy();
    }
}