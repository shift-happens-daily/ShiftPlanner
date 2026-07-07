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
