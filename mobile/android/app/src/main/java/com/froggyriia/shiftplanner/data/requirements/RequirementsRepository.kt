package com.froggyriia.shiftplanner.data.requirements

import com.froggyriia.shiftplanner.domain.model.RequirementOccurrence
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import com.froggyriia.shiftplanner.domain.model.RequirementTemplateDraft

interface RequirementsRepository {
    suspend fun fetchPositions(): List<RequirementPositionOption>
    suspend fun fetchRequirements(startDate: String, endDate: String): List<RequirementOccurrence>
    suspend fun createRequirement(
        date: String,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ): RequirementOccurrence
    suspend fun updateRequirement(
        id: Int,
        date: String,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ): RequirementOccurrence
    suspend fun deleteRequirement(id: Int)
    suspend fun importRequirementsXlsx(fileBytes: ByteArray, fileName: String): RequirementsImportResult
    suspend fun createRequirementsBulk(
        startDate: String,
        endDate: String,
        weekdays: List<Int>,
        templates: List<RequirementTemplateDraft>
    ): List<RequirementOccurrence>
}
