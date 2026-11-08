package id.godinov.pos.data.crypto

import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val DECOY_BCRYPT_HASH = "\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
private const val BLOWFISH_ROUNDS = 16
private const val SALT_BYTES = 16
private const val MIN_LOG_ROUNDS = 4
private const val MAX_LOG_ROUNDS = 31

/**
 * Verifies a 4-6 digit cashier PIN offline against an OpenBSD `$2a$`/`$2b$`/`$2y$` BCrypt hash.
 * Runs on [Dispatchers.Default] and hashes against a decoy salt when [pinHash] is missing so timing stays uniform.
 */
suspend fun verifyStaffPin(
    pin: String,
    pinHash: String?,
): Boolean =
    withContext(Dispatchers.Default) {
        val candidateHash = pinHash?.takeIf { it.isNotBlank() } ?: DECOY_BCRYPT_HASH
        val computed = hashBcryptOrNull(pin, candidateHash) ?: return@withContext false
        val matches =
            MessageDigest.isEqual(
                candidateHash.toByteArray(Charsets.UTF_8),
                computed.toByteArray(Charsets.UTF_8),
            )
        matches && !pinHash.isNullOrBlank()
    }

internal fun hashBcryptOrNull(
    password: String,
    salt: String,
): String? {
    val rawPassword = password.toByteArray(Charsets.UTF_8)
    if (rawPassword.size > 72 || salt.length < 28 || salt[0] != '$' || salt[1] != '2') return null

    val minor: Char
    val offset: Int
    if (salt[2] == '$') {
        minor = '\u0000'
        offset = 3
    } else {
        minor = salt[2]
        if ((minor != 'a' && minor != 'b' && minor != 'y') || salt[3] != '$') return null
        if (salt.length < 29) return null
        offset = 4
    }
    if (salt[offset + 2] != '$') return null

    val logRounds = salt.substring(offset, offset + 2).toIntOrNull() ?: return null
    if (logRounds !in MIN_LOG_ROUNDS..MAX_LOG_ROUNDS) return null

    val realSalt = decodeBcryptBase64(salt.substring(offset + 3, offset + 25), SALT_BYTES)
    if (realSalt.size != SALT_BYTES) return null

    val passwordBytes =
        if (minor >= 'a') {
            ByteArray(rawPassword.size + 1).also {
                rawPassword.copyInto(it, 0, 0, rawPassword.size)
            }
        } else {
            rawPassword
        }

    val cipherBytes = EksBlowfishState().cryptRaw(passwordBytes, realSalt, logRounds)
    return buildString(60) {
        append("\$2")
        if (minor >= 'a') append(minor)
        append('$')
        if (logRounds < 10) append('0')
        append(logRounds)
        append('$')
        append(encodeBcryptBase64(realSalt, realSalt.size))
        append(encodeBcryptBase64(cipherBytes, BcryptMagicCiphertext.size * 4 - 1))
    }
}

private class EksBlowfishState {
    private val p = BcryptInitialP.copyOf()
    private val s = BcryptInitialS.copyOf()

    fun cryptRaw(
        password: ByteArray,
        salt: ByteArray,
        logRounds: Int,
    ): ByteArray {
        enhancedKeySchedule(salt, password)
        val rounds = 1 shl logRounds
        for (i in 0 until rounds) {
            expandKey(password)
            expandKey(salt)
        }
        val cdata = BcryptMagicCiphertext.copyOf()
        for (i in 0 until 64) {
            var j = 0
            while (j < cdata.size) {
                encipher(cdata, j)
                j += 2
            }
        }
        val out = ByteArray(cdata.size * 4)
        var idx = 0
        for (word in cdata) {
            out[idx++] = ((word ushr 24) and 0xff).toByte()
            out[idx++] = ((word ushr 16) and 0xff).toByte()
            out[idx++] = ((word ushr 8) and 0xff).toByte()
            out[idx++] = (word and 0xff).toByte()
        }
        return out
    }

    private fun encipher(
        lr: IntArray,
        off: Int,
    ) {
        var l = lr[off] xor p[0]
        var r = lr[off + 1]
        var i = 0
        while (i <= BLOWFISH_ROUNDS - 2) {
            var n = s[(l ushr 24) and 0xff]
            n += s[0x100 or ((l ushr 16) and 0xff)]
            n = n xor s[0x200 or ((l ushr 8) and 0xff)]
            n += s[0x300 or (l and 0xff)]
            r = r xor (n xor p[++i])

            n = s[(r ushr 24) and 0xff]
            n += s[0x100 or ((r ushr 16) and 0xff)]
            n = n xor s[0x200 or ((r ushr 8) and 0xff)]
            n += s[0x300 or (r and 0xff)]
            l = l xor (n xor p[++i])
        }
        lr[off] = r xor p[BLOWFISH_ROUNDS + 1]
        lr[off + 1] = l
    }

