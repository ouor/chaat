package expo.modules.chatkeeper

import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
// Must match TASK_KEY in index.ts.
private const val TASK_KEY = "ChatKeeper"
private const val TICK_MS = 1000L

class ChatKeeperModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  // RN pauses every JS timer once the activity is paused, unless a headless JS task is active
  // (JavaTimerManager). This task runs for as long as the service, so the socket ping/watchdog,
  // log flush and notification updates keep firing in the background.
  @Volatile private var taskId: Int? = null

  private fun startTimersTask() {
    val rc = appContext.reactContext as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      if (taskId != null) return@runOnUiThread
      taskId = HeadlessJsTaskContext.getInstance(rc).startTask(
        HeadlessJsTaskConfig(TASK_KEY, Arguments.createMap(), 0, true),
      )
    }
  }

  // Samsung stops the app's Choreographer ~4s into the background, and RN's setTimeout/setInterval
  // run on Choreographer frames, so the task above alone isn't enough. This 1s tick runs on its own
  // thread (not Choreographer) and JS drives its timer work from it while the service is up.
  private var tickThread: HandlerThread? = null
  private var tickHandler: Handler? = null
  private val tick = object : Runnable {
    override fun run() {
      sendEvent("onTick", emptyMap<String, Any?>())
      tickHandler?.postDelayed(this, TICK_MS)
    }
  }

  @Synchronized private fun startTick() {
    if (tickThread != null) return
    val thread = HandlerThread("chat-keeper-tick").apply { start() }
    tickThread = thread
    tickHandler = Handler(thread.looper).apply { postDelayed(tick, TICK_MS) }
  }

  @Synchronized private fun stopTick() {
    tickHandler?.removeCallbacks(tick)
    tickHandler = null
    tickThread?.quitSafely()
    tickThread = null
  }

  private fun finishTimersTask() {
    val rc = appContext.reactContext as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      taskId?.let { HeadlessJsTaskContext.getInstance(rc).finishTask(it) }
      taskId = null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ChatKeeper")

    Events("onStopRequested", "onTick")

    OnCreate {
      ChatKeeperService.onStopRequested = {
        stopTick()
        finishTimersTask()
        sendEvent("onStopRequested", emptyMap<String, Any?>())
      }
    }

    OnDestroy {
      ChatKeeperService.onStopRequested = null
      stopTick()
      finishTimersTask()
      appContext.reactContext?.let { ChatKeeperService.stop(it) }
    }

    // Must be called while the app is in the foreground (Android 12+ forbids starting a
    // foreground service from the background); it then keeps running after the app is left.
    Function("start") { title: String ->
      ChatKeeperService.title = title
      ChatKeeperService.messages = emptyList()
      ChatKeeperService.start(context)
      startTimersTask()
      startTick()
    }

    // Plain maps rather than a Record: called every second, and Records fall back to reflection.
    Function("update") { title: String, messages: List<Map<String, Any?>> ->
      ChatKeeperService.title = title
      ChatKeeperService.messages = messages.map {
        KeeperMessage(it["nickname"] as? String ?: "", it["text"] as? String ?: "", (it["time"] as? Number)?.toLong() ?: 0L)
      }
      ChatKeeperService.refresh(context)
    }

    Function("stop") {
      ChatKeeperService.messages = emptyList()
      stopTick()
      finishTimersTask()
      ChatKeeperService.stop(context)
    }
  }
}
