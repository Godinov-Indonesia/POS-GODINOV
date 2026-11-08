package id.godinov.pos.data.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Hardware-backed AES-256-GCM envelope cipher backed by `AndroidKeyStore`.
 * Protects internal `SharedPreferences` values and wraps the 256-bit SQLCipher database key.
 */
object AppStorageCipher {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val MASTER_KEY_ALIAS = "godinov_pos_internal_storage_aes256_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE_BITS = 256
    private const val GCM_TAG_BITS = 128
    private const val MIN_IV_BYTES = 12
    private const val MAX_IV_BYTES = 16

    private val keyLock = Any()

    fun generateRandomKeyBytes(lengthBytes: Int = 32): ByteArray =
        ByteArray(lengthBytes).also { SecureRandom().nextBytes(it) }

    fun encryptString(
        aad: String,
        plaintext: String,
    ): String = encryptBytes(aad, plaintext.toByteArray(Charsets.UTF_8))

    fun decryptString(
        aad: String,
        encoded: String,
    ): String? = decryptBytes(aad, encoded)?.toString(Charsets.UTF_8)

    fun encryptBytes(
        aad: String,
        plaintext: ByteArray,
    ): String {
        val secretKey = getOrCreateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext)

        val packed = ByteArray(1 + iv.size + ciphertext.size)
        packed[0] = iv.size.toByte()
        System.arraycopy(iv, 0, packed, 1, iv.size)
        System.arraycopy(ciphertext, 0, packed, 1 + iv.size, ciphertext.size)
        return Base64.encodeToString(packed, Base64.NO_WRAP)
    }

    fun decryptBytes(
        aad: String,
        encoded: String,
    ): ByteArray? {
        if (encoded.isBlank()) return null
        return try {
            val packed = Base64.decode(encoded, Base64.NO_WRAP)
            if (packed.size <= 1 + MIN_IV_BYTES + (GCM_TAG_BITS / 8)) return null
            val ivLength = packed[0].toInt() and 0xFF
            if (ivLength !in MIN_IV_BYTES..MAX_IV_BYTES || packed.size <= 1 + ivLength) return null

            val secretKey = getOrCreateMasterKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_BITS, packed, 1, ivLength)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
            cipher.doFinal(packed, 1 + ivLength, packed.size - 1 - ivLength)
        } catch (_: GeneralSecurityException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun getOrCreateMasterKey(): SecretKey =
        synchronized(keyLock) {
            val keyStore =
                KeyStore.getInstance(ANDROID_KEYSTORE).apply {
                    try {
                        load(null)
                    } catch (e: IOException) {
                        throw IllegalStateException("Failed to load AndroidKeyStore", e)
                    }
                }
            val existing = (keyStore.getEntry(MASTER_KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.secretKey
            if (existing != null) return@synchronized existing

            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            val spec =
                KeyGenParameterSpec
                    .Builder(
                        MASTER_KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(KEY_SIZE_BITS)
                    .setRandomizedEncryptionRequired(true)
                    .build()
            generator.init(spec)
            generator.generateKey()
        }
}
