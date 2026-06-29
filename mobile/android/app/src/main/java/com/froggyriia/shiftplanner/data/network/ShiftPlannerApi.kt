package com.froggyriia.shiftplanner.data.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST

interface ShiftPlannerApi {
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequestDto
    ): LoginResponseDto

    @POST("auth/register")
    suspend fun register(
        @Body request: RegisterRequestDto
    ): RegisterResponseDto

    @GET("auth/me")
    suspend fun getCurrentUser(): CurrentUserResponseDto

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    @DELETE("auth/me")
    suspend fun deleteCurrentAccount(): Response<Unit>
}
