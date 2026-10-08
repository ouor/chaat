package expo.modules.chatkeeper

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class ChatKeeperModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ChatKeeper")

    Events("onStopRequested")

    OnCreate {
      ChatKeeperService.onStopRequested = { sendEvent("onStopRequested", emptyMap<String, Any?>()) }
    }

    OnDestroy {
      ChatKeeperService.onStopRequested = null
      appContext.reactContext?.let { ChatKeeperService.stop(it) }
    }

    // Must be called while the app is in the foreground (Android 12+ forbids starting a
    // foreground service from the background); it then keeps running after the app is left.
    Function("start") { title: String ->
      ChatKeeperService.title = title
      ChatKeeperService.messages = emptyList()
      ChatKeeperService.start(context)
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
      ChatKeeperService.stop(context)
    }
  }
}
