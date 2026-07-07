package com.froggyriia.shiftplanner.data.network

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.authDataStore by preferencesDataStore(name = "auth")

class TokenStore(
    private val context: Context
) {
    suspend fun getAccessToken(): String? {
        return context.authDataStore.data
            .map { preferences -> preferences[ACCESS_TOKEN_KEY] }
            .first()
    }

    suspend fun saveAccessToken(token: String) {
        context.authDataStore.edit { preferences ->
            preferences[ACCESS_TOKEN_KEY] = token
        }
    }

    suspend fun clearAccessToken() {
        context.authDataStore.edit { preferences ->
            preferences.remove(ACCESS_TOKEN_KEY)
        }
    }

    private companion object {
        val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
    }
}
