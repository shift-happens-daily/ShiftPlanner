package com.froggyriia.shiftplanner.data.auth

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.LoginRequestDto
import com.froggyriia.shiftplanner.data.network.RegisterRequestDto
import com.froggyriia.shiftplanner.data.network.TokenStore
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole

class ApiAuthRepository(
    private val apiClient: ApiClient,
    private val tokenStore: TokenStore
) : AuthRepository {
    override suspend fun login(
        email: String,
        password: String
    ): AppUser {
        try {
            val loginResponse = apiClient.api.login(
                LoginRequestDto(
                    email = email,
                    password = password
                )
            )
            tokenStore.saveAccessToken(loginResponse.accessToken)
            return apiClient.api.getCurrentUser().toAppUser()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }

    override suspend fun signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ): AppUser? {
        try {
            val response = apiClient.api.register(
                RegisterRequestDto(
                    fullName = name,
                    email = email,
                    password = password,
                    role = role
                )
            )
            if (response.emailVerificationRequired) {
                return null // caller should show "check your inbox" UI
            }
            return login(email = email, password = password)
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }

    override suspend fun logout() {
        runCatching { apiClient.api.logout() }
        tokenStore.clearAccessToken()
    }

    override suspend fun deleteAccount() {
        try {
            apiClient.api.deleteCurrentAccount()
        } catch (_: Throwable) {}
        tokenStore.clearAccessToken()
    }

    override suspend fun getCurrentUser(): AppUser? {
        if (tokenStore.getAccessToken().isNullOrBlank()) {
            return null
        }

        return try {
            apiClient.api.getCurrentUser().toAppUser()
        } catch (_: Throwable) {
            tokenStore.clearAccessToken()
            null
        }
    }
}
