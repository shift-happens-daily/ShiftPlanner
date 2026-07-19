package com.froggyriia.shiftplanner.data.absence

import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppAbsenceType

interface AbsenceRepository {
    // Employee: own absences
    suspend fun fetchMyAbsences(): List<AppAbsence>
    suspend fun createMyAbsence(
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String? = null
    ): AppAbsence

    // Manager: employee absences
    suspend fun fetchEmployeeAbsences(employeeId: Int): List<AppAbsence>
    suspend fun updateAbsence(
        employeeId: Int,
        absenceId: Int,
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String? = null
    ): AppAbsence
    suspend fun deleteAbsence(employeeId: Int, absenceId: Int)
}
