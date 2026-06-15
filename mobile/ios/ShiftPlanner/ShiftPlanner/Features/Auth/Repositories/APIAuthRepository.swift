import Foundation

final class APIAuthRepository: AuthRepository {
    
    func login(email: String, password: String) async throws -> AppUser {
        
        let url = APIClient.shared.baseURL.appendingPathComponent("auth/login")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            LoginRequest(email: email, password: password)
        )
        
        let (data, response) = try await APIClient.shared.data(for: request)
        
//    TODO: proper error handling
        guard let httpResponse = response as? HTTPURLResponse else {
                    throw URLError(.badServerResponse)
                }

        guard httpResponse.statusCode == 200 else {
                    throw URLError(.userAuthenticationRequired)
                }
        
        let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
        
        
    }
}
