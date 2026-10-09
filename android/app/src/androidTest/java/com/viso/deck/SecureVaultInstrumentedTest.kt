package com.viso.deck

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SecureVaultInstrumentedTest {
    @Test fun ciphertextSurvivesReloadWithoutStoringPlaintextAndCanBeRevoked() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "auth:instrumented-${UUID.randomUUID()}"
        val secret = "temporary-${UUID.randomUUID()}"
        val preferences = context.getSharedPreferences("viso_encrypted_vault", Context.MODE_PRIVATE)
        val vault = SecureVault(context)
        try {
            vault.set(name, secret)
            assertEquals(secret, SecureVault(context).get(name))
            assertFalse(preferences.all.values.any { it.toString().contains(secret) })
            vault.remove(name)
            assertNull(SecureVault(context).get(name))
        } finally {
            vault.remove(name)
        }
    }

    @Test fun alteredCiphertextCannotBeDecrypted() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "auth:tamper-${UUID.randomUUID()}"
        val preferences = context.getSharedPreferences("viso_encrypted_vault", Context.MODE_PRIVATE)
        val previousKeys = preferences.all.keys.toSet()
        val vault = SecureVault(context)
        try {
            vault.set(name, "temporary-${UUID.randomUUID()}")
            val entry = (preferences.all.keys - previousKeys).single()
            val ciphertext = preferences.getString(entry, null)!!
            val fields = ciphertext.split(':')
            val altered = android.util.Base64.decode(fields[2], android.util.Base64.NO_WRAP)
            altered[0] = (altered[0].toInt() xor 1).toByte()
            preferences.edit().putString(entry, "${fields[0]}:${fields[1]}:${android.util.Base64.encodeToString(altered, android.util.Base64.NO_WRAP)}").commit()
            var rejected = false
            try { vault.get(name) } catch (_: Exception) { rejected = true }
            assertTrue("Modified ciphertext must fail authentication", rejected)
        } finally {
            vault.remove(name)
        }
    }
}
