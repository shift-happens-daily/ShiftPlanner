package com.froggyriia.shiftplanner.data.auth

import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole
import kotlinx.coroutines.delay
import java.util.UUID

class MockAuthRepository : AuthRepository {
    private var currentUser: AppUser? = null

    override suspend fun login(
        email: String,
        password: String
    ): AppUser {
        delay(700)

        validateLogin(email, password)

        val user = AppUser(
            id = UUID.randomUUID().toString(),
            email = email,
            name = "Test User",
            role = UserRole.MANAGER
        )

        currentUser = user
        return user
    }

    override suspend fun signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ): AppUser {
        delay(700)

        validateSignUp(email, password, name)

        val user = AppUser(
            id = UUID.randomUUID().toString(),
            email = email,
            name = name,
            role = role
        )

        currentUser = user
        return user
    }

    override suspend fun logout() {
        currentUser = null
    }

    override suspend fun getCurrentUser(): AppUser? {
        return currentUser
    }

    private fun validateLogin(
        email: String,
        password: String
    ) {
        if (email.isBlank()) {
            throw IllegalArgumentException("Email is required")
        }

        if (!email.contains("@")) {
            throw IllegalArgumentException("Enter a valid email")
        }

        if (password.isBlank()) {
            throw IllegalArgumentException("Password is required")
        }
    }

    private fun validateSignUp(
        email: String,
        password: String,
        name: String
    ) {
        if (name.isBlank()) {
            throw IllegalArgumentException("Name is required")
        }

        if (email.isBlank()) {
            throw IllegalArgumentException("Email is required")
        }

        if (!email.contains("@")) {
            throw IllegalArgumentException("Enter a valid email")
        }

        if (password.isBlank()) {
            throw IllegalArgumentException("Password is required")
        }

        if (password.length < 6) {
            throw IllegalArgumentException("Password must be at least 6 characters")
        }
    }
}