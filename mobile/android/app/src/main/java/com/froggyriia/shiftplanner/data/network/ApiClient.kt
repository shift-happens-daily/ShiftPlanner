package com.froggyriia.shiftplanner.data.network

import com.google.gson.Gson
import com.google.gson.JsonParser
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
            is ApiException -> error.message ?: "Request failed"
            is HttpException -> parseHttpError(error)
            is IOException -> "Cannot reach the server at $DEFAULT_BASE_URL. Start the backend. Android Emulator should use http://10.0.2.2:8000/."
            else -> error.message ?: "Request failed"
        }
    }

    private fun parseHttpError(error: HttpException): String {
        val rawBody = error.response()?.errorBody()?.string()
            ?.trim()
            .orEmpty()

        if (rawBody.isNotEmpty()) {
            runCatching {
                val validation = gson.fromJson(rawBody, ApiValidationErrorResponse::class.java)
                validation.detail?.firstOrNull()?.msg
            }.getOrNull()?.let { return it }

            runCatching {
                val apiError = gson.fromJson(rawBody, ApiErrorResponse::class.java)
                apiError.detail
            }.getOrNull()?.let { return it }

            runCatching {
                JsonParser.parseString(rawBody).toString()
            }.getOrNull()?.let { return it }

            return rawBody
        }

        return "Request failed with status code ${error.code()}."
    }

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:8000/"
    }
}
