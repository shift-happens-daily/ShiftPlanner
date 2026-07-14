package com.froggyriia.shiftplanner.data.auth

import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole

interface AuthRepository {
    suspend fun login(
        email: String,
        password: String
    ): AppUser

    // Returns null if email verification is required (user must check inbox before logging in)
    suspend fun signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ): AppUser?

    suspend fun logout()

    suspend fun getCurrentUser(): AppUser?

    suspend fun deleteAccount()
}