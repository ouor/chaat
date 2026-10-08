package expo.modules.chatkeeper

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Person
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

data class KeeperMessage(val nickname: String, val text: String, val time: Long)

/**
 * Foreground service that keeps the app process (and so the JS chat socket and log writer) alive
 * while a chat room is open and the app is in the background. It owns no connection itself: JS
 * keeps receiving and pushes the newest chats here to show as a messenger-style notification.
 */
class ChatKeeperService : Service() {
  companion object {
    private const val CHANNEL_ID = "chat_keeper"
    private const val NOTIFICATION_ID = 4201
    private const val ACTION_STOP = "expo.modules.chatkeeper.STOP"

    // Written from the module (JS thread), read when (re)building the notification.
    @Volatile var title: String = ""
    @Volatile var messages: List<KeeperMessage> = emptyList()
    @Volatile var running = false

    /** Set by the module; called when the user taps "그만 받기" on the notification. */
    @Volatile var onStopRequested: (() -> Unit)? = null

    fun start(context: Context) {
      val intent = Intent(context, ChatKeeperService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ChatKeeperService::class.java))
    }

    /** Re-posts the notification with the current title/messages; no-op when not running. */
    fun refresh(context: Context) {
      if (!running) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, build(context))
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      // Default importance so it sits with conversations, but silent: it updates every second.
      val channel = NotificationChannel(CHANNEL_ID, "채팅 계속 받기", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "앱을 내려 둔 동안 채팅방의 새 채팅을 보여 줘요"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }

    @Suppress("DEPRECATION")
    private fun build(context: Context): Notification {
      ensureChannel(context)
      val builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CHANNEL_ID)
        else Notification.Builder(context).setPriority(Notification.PRIORITY_LOW).setSound(null)

      val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      if (open != null) builder.setContentIntent(PendingIntent.getActivity(context, 0, open, flags))
      val stopIntent = Intent(context, ChatKeeperService::class.java).setAction(ACTION_STOP)
      val stop = PendingIntent.getService(context, 1, stopIntent, flags)

      val heading = title.ifEmpty { "채팅방" }
      builder
        .setSmallIcon(R.drawable.chat_keeper_icon)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(true)
        .addAction(Notification.Action.Builder(null, "그만 받기", stop).build())

      val recent = messages
      if (recent.isEmpty()) {
        builder.setContentTitle(heading).setContentText("새 채팅을 기다리고 있어요")
        return builder.build()
      }
      val style =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          Notification.MessagingStyle(Person.Builder().setName("나").build()).setGroupConversation(true)
        } else {
          Notification.MessagingStyle("나")
        }
      style.setConversationTitle(heading)
      for (m in recent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          val sender = Person.Builder().setName(m.nickname).build()
          style.addMessage(Notification.MessagingStyle.Message(m.text, m.time, sender))
        } else {
          style.addMessage(m.text, m.time, m.nickname)
        }
      }
      // Collapsed view (and pre-P fallback) shows the newest chat.
      val last = recent.last()
      builder.setStyle(style).setContentTitle(heading).setContentText("${last.nickname}: ${last.text}")
      return builder.build()
    }
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      onStopRequested?.invoke()
      stopSelf()
      return START_NOT_STICKY
    }
    val notification = build(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    running = true
    // Screen off: without a CPU wake lock the JS timers (ping, watchdog, log flush) stall and the
    // chat server drops the idle connection. Held only while the service runs.
    if (wakeLock == null) {
      val power = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chaat:chat-keeper").apply {
        setReferenceCounted(false)
        acquire()
      }
    }
    // Not sticky: if the system kills the process, the JS session is gone too; nothing to resume.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = false
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }
}
