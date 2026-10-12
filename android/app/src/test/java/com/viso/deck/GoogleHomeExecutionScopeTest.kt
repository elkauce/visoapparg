package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class GoogleHomeExecutionScopeTest {
    @Test fun manualCommandsPauseButAnOptedInDeckCanKeepSignalingDuringACall() {
        val owner = GoogleHomeOwnerScope()
        val execution = GoogleHomeExecutionScope(owner)
        owner.activate("account-A")
        execution.setForeground(true)
        assertTrue(execution.canSynchronize())
        execution.setForeground(false)
        assertFalse(execution.canSynchronize())
        execution.setBackground("account-A", true)
        assertTrue(execution.canSynchronize())
        execution.setBackground("account-A", false)
        assertFalse(execution.canSynchronize())
    }
    @Test fun logoutAndAccountSwitchInvalidateBackgroundAccessWithoutReactivatingAnOldOwner() {
        val owner = GoogleHomeOwnerScope()
        val execution = GoogleHomeExecutionScope(owner)
        owner.activate("account-A")
        execution.setBackground("account-A", true)
        val command = owner.begin("account-A")
        owner.activate("account-B")
        assertFalse(execution.canSynchronize())
        assertFalse(owner.isCurrent(command))
        assertThrows(IllegalStateException::class.java) { execution.setBackground("account-A", true) }
        execution.clearBackground()
        owner.activate(null)
        assertFalse(execution.canSynchronize())
    }
    @Test fun staleDisableRequestsCannotPauseANewAccountsOptedInDeck() {
        val owner = GoogleHomeOwnerScope()
        val execution = GoogleHomeExecutionScope(owner)
        owner.activate("account-A")
        execution.setBackground("account-A", true)
        owner.activate("account-B")
        execution.clearBackground()
        execution.setBackground("account-B", true)
        assertThrows(IllegalStateException::class.java) { execution.setBackground("account-A", false) }
        assertTrue(execution.canSynchronize())
        execution.setBackground(null, false)
        assertFalse(execution.canSynchronize())
    }
}
