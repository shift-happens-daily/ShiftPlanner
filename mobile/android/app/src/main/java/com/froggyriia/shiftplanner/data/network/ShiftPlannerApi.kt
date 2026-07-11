package com.froggyriia.shiftplanner.data.network

import com.google.gson.JsonElement
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

    @GET("companies/me/manager-requests")
    suspend fun getManagerRequests(): List<ManagerRequestDto>

    @POST("companies/me/manager-requests/{id}/accept")
    suspend fun acceptManagerRequest(@Path("id") id: Int): ManagerRequestDto

    @POST("companies/me/manager-requests/{id}/decline")
    suspend fun declineManagerRequest(@Path("id") id: Int): ManagerRequestDto

    @GET("companies/me/employee-requests")
    suspend fun getEmployeeRequests(): List<EmployeeRequestDto>

    @POST("companies/me/employee-requests/{id}/accept")
    suspend fun acceptEmployeeRequest(@Path("id") id: Int): EmployeeRequestDto

    @POST("companies/me/employee-requests/{id}/decline")
    suspend fun declineEmployeeRequest(@Path("id") id: Int): EmployeeRequestDto

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

    // Returns JsonElement because deployed backend returns {} (old) while algorithm2 returns [] (new)
    @POST("schedule/generate")
    suspend fun generateSchedule(@Body request: ScheduleGenerateRequestDto): JsonElement

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

    // ── Absences ──────────────────────────────────────────────────────────────

    @GET("employees/me/absences")
    suspend fun getMyAbsences(): List<AbsenceResponseDto>

    @POST("employees/me/absences")
    suspend fun createMyAbsence(@Body request: AbsenceCreateRequestDto): AbsenceResponseDto

    @GET("employees/{id}/absences")
    suspend fun getEmployeeAbsences(@Path("id") id: Int): List<AbsenceResponseDto>

    @PATCH("employees/{id}/absences/{absenceId}")
    suspend fun updateAbsence(
        @Path("id") employeeId: Int,
        @Path("absenceId") absenceId: Int,
        @Body request: AbsenceCreateRequestDto
    ): AbsenceResponseDto

    @DELETE("employees/{id}/absences/{absenceId}")
    suspend fun deleteAbsence(
        @Path("id") employeeId: Int,
        @Path("absenceId") absenceId: Int
    ): Response<Unit>

    // ── Shift exchange requests ───────────────────────────────────────────────

    @POST("schedule/exchanges")
    suspend fun createExchangeRequest(@Body request: ShiftExchangeCreateRequestDto): ShiftExchangeResponseDto

    @GET("schedule/exchanges")
    suspend fun getExchangeRequests(): List<ShiftExchangeResponseDto>

    @POST("schedule/exchanges/{id}/approve")
    suspend fun approveExchangeRequest(@Path("id") id: Int): ShiftExchangeResponseDto

    @POST("schedule/exchanges/{id}/reject")
    suspend fun rejectExchangeRequest(@Path("id") id: Int): ShiftExchangeResponseDto

    // ── Reports ───────────────────────────────────────────────────────────────

    @GET("reports/employees")
    suspend fun getEmployeeReports(
        @Query("start_date") startDate: String?,
        @Query("end_date") endDate: String?
    ): List<EmployeeReportResponseDto>

    @GET("reports/me")
    suspend fun getMyReport(
        @Query("start_date") startDate: String?,
        @Query("end_date") endDate: String?
    ): MySelfReportResponseDto

    // ── Available employees ───────────────────────────────────────────────────

    @GET("schedule/{scheduleId}/employees/available")
    suspend fun getAvailableEmployees(
        @Path("scheduleId") scheduleId: Int,
        @Query("date") date: String,
        @Query("start_time") startTime: String,
        @Query("end_time") endTime: String,
        @Query("position_id") positionId: Int,
        @Query("branch_id") branchId: Int?,
        @Query("include_unavailable") includeUnavailable: Boolean = false
    ): List<AvailableEmployeeResponseDto>
}
