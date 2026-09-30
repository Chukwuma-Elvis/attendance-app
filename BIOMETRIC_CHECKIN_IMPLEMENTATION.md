# Smartphone Biometric & GPS Geofencing Check-In Implementation (Plan 2)

This document details the complete technical architecture, database schema, API contracts, shift window logic, and end-user flows for the Smartphone Biometric & Geofencing Attendance System implemented on the `biometric-check-in` branch.

---

## 1. Architectural Overview & Key Decisions

### 1.1 WebAuthn (FIDO2) vs. Raw Fingerprint Storage
- **Privacy & Security**: Modern mobile operating systems (iOS and Android) do not expose raw biometric data (such as fingerprint images or facial scans) to web browsers for legal and security reasons.
- **Hardware Enclave Protection**: WebAuthn (`@simplewebauthn/server` and `@simplewebauthn/browser`) leverages the mobile device's cryptographic secure enclave (Apple Secure Enclave, Android StrongBox/TEE).
- **Cryptographic Attestation**: When an employee registers their device:
  1. The browser requests biometric verification (Face ID, Touch ID, or Android Biometric).
  2. Upon successful physical verification, the hardware generates a unique asymmetric key pair.
  3. The public key is stored in the database, while the private key never leaves the device.
  4. On subsequent check-ins, the employee signs a dynamic server challenge with their biometric sensor, cryptographically proving both identity and physical possession of the registered device without passwords.

### 1.2 Geofencing Engine
- **Haversine Formula**: The server computes great-circle distance between the employee's submitted GPS coordinates (from HTML5 Geolocation API) and the department's configured venue coordinates:
  $$\Delta\sigma = 2 \arcsin \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}$$
  $$d = R \cdot \Delta\sigma$$
- **Configurable Radius**: Each department can set a custom allowed radius (defaulting to 100 meters to accommodate indoor GPS drift and varying atmospheric interference).

### 1.3 Independent Department Configuration
- Every department manages its own:
  - Venue name and GPS coordinates (Latitude & Longitude).
  - Geofence search radius (in meters).
  - Check-in start, cutoff (lateness threshold), and closing times.
  - Check-out opening and closing times.

### 1.4 Manual Override Intact
- Company admins and assistants retain 100% manual override authority on the admin attendance grid (`/admin/attendance`), ensuring that any special exceptions or manual adjustments can be made at any time.

---

## 2. Database Schema (`prisma/schema.prisma`)

### 2.1 Department Extensions
```prisma
model Department {
  id                   String     @id @default(cuid())
  name                 String     @unique
  // ... existing fields ...

  // Venue Geofencing
  venueName            String?
  venueLatitude        Float?
  venueLongitude       Float?
  venueRadiusMeters    Int        @default(100)

  // Shift & Attendance Windows (HH:MM in 24h format)
  checkInStartTime     String     @default("07:00")
  checkInCutoffTime    String     @default("09:15") // Arrival after this is marked LATE
  checkInEndTime       String     @default("13:00") // No check-in accepted after this
  checkOutStartTime    String     @default("16:30") // Departure check-out opens
  checkOutEndTime      String     @default("21:00") // Departure check-out closes
}
```

### 2.2 Attendance Model Extensions
```prisma
model Attendance {
  id              String           @id @default(cuid())
  employeeId      String
  date            DateTime
  status          AttendanceStatus // PRESENT, LATE, ABSENT, EXCUSED
  note            String?

  // Timestamps and coordinates
  checkInTime     DateTime?
  checkOutTime    DateTime?
  checkInLat      Float?
  checkInLng      Float?
  checkOutLat     Float?
  checkOutLng     Float?

  // Methods: "BIOMETRIC_MOBILE" or "MANUAL"
  checkInMethod   String?
  checkOutMethod  String?
}
```

### 2.3 Biometric Credentials & Challenge Storage
```prisma
model BiometricCredential {
  id           String   @id @default(cuid())
  credentialId String   @unique
  publicKey    Bytes
  counter      BigInt   @default(0)
  deviceType   String?  // e.g. "singleDevice"
  backedUp     Boolean  @default(false)
  transports   String?  // JSON array: ["internal"]
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
}

model BiometricChallenge {
  id         String   @id @default(cuid())
  challenge  String   @unique
  employeeId String?
  purpose    String   // "REGISTRATION" or "AUTHENTICATION"
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```

