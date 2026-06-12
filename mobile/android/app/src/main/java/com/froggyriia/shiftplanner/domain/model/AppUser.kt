package com.froggyriia.shiftplanner.domain.model

data class AppUser(
    val id: String,
    val email: String,
    val name: String,
    val role: UserRole
)

enum class UserRole(
    val title: String
) {
    MANAGER("Manager"),
    EMPLOYEE("Employee")
}