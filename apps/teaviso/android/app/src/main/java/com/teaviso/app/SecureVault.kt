package com.teaviso.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** AES-256-GCM values; the encryption key is generated inside AndroidKeyStore. */
internal class SecureVault(context: Context) {
    companion object {
        // Foreground integrations and background services use separate vault
        // instances. Key lookup/creation must share a lock so that the second
        // instance reuses the existing alias instead of replacing its key.
        private val keyLock = Any()
    }

    private val preferences = context.getSharedPreferences("teaviso_encrypted_vault", Context.MODE_PRIVATE)
    private val alias = "${context.packageName}.vault.aes256.v1"

    private fun key(): SecretKey = synchronized(keyLock) {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return@synchronized it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        generator.generateKey()
    }

    private fun storageKey(name: String): String = MessageDigest.getInstance("SHA-256")
        .digest(name.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    @Synchronized
    fun set(name: String, value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(name.toByteArray(Charsets.UTF_8))
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val encoded = "1:${Base64.encodeToString(cipher.iv, Base64.NO_WRAP)}:${Base64.encodeToString(encrypted, Base64.NO_WRAP)}"
        check(preferences.edit().putString(storageKey(name), encoded).commit())
    }

    @Synchronized
    fun get(name: String): String? {
        val encoded = preferences.getString(storageKey(name), null) ?: return null
        val fields = encoded.split(':')
        check(fields.size == 3 && fields[0] == "1")
        val iv = Base64.decode(fields[1], Base64.NO_WRAP)
        check(iv.size == 12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        cipher.updateAAD(name.toByteArray(Charsets.UTF_8))
        return cipher.doFinal(Base64.decode(fields[2], Base64.NO_WRAP)).toString(Charsets.UTF_8)
    }

    @Synchronized
    fun remove(name: String) {
        check(preferences.edit().remove(storageKey(name)).commit())
    }
}
