package com.froggyriia.shiftplanner.data.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ShiftPlannerApi {

    // ── Auth ──────────────────────────────────────────────────────────────────

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequestDto): LoginResponseDto

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequestDto): RegisterResponseDto

    @GET("auth/me")
    suspend fun getCurrentUser(): CurrentUserResponseDto

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    @DELETE("auth/me")
    suspend fun deleteCurrentAccount(): Response<Unit>

    // ── Companies ─────────────────────────────────────────────────────────────

    @POST("companies/")
    suspend fun createCompany(@Body request: CompanyCreateRequestDto): CompanyResponseDto

    @GET("companies/me")
    suspend fun getMyCompany(): CompanyResponseDto

    @PATCH("companies/me")
    suspend fun updateMyCompany(@Body request: CompanyUpdateRequestDto): CompanyResponseDto

    @POST("companies/me/invite-code/regenerate")
    suspend fun regenerateInviteCode(): CompanyResponseDto

    @GET("companies/branches")
    suspend fun getBranches(): List<CompanyBranchResponseDto>

    @POST("companies/branches")
    suspend fun createBranch(@Body request: CompanyBranchCreateRequestDto): CompanyBranchResponseDto

    @PATCH("companies/branches/{branchId}")
    suspend fun updateBranch(
        @Path("branchId") branchId: Int,
        @Body request: CompanyBranchUpdateRequestDto
    ): CompanyBranchResponseDto

    @DELETE("companies/branches/{branchId}")
    suspend fun deleteBranch(@Path("branchId") branchId: Int): Response<Unit>

    @GET("companies/invite/{code}")
    suspend fun previewInvite(@Path("code") code: String): CompanyInvitePreviewResponseDto

    @POST("companies/join")
    suspend fun joinCompany(@Body request: CompanyJoinRequestDto): CurrentUserResponseDto

    // ── Employees ─────────────────────────────────────────────────────────────

    @GET("employees/")
    suspend fun getEmployees(): List<EmployeeResponseDto>

    @POST("employees/")
    suspend fun createEmployee(@Body request: EmployeeCreateRequestDto): EmployeeResponseDto

    @DELETE("employees/{id}")
    suspend fun deleteEmployee(@Path("id") id: Int): Response<Unit>

    @PATCH("employees/{id}/position")
    suspend fun updateEmployeePosition(
        @Path("id") id: Int,
        @Body request: EmployeePositionUpdateRequestDto
    ): EmployeeResponseDto

    @PATCH("employees/{id}/branch")
    suspend fun updateEmployeeBranch(
        @Path("id") id: Int,
        @Body request: EmployeeBranchUpdateRequestDto
    ): EmployeeResponseDto

    // ── Positions ─────────────────────────────────────────────────────────────

    @GET("positions/")
    suspend fun getPositions(): List<PositionResponseDto>

    @POST("positions/")
    suspend fun createPosition(@Body request: PositionCreateRequestDto): PositionResponseDto

    @DELETE("positions/{id}")
    suspend fun deletePosition(@Path("id") id: Int): Response<Unit>

    // ── Availability ──────────────────────────────────────────────────────────

    @GET("employees/{id}/availability")
    suspend fun getEmployeeAvailability(@Path("id") id: Int): EmployeeAvailabilityResponseDto

    @POST("employees/{id}/availability")
    suspend fun saveEmployeeAvailability(
        @Path("id") id: Int,
        @Body request: EmployeeAvailabilityUpsertDto
    ): EmployeeAvailabilityResponseDto

    // ── Requirements ──────────────────────────────────────────────────────────

    @GET("schedule/requirements")
    suspend fun getRequirements(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): List<ScheduleRequirementResponseDto>

    @POST("schedule/requirements")
    suspend fun createRequirement(@Body request: ScheduleRequirementCreateDto): ScheduleRequirementResponseDto

    @PATCH("schedule/requirements/{id}")
    suspend fun updateRequirement(
        @Path("id") id: Int,
        @Body request: ScheduleRequirementUpdateDto
    ): ScheduleRequirementResponseDto

    @DELETE("schedule/requirements/{id}")
    suspend fun deleteRequirement(@Path("id") id: Int): Response<Unit>

    @POST("schedule/requirements/bulk")
    suspend fun createRequirementsBulk(@Body request: ScheduleRequirementBulkCreateDto): ScheduleRequirementBulkResponseDto

    // ── Schedule ──────────────────────────────────────────────────────────────

    @POST("schedule/generate")
    suspend fun generateSchedule(@Body request: ScheduleGenerateRequestDto): ScheduleResponseDto

    @GET("schedule/latest")
    suspend fun getLatestSchedule(@Query("status") status: String? = null): Response<ScheduleResponseDto>

    @GET("schedule/{id}")
    suspend fun getSchedule(@Path("id") id: Int): ScheduleResponseDto

    @POST("schedule/{id}/publish")
    suspend fun publishSchedule(@Path("id") id: Int): ScheduleResponseDto

    @GET("schedule/my")
    suspend fun getMySchedule(): List<ScheduleShiftResponseDto>

    @POST("schedule/{scheduleId}/shifts")
    suspend fun createShift(
        @Path("scheduleId") scheduleId: Int,
        @Body request: ManualShiftCreateRequestDto
    ): ScheduleResponseDto

    @PATCH("schedule/{scheduleId}/shifts/{shiftId}")
    suspend fun updateShift(
        @Path("scheduleId") scheduleId: Int,
        @Path("shiftId") shiftId: Int,
        @Body request: ScheduleShiftUpdateRequestDto
    ): ScheduleResponseDto

    @DELETE("schedule/{scheduleId}/shifts/{shiftId}")
    suspend fun deleteShift(
        @Path("scheduleId") scheduleId: Int,
        @Path("shiftId") shiftId: Int
    ): Response<Unit>

    @POST("schedule/{scheduleId}/requirements/{requirementId}/assign")
    suspend fun assignRequirement(
        @Path("scheduleId") scheduleId: Int,
        @Path("requirementId") requirementId: Int,
        @Body request: RequirementAssignRequestDto
    ): ScheduleResponseDto

    @PATCH("schedule/{scheduleId}/requirements/{requirementId}")
    suspend fun updateScheduleRequirement(
        @Path("scheduleId") scheduleId: Int,
        @Path("requirementId") requirementId: Int,
        @Body request: ScheduleRequirementInScheduleUpdateDto
    ): ScheduleResponseDto

    @GET("schedule/{scheduleId}/employees/available")
    suspend fun getAvailableEmployees(
        @Path("scheduleId") scheduleId: Int,
        @Query("date") date: String,
        @Query("start_time") startTime: String,
        @Query("end_time") endTime: String,
        @Query("position_id") positionId: Int,
        @Query("branch_id") branchId: Int?
    ): List<AvailableEmployeeResponseDto>
}
