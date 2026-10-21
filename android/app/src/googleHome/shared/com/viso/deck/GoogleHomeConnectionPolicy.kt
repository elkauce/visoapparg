package com.viso.deck

/** An unavailable check is not evidence that the owner revoked consent. */
internal object GoogleHomeConnectionPolicy {
    enum class Permission(val value: String) {
        GRANTED("granted"), NOT_GRANTED("not-granted"), UNKNOWN("unknown")
    }

    data class Verification(
        val authorized: Boolean,
        val verificationPending: Boolean,
        val requiresAuthorization: Boolean
    )

    fun verify(available: Boolean, permission: Permission, structureCount: Int?): Verification = when {
        !available -> Verification(false, false, false)
        permission == Permission.NOT_GRANTED -> Verification(false, false, true)
        permission == Permission.UNKNOWN || structureCount == null -> Verification(false, true, false)
        structureCount == 0 -> Verification(false, false, true)
        else -> Verification(true, false, false)
    }

    /** Previously chosen IDs may survive an incomplete list, but are not a live grant. */
    fun newSelections(selected: List<String>, previous: List<String>): List<String> =
        selected.filterNot(previous.toSet()::contains)
}
