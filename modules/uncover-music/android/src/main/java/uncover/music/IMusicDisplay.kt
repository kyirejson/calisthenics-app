package uncover.music

import android.os.Binder
import android.os.IBinder
import android.os.IInterface
import android.os.Parcel

/** Typed, private Binder protocol. No arbitrary command, intent, package or display target.
 * Kept in Kotlin because Windows AIDL embeds unescaped Windows paths in generated Java comments.
 */
interface IMusicDisplay : IInterface {
  fun open(provider: String, uri: String, query: String, title: String, artist: String, focus: String): String
  fun state(): String
  fun tap(provider: String, x: Float, y: Float): Boolean
  fun key(provider: String, keyCode: Int): Boolean
  fun release()
  fun destroy()

  abstract class Stub : Binder(), IMusicDisplay {
    init { attachInterface(this, DESCRIPTOR) }
    override fun asBinder(): IBinder = this
    override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
      if (code == INTERFACE_TRANSACTION) { reply?.writeString(DESCRIPTOR); return true }
      if (code !in setOf(OPEN, STATE, TAP, KEY, RELEASE, DESTROY)) return super.onTransact(code, data, reply, flags)
      data.enforceInterface(DESCRIPTOR)
      val result: Any? = when (code) {
        OPEN -> { val values = List(6) { data.readString() ?: "" }; require(data.dataAvail() == 0); open(values[0], values[1], values[2], values[3], values[4], values[5]) }
        STATE -> { require(data.dataAvail() == 0); state() }
        TAP -> { val provider = data.readString() ?: ""; val x = data.readFloat(); val y = data.readFloat(); require(data.dataAvail() == 0); tap(provider, x, y) }
        KEY -> { val provider = data.readString() ?: ""; val keyCode = data.readInt(); require(data.dataAvail() == 0); key(provider, keyCode) }
        RELEASE -> { require(data.dataAvail() == 0); release(); null }
        else -> { require(data.dataAvail() == 0); destroy(); null }
      }
      reply?.writeNoException()
      when (result) { is String -> reply?.writeString(result); is Boolean -> reply?.writeInt(if (result) 1 else 0) }
      return true
    }
    companion object {
      private const val DESCRIPTOR = "uncover.music.IMusicDisplay"
      private const val OPEN = 2
      private const val STATE = 3
      private const val TAP = 4
      private const val KEY = 5
      private const val RELEASE = 6
      // Shizuku's reserved teardown transaction, not an ordinary model command.
      private const val DESTROY = 16777115
      fun asInterface(binder: IBinder): IMusicDisplay = binder.queryLocalInterface(DESCRIPTOR) as? IMusicDisplay ?: Proxy(binder)
      private class Proxy(private val binder: IBinder) : IMusicDisplay {
        override fun asBinder() = binder
        private fun <T> call(code: Int, write: (Parcel) -> Unit = {}, read: (Parcel) -> T): T {
          val data = Parcel.obtain(); val reply = Parcel.obtain()
          try {
            data.writeInterfaceToken(DESCRIPTOR); write(data)
            if (!binder.transact(code, data, reply, 0)) throw MusicFailure("background_protocol_error", "系统后台接口未接受请求。")
            reply.readException()
            return read(reply)
          } finally { data.recycle(); reply.recycle() }
        }
        override fun open(provider: String, uri: String, query: String, title: String, artist: String, focus: String) = call(OPEN, { parcel -> listOf(provider, uri, query, title, artist, focus).forEach { parcel.writeString(it) } }) { it.readString() ?: error("Missing music open result") }
        override fun state() = call(STATE) { it.readString() ?: error("Missing music display state") }
        override fun tap(provider: String, x: Float, y: Float) = call(TAP, { it.writeString(provider); it.writeFloat(x); it.writeFloat(y) }) { it.readInt() != 0 }
        override fun key(provider: String, keyCode: Int) = call(KEY, { it.writeString(provider); it.writeInt(keyCode) }) { it.readInt() != 0 }
        override fun release() = call(RELEASE) { Unit }
        override fun destroy() = call(DESTROY) { Unit }
      }
    }
  }
}