---

## 3. Shift Windows & Lateness Evaluation Logic (`src/lib/geo.ts`)

Daily check-in evaluations follow this state machine:

1. **Before `checkInStartTime`**: Check-in rejected (`"Check-in has not started yet today for this department."`).
2. **Between `checkInStartTime` and `checkInCutoffTime`**: Check-in accepted as **`PRESENT`**.
3. **Between `checkInCutoffTime` and `checkInEndTime`**: Check-in accepted as **`LATE`**.
   - If marked `LATE`, the department's configured late penalty deduction is logged.
4. **After `checkInEndTime`**: Arrival check-in window closed.
5. **Check-Out Window (`checkOutStartTime` to `checkOutEndTime`)**:
   - Records `checkOutTime`, GPS location, and sets `checkOutMethod: "BIOMETRIC_MOBILE"`.

---

## 4. API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/department/settings` | `GET` | Fetches caller department's GPS venue, radius, and shift windows. |
| `/api/department/settings` | `PATCH` | Updates GPS venue, radius, and shift times (Admin only). |
| `/api/check-in/departments` | `GET` | Public endpoint returning active departments, shift times, and employees. |
| `/api/biometrics/register-options` | `POST` | Generates WebAuthn registration options for a selected employee. |
| `/api/biometrics/register-verify` | `POST` | Validates biometric attestation and stores public key credentials. |
| `/api/biometrics/auth-options` | `POST` | Generates WebAuthn authentication challenge. |
| `/api/check-in` | `POST` | Verifies biometric assertion + GPS distance; marks check-in/check-out. |
| `/api/attendance` | `GET` / `POST` | Admin attendance grid fetching and manual overrides. |

---

## 5. UI Features

### 5.1 Admin Settings (`/admin/settings`)
- **Interactive GPS Detection**: Includes a `📍 Use My Current Location` button to automatically populate latitude and longitude from the admin's device.
- **Configurable Radius**: Number input to define the allowed perimeter in meters.
- **24-Hour Shift Time Pickers**:
  - Check-in start time.
  - Lateness cutoff threshold.
  - Check-in cutoff closing time.
  - Check-out opening time.
  - Check-out closing time.
- Integrated directly above the penalty deduction settings.

### 5.2 Admin Attendance Review (`/admin/attendance`)
- Displays live check-in and check-out timestamps for each employee.
- Shows a `📱 Biometric` badge for records verified with smartphone biometrics and GPS.
- Dropdown select allows admins or assistants to manually override any status (`PRESENT`, `LATE`, `ABSENT`, `EXCUSED`, `Unset`).

### 5.3 Mobile Self Check-In Portal (`/check-in`)
- Accessible directly on mobile at `/check-in` (and linked from `/login` and the admin sidebar).
- Dynamic digital clock displaying real-time hours, minutes, and seconds.
- Dropdown selector for department and employee.
- **Strict Location Confirmation & Enforcement**:
  - Automatically requests and verifies device GPS coordinates upon opening the portal and selecting an employee.
  - **Check-In Blocked if Location Access is Denied**:
    - Disables Check-In and Check-Out buttons completely whenever location access has not been granted.
    - Displays an unmistakable red alert card: `"🚫 Location Access Denied — Check-In Blocked"`.
    - Shows step-by-step instructions for iPhone Safari and Android Chrome to enable location permissions.
    - Provides a one-tap retry button: `"Check Location Permission Again"`.
  - **Geofence Enforcement**:
    - Calculates distance via Haversine formula against department venue coordinates.
    - If outside allowed radius, displays distance and blocks check-in with `"⚠️ Outside Allowed Workplace Radius"`.
    - If inside allowed radius, confirms location with `"✓ Workplace Location Confirmed"`.
- **One-Tap Biometric Registration**: For first-time users, registers Face ID / Touch ID / Fingerprint in seconds.
- **Check-In & Check-Out Actions**: Enabled exclusively when location is verified within the workplace perimeter.

---

## 6. How to Test Locally

