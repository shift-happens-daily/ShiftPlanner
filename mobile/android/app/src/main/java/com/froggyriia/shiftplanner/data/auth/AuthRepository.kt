package com.froggyriia.shiftplanner.data.auth

import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole

interface AuthRepository {
    suspend fun login(
        email: String,
        password: String
    ): AppUser

    suspend fun signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ): AppUser

    suspend fun logout()

    suspend fun getCurrentUser(): AppUser?
}