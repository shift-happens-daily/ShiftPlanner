package com.froggyriia.shiftplanner.data.auth

import android.content.Context
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class APIAuthRepository(context: Context) : AuthRepository {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override suspend fun login(
        email: String,
        password: String
    ): AppUser = withContext(Dispatchers.IO) {
        validateLogin(email, password)

        val response = postJson(
            path = "auth/login",
            body = JSONObject()
                .put("email", email)
                .put("password", password)
        )

        val token = response.optString("access_token")
        if (token.isBlank()) {
            throw IllegalStateException("Server did not return an access token.")
        }

        saveAccessToken(token)
        getCurrentUser() ?: throw IllegalStateException("Failed to load current user.")
    }

    override suspend fun signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ): AppUser = withContext(Dispatchers.IO) {
        validateSignUp(email, password, name)

        postJson(
            path = "auth/register",
            body = JSONObject()
                .put("full_name", name)
                .put("email", email)
                .put("password", password)
                .put("role", role.toApiValue())
        )

        login(email, password)
    }

    override suspend fun logout() {
        withContext(Dispatchers.IO) {
            val token = accessToken()
            if (!token.isNullOrBlank()) {
                runCatching {
                    postJson(
                        path = "auth/logout",
                        body = JSONObject(),
                        accessToken = token
                    )
                }
            }
            clearAccessToken()
        }
    }

    override suspend fun getCurrentUser(): AppUser? = withContext(Dispatchers.IO) {
        val token = accessToken() ?: return@withContext null

        try {
            getJson(
                path = "auth/me",
                accessToken = token
            ).toAppUser()
        } catch (error: Exception) {
            clearAccessToken()
            null
        }
    }

    private fun postJson(
        path: String,
        body: JSONObject,
        accessToken: String? = null
    ): JSONObject {
        return request(
            path = path,
            method = "POST",
            body = body,
            accessToken = accessToken
        )
    }

    private fun getJson(
        path: String,
        accessToken: String
    ): JSONObject {
        return request(
            path = path,
            method = "GET",
            body = null,
            accessToken = accessToken
        )
    }

    private fun request(
        path: String,
        method: String,
        body: JSONObject?,
        accessToken: String?
    ): JSONObject {
        val connection = (URL(BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")

            if (!accessToken.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $accessToken")
            }

            if (body != null) {
                doOutput = true
                OutputStreamWriter(outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(body.toString())
                }
            }
        }

        return try {
            val statusCode = connection.responseCode
            val responseText = readResponseText(connection, statusCode)

            if (statusCode !in 200..299) {
                throw IllegalStateException(parseErrorMessage(responseText, statusCode))
            }

            if (responseText.isBlank()) {
                JSONObject()
            } else {
                JSONObject(responseText)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readResponseText(
        connection: HttpURLConnection,
        statusCode: Int
    ): String {
        val stream = if (statusCode in 200..299) {
            connection.inputStream
        } else {
            connection.errorStream ?: connection.inputStream
        }

        return BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { reader ->
            reader.readText()
        }
    }

    private fun parseErrorMessage(
        responseText: String,
        statusCode: Int
    ): String {
        if (responseText.isBlank()) {
            return "Request failed with status code $statusCode."
        }

        return runCatching {
            val detail = JSONObject(responseText).opt("detail")
            when (detail) {
                is String -> detail
                is JSONArray -> parseValidationMessages(detail)
                else -> "Request failed with status code $statusCode."
            }
        }.getOrDefault("Request failed with status code $statusCode.")
    }

    private fun parseValidationMessages(errors: JSONArray): String {
        val messages = mutableListOf<String>()

        for (index in 0 until errors.length()) {
            val item = errors.optJSONObject(index) ?: continue
            val field = item.optString("field")
            val message = item.optString("message")
                .ifBlank { item.optString("msg") }

            if (message.isBlank()) continue

            messages += if (field.isBlank()) {
                message
            } else {
                "$field: $message"
            }
        }

        return messages.joinToString("\n").ifBlank { "Invalid input." }
    }

    private fun JSONObject.toAppUser(): AppUser {
        return AppUser(
            id = optString("public_id").ifBlank { optInt("id").toString() },
            email = optString("email"),
            name = optString("full_name"),
            role = optString("role").toUserRole()
        )
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

        validateLogin(email, password)

        if (password.length < 8) {
            throw IllegalArgumentException("Password must be at least 8 characters")
        }
    }

    private fun UserRole.toApiValue(): String {
        return when (this) {
            UserRole.MANAGER -> "manager"
            UserRole.EMPLOYEE -> "employee"
        }
    }

    private fun String.toUserRole(): UserRole {
        return when (lowercase()) {
            "manager" -> UserRole.MANAGER
            else -> UserRole.EMPLOYEE
        }
    }

    private fun accessToken(): String? {
        return preferences.getString(ACCESS_TOKEN_KEY, null)
    }

    private fun saveAccessToken(token: String) {
        preferences.edit().putString(ACCESS_TOKEN_KEY, token).apply()
    }

    private fun clearAccessToken() {
        preferences.edit().remove(ACCESS_TOKEN_KEY).apply()
    }

    private companion object {
        const val BASE_URL = "https://shiftplanner.online/api/"
        const val TIMEOUT_MS = 15_000
        const val PREFERENCES_NAME = "shiftplanner.auth"
        const val ACCESS_TOKEN_KEY = "access_token"
    }
}