    private fun enhancedKeySchedule(
        salt: ByteArray,
        key: ByteArray,
    ) {
        val keyOff = IntArray(1)
        val saltOff = IntArray(1)
        val lr = IntArray(2)
        for (i in p.indices) {
            p[i] = p[i] xor streamToWord(key, keyOff)
        }
        var i = 0
        while (i < p.size) {
            lr[0] = lr[0] xor streamToWord(salt, saltOff)
            lr[1] = lr[1] xor streamToWord(salt, saltOff)
            encipher(lr, 0)
            p[i] = lr[0]
            p[i + 1] = lr[1]
            i += 2
        }
        i = 0
        while (i < s.size) {
            lr[0] = lr[0] xor streamToWord(salt, saltOff)
            lr[1] = lr[1] xor streamToWord(salt, saltOff)
            encipher(lr, 0)
            s[i] = lr[0]
            s[i + 1] = lr[1]
            i += 2
        }
    }

    private fun expandKey(key: ByteArray) {
        val keyOff = IntArray(1)
        val lr = IntArray(2)
        for (i in p.indices) {
            p[i] = p[i] xor streamToWord(key, keyOff)
        }
        var i = 0
        while (i < p.size) {
            encipher(lr, 0)
            p[i] = lr[0]
            p[i + 1] = lr[1]
            i += 2
        }
        i = 0
        while (i < s.size) {
            encipher(lr, 0)
            s[i] = lr[0]
            s[i + 1] = lr[1]
            i += 2
        }
    }

    private fun streamToWord(
        data: ByteArray,
        offsetHolder: IntArray,
    ): Int {
        var word = 0
        var off = offsetHolder[0]
        for (i in 0 until 4) {
            word = (word shl 8) or (data[off].toInt() and 0xff)
            off = (off + 1) % data.size
        }
        offsetHolder[0] = off
        return word
    }
}

private fun char64(ch: Char): Int {
    val code = ch.code
    return if (code in BcryptBase64Decode.indices) BcryptBase64Decode[code].toInt() else -1
}

private fun decodeBcryptBase64(
    encoded: String,
    maxBytes: Int,
): ByteArray {
    val buffer = ByteArray(maxBytes)
    var outLen = 0
    var off = 0
    while (off < encoded.length - 1 && outLen < maxBytes) {
        val c1 = char64(encoded[off++])
        val c2 = char64(encoded[off++])
        if (c1 == -1 || c2 == -1) break
        buffer[outLen++] = ((c1 shl 2) or ((c2 and 0x30) ushr 4)).toByte()
        if (outLen >= maxBytes || off >= encoded.length) break
        val c3 = char64(encoded[off++])
        if (c3 == -1) break
        buffer[outLen++] = (((c2 and 0x0f) shl 4) or ((c3 and 0x3c) ushr 2)).toByte()
        if (outLen >= maxBytes || off >= encoded.length) break
        val c4 = char64(encoded[off++])
        if (c4 == -1) break
        buffer[outLen++] = (((c3 and 0x03) shl 6) or c4).toByte()
    }
    return if (outLen == maxBytes) buffer else buffer.copyOf(outLen)
}

private fun encodeBcryptBase64(
    data: ByteArray,
    length: Int,
): String =
    buildString((length * 4 + 2) / 3) {
        var off = 0
        while (off < length) {
            var c1 = data[off++].toInt() and 0xff
            append(BcryptBase64Alphabet[(c1 ushr 2) and 0x3f])
            c1 = (c1 and 0x03) shl 4
            if (off >= length) {
                append(BcryptBase64Alphabet[c1 and 0x3f])
                break
            }
            var c2 = data[off++].toInt() and 0xff
            c1 = c1 or ((c2 ushr 4) and 0x0f)
            append(BcryptBase64Alphabet[c1 and 0x3f])
            c1 = (c2 and 0x0f) shl 2
            if (off >= length) {
                append(BcryptBase64Alphabet[c1 and 0x3f])
                break
            }
            c2 = data[off++].toInt() and 0xff
            c1 = c1 or ((c2 ushr 6) and 0x03)
            append(BcryptBase64Alphabet[c1 and 0x3f])
            append(BcryptBase64Alphabet[c2 and 0x3f])
        }
    }