1. **Start the local server**:
   ```bash
   npm run dev
   ```
2. **Access the portal**:
   - Open `http://localhost:3000/check-in` in Chrome, Edge, Safari, or on a mobile device on the same local network.
   - *Note on WebAuthn*: WebAuthn is supported natively on `localhost` (and `127.0.0.1`) without HTTPS. For testing across separate mobile devices over local Wi-Fi, run over HTTPS or use an SSL tunnel (e.g. `cloudflared` or `ngrok`).
3. **Configure Department Venue**:
   - Log into `/admin` as an admin (e.g. `sam` / `sam2468` or `admin` / `admin1234`).
   - Go to **Venue & Settings** (`/admin/settings`).
   - Click `📍 Use My Current Location` to set your current test coordinates and save.
4. **Register & Check In**:
   - Navigate to `/check-in`.
   - Select your department and employee name.
   - Click **"Register Biometrics (Face ID / Fingerprint)"** and authenticate with your device sensor.
   - Once registered, click **"Verify Biometrics & Check In"**.
   - Your location and biometric proof will be verified, recording your attendance immediately.

---

## 7. Biometric Security & Admin Authorization for Device Changes

To prevent buddy punching and unauthorized device swapping, the system enforces a strict **Admin Permission Lock** for any biometric alterations after the initial setup.

### 7.1 Lifecycle & Rules
1. **Initial Enrollment (Free & Frictionless)**:
   - A newly created employee without registered credentials can enroll their personal smartphone biometrics directly on `/check-in` on their first day without prior admin intervention.
2. **Post-Enrollment Lockdown**:
   - Once credentials are created, re-registration is locked.
   - The `/api/biometrics/register-options` endpoint enforces a server-side block:
     ```typescript
     if (existingCount > 0 && !employee.biometricResetAllowed) {
       return NextResponse.json(
         { error: "Biometrics already registered. Admin permission is required to change devices." },
         { status: 403 }
       );
     }
     ```
3. **Employee Reset Request (`/check-in`)**:
   - When an enrolled employee accesses `/check-in`, they see a **Device Biometrics Locked (Security Protected)** card.
   - If they purchased a new phone or lost biometric access, they can click:
     `[📨 Request Admin Permission to Change Device]`
   - This calls `/api/biometrics/request-reset`, setting `biometricResetRequested: true` and queuing a `BIOMETRIC_RESET` pending change record.
   - The UI immediately transitions to:
     `⏳ Reset Request Pending Admin Approval`
4. **Dual Admin Approval Paths**:
   - **Path A: Central Approvals Queue (`/admin/approvals`)**:
     - All biometric change requests appear in the pending queue alongside deduction requests.
     - When the owner clicks **"Approve"**, `applyPendingChange` immediately updates the employee record (`biometricResetAllowed: true`, `biometricResetRequested: false`).
     - Rejection or cancellation cleanly resets `biometricResetRequested: false`.
   - **Path B: Employee Directory (`/admin/employees`)**:
     - The employee directory highlights pending requests with an amber pulsing badge: `⏳ Reset Requested`.
     - The admin opens the employee's detail modal and switches to the **Settings** tab.
     - Under **Mobile Biometrics & Device Lock**, the admin can click **"Approve Device Change"**, **"Reject Request"**, or **"Revoke Device Biometrics"**.
5. **Real-Time Client Updates (`/check-in`)**:
   - The `/check-in` portal automatically polls every 3 seconds while an employee has a pending request, and revalidates when the browser window gains focus.
   - Employees can also tap the manual **"🔄 Check Status Now"** button.
   - The moment an approval is granted from *either* menu, the employee's screen immediately transitions from `⏳ Reset Request Pending Admin Approval` to `🔓 Admin Permission Granted`.
6. **Pairing the New Device & Single-Device Policy**:
   - Once approved, the employee's `/check-in` page displays:
     `🔓 Admin Permission Granted` along with the button `[🔐 Pair New Device Biometrics]`.
   - Upon successful biometric registration on the new phone:
     - All previous credentials for that employee are purged from `BiometricCredential`.
     - `biometricResetAllowed` and `biometricResetRequested` are automatically reset to `false`.
     - The employee is once again locked down to exactly one registered physical device.

