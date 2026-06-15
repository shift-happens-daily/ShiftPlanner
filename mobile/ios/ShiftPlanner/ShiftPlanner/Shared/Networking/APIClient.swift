import Foundation

final class APIClient {
    static let shared = APIClient()
    
    private init() {}
    
    let baseURL = "http://localhost:8000"
}
