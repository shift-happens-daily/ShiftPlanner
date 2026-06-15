# ShiftPlanner Mobile

This directory contains the mobile clients for ShiftPlanner.

The current reference implementation is **iOS**. Future Android work should follow the same **MVVM** architecture and feature boundaries.

## Architecture

The mobile app follows **MVVM**:

- **Views** render UI and forward user actions.
- **ViewModels** manage screen state and behavior.
- **Repositories** handle backend access.
- **Models / DTOs** represent app data and API payloads.

## Structure

```text
mobile/
  ios/
  android/
```

Inside the iOS app, the code is mainly split into:

- `App/` — entry point, root navigation, theme
- `Features/` — feature-first modules such as Auth, Employee, Manager
- `Shared/` — models, networking, reusable code

## Data Flow

`View -> ViewModel -> Repository -> API Client -> Backend`

## iOS Run

Open:

`mobile/ios/ShiftPlanner/ShiftPlanner.xcodeproj`

Then run the `ShiftPlanner` target in Xcode.
