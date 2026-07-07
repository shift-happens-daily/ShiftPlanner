package com.froggyriia.shiftplanner.data.network

import com.froggyriia.shiftplanner.BuildConfig
import com.google.gson.Gson
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException

class ApiClient(
    private val tokenStore: TokenStore,
    baseUrl: String = DEFAULT_BASE_URL
) {
    private val gson = Gson()

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val originalRequest = chain.request()
            val token = runBlocking { tokenStore.getAccessToken() }

            val request = if (token.isNullOrBlank()) {
                originalRequest
            } else {
                originalRequest.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            }

            chain.proceed(request)
        }
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
        )
        .build()

    val api: ShiftPlannerApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()
        .create(ShiftPlannerApi::class.java)

    fun userMessage(error: Throwable): String {
        return when (error) {
            is ApiException -> error.message ?: "Something went wrong."
            is HttpException -> parseHttpError(error)
            is IOException -> "Can't reach the server. Check that the backend is running and the device is on the same network."
            else -> error.message?.takeIf { it.isNotBlank() } ?: "Something went wrong."
        }
    }

    private fun parseHttpError(error: HttpException): String {
        val code = error.code()
        val rawBody = error.response()?.errorBody()?.string()?.trim().orEmpty()

        if (rawBody.isNotEmpty()) {
            // FastAPI validation error: { "detail": [ { "loc": [...], "msg": "...", "type": "..." } ] }
            runCatching {
                val validation = gson.fromJson(rawBody, ApiValidationErrorResponse::class.java)
                val items = validation.detail?.takeIf { it.isNotEmpty() } ?: return@runCatching null
                items.mapNotNull { item ->
                    val field = item.loc?.drop(1)?.joinToString(".")?.takeIf { it.isNotBlank() }
                    val msg = item.msg?.removePrefix("Value error, ")?.trim()?.takeIf { it.isNotBlank() }
                    when {
                        msg == null -> null
                        field == null -> msg
                        else -> "$field: $msg"
                    }
                }.joinToString("\n").takeIf { it.isNotBlank() }
            }.getOrNull()?.let { return it }

            // FastAPI simple error: { "detail": "some message" }
            runCatching {
                gson.fromJson(rawBody, ApiErrorResponse::class.java).detail?.trim()?.takeIf { it.isNotBlank() }
            }.getOrNull()?.let { return it }
        }

        // Fallback: human-readable message by HTTP status code
        return when (code) {
            400 -> "Invalid request. Please check your input."
            401 -> "Your session has expired. Please log in again."
            403 -> "You don't have permission to perform this action."
            404 -> "The requested item was not found."
            409 -> "This conflicts with existing data (duplicate or already exists)."
            422 -> "Invalid input. Please check your data and try again."
            429 -> "Too many requests. Please wait a moment and try again."
            in 500..599 -> "Server error. Please try again later."
            else -> "Request failed (HTTP $code)."
        }
    }

    companion object {
        val DEFAULT_BASE_URL: String get() = BuildConfig.BASE_URL
    }
}
