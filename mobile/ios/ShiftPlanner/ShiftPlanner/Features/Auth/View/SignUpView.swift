import SwiftUI

struct SignUpView: View {
    @ObservedObject var viewModel: AuthViewModel
    let onShowLogin: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            VStack(spacing: 8) {
                Text("ShiftPlanner")
                    .font(.largeTitle)
                    .bold()
                Text("Create account")
                    .foregroundStyle(.secondary)
            }
            
            VStack(spacing: 12) {
                Picker("Role", selection: $viewModel.selectedRole) {
                    ForEach(UserRole.allCases) { role in
                        Text(role.title).tag(role)
                    }
                }
                .pickerStyle(.segmented)
                TextField("Name", text: $viewModel.name)
                    .textFieldStyle(.roundedBorder)
                
                TextField("Email", text: $viewModel.email)
                    .textFieldStyle(.roundedBorder)
                    .autocapitalization(.none)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                
                SecureField("Password", text: $viewModel.password)
                    .textFieldStyle(.roundedBorder)
                
                SecureField("Repeat password", text: $viewModel.confirmPassword)
                    .textFieldStyle(.roundedBorder)
            }
            
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundColor(.red)
            }
            
            Button {
                Task {
                    await viewModel.signUp()
                }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                } else {
                    Text("Sign up")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.isLoading || !viewModel.passwordsMatch)
            
            Button("Already have an account?") {
                onShowLogin()
            }
            .disabled(viewModel.isLoading)
            
            Spacer()
        }
        .padding()
    }
}


#Preview {
    SignUpView(
        viewModel: AuthViewModel(
            repository: MockAuthRepository()
        ),
        onShowLogin: {}
    )
}
