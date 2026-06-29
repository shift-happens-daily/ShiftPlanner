package com.froggyriia.shiftplanner

import android.content.Context
import com.froggyriia.shiftplanner.data.auth.ApiAuthRepository
import com.froggyriia.shiftplanner.data.auth.AuthRepository
import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.TokenStore

class AppContainer(
    context: Context
) {
    private val tokenStore = TokenStore(context.applicationContext)
    private val apiClient = ApiClient(tokenStore)

    val authRepository: AuthRepository = ApiAuthRepository(
        apiClient = apiClient,
        tokenStore = tokenStore
    )
}
