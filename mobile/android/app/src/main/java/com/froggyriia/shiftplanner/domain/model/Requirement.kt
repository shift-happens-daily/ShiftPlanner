package com.froggyriia.shiftplanner.domain.model

import java.util.Date

data class RequirementOccurrence(
    val id: Int,
    val date: Date,
    val weekday: Int,
    val branchId: Int?,
    val positionId: Int,
    val positionName: String,
    val quantity: Int,
    val startSlot: Int,
    val endSlot: Int
)

data class RequirementPositionOption(
    val id: Int,
    val name: String
)

data class RequirementTemplateDraft(
    val positionId: Int,
    val quantity: Int,
    val startSlot: Int,
    val endSlot: Int
)

/** One failed row of an xlsx requirements import. */
data class RequirementImportError(
    val row: Int,
    val message: String
)

/** Result of importing staffing requirements from an Excel file. */
data class RequirementsImportResult(
    val createdCount: Int,
    val errors: List<RequirementImportError>
)
