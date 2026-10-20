# Pelican REST API Reference

The Pelican backend exposes an Express-powered REST API at `/api`. All requests and responses use JSON formatting (`Content-Type: application/json`).

---

## 1. Authentication & Headers

Protected endpoints require a JSON Web Token (JWT) transmitted via the standard HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Tokens are valid for 7 days from generation and are returned upon successful registration or login.

### Standard Error Format

All error responses return a JSON object with a single `error` string field and an appropriate HTTP status code:

```json
{
  "error": "Error description message"
}
```

Common status codes:
- `400 Bad Request`: Missing required fields, invalid parameters, or validation failures.
- `401 Unauthorized`: Missing or invalid token, or invalid credentials.
- `403 Forbidden`: Authenticated user lacks permission to modify or delete the resource.
- `404 Not Found`: Requested resource does not exist or has expired.
- `500 Internal Server Error`: Server failure or database error.

---

## 2. Authentication Endpoints (`/api/auth`)

### 2.1 Register New User
Creates a new user account and returns an auth token.

- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Auth**: None
- **Request Body**:
  ```json
  {
    "name": "Alice Pelican",
    "email": "alice@example.com",
    "password": "Password123!"
  }
  ```
- **Validation**:
  - `name`: Non-empty string.
  - `email`: Non-empty string, normalized to lowercase, must be unique.
  - `password`: String with a minimum length of 6 characters.
- **Success Response** (`201 Created`):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "671542f0a1b2c3d4e5f60001",
      "name": "Alice Pelican",
      "email": "alice@example.com",
      "createdAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{ "error": "Name is required" }`
  - `400 Bad Request`: `{ "error": "Email is required" }`
  - `400 Bad Request`: `{ "error": "Password must be at least 6 characters" }`
  - `400 Bad Request`: `{ "error": "Email already registered" }`

### 2.2 User Login
Authenticates an existing user and returns an auth token.

- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "671542f0a1b2c3d4e5f60001",
      "name": "Alice Pelican",
      "email": "alice@example.com",
      "createdAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{ "error": "Email and password are required" }`
  - `401 Unauthorized`: `{ "error": "Invalid email or password" }`

### 2.3 Get Current User Profile
Returns the profile of the currently authenticated user.

- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Auth**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
  ```json
  {
    "user": {
      "_id": "671542f0a1b2c3d4e5f60001",
      "name": "Alice Pelican",
      "email": "alice@example.com",
      "createdAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{ "error": "Authorization token required" }`

---

## 3. Session Endpoints (`/api/sessions`)

### 3.1 Create Pairing Session
Generates a new 6-character transfer pairing code. Guests may create sessions anonymously; if an auth token is provided, `hostUserId` is linked to the session.

- **Method**: `POST`
- **Path**: `/api/sessions`
- **Auth**: Optional (`optionalAuth`)
- **Request Body**: `{}` (empty object)
- **Success Response** (`201 Created`):
  ```json
  {
    "code": "ABC234",
    "expiresAt": "2026-10-20T12:15:00.000Z",
    "status": "waiting"
  }
  ```

### 3.2 List User Sessions
Returns all sessions created by the authenticated user, optionally filtered by status.

- **Method**: `GET`
- **Path**: `/api/sessions`
- **Auth**: Required (`Bearer <token>`)
- **Query Parameters**:
  - `status` *(optional)*: Filter by status (`waiting`, `paired`, `closed`, `expired`).
- **Success Response** (`200 OK`):
  ```json
  [
    {
      "_id": "671542f0a1b2c3d4e5f60010",
      "code": "ABC234",
      "hostUserId": "671542f0a1b2c3d4e5f60001",
      "status": "waiting",
      "expiresAt": "2026-10-20T12:15:00.000Z",
      "createdAt": "2026-10-20T12:00:00.000Z"
    }
  ]
  ```

### 3.3 Get Session Details
Public endpoint to check session validity prior to joining.

- **Method**: `GET`
- **Path**: `/api/sessions/:code`
- **Auth**: None
- **Success Response** (`200 OK`):
  ```json
  {
    "code": "ABC234",
    "status": "waiting",
    "expiresAt": "2026-10-20T12:15:00.000Z"
  }
  ```
- **Errors**:
  - `404 Not Found`: `{ "error": "Session not found" }` (returned if code does not exist, or if `expiresAt <= now`, or status is `closed`/`expired`).

### 3.4 Update Session
Extends the session duration or marks it as closed. Only the session host can update it if a host exists.

- **Method**: `PATCH`
- **Path**: `/api/sessions/:code`
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "extendMinutes": 15,
    "status": "closed"
  }
  ```
  *(Both fields optional; provide at least one).*
- **Success Response** (`200 OK`):
  ```json
  {
    "session": {
      "_id": "671542f0a1b2c3d4e5f60010",
      "code": "ABC234",
      "hostUserId": "671542f0a1b2c3d4e5f60001",
      "status": "closed",
      "expiresAt": "2026-10-20T12:30:00.000Z",
      "createdAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{ "error": "extendMinutes must be a positive number" }`
  - `400 Bad Request`: `{ "error": "Invalid status update" }`
  - `403 Forbidden`: `{ "error": "Not authorized to modify this session" }`
  - `404 Not Found`: `{ "error": "Session not found" }`

### 3.5 Delete Session
Deletes a session document.

- **Method**: `DELETE`
- **Path**: `/api/sessions/:code`
- **Auth**: Required (`Bearer <token>`)
- **Success Response**: `204 No Content`
- **Errors**:
  - `403 Forbidden`: `{ "error": "Not authorized to delete this session" }`
  - `404 Not Found`: `{ "error": "Session not found" }`

---

## 4. Transfer Audit Endpoints (`/api/transfers`)

### 4.1 Record Transfer Log
Records an audit entry when a file transfer completes, fails, or is cancelled.

- **Method**: `POST`
- **Path**: `/api/transfers`
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "sessionCode": "ABC234",
    "deviceName": "Pixel 8",
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "direction": "sent",
    "status": "completed",
    "avgSpeedBps": 25000000,
    "durationMs": 42,
    "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  }
  ```
- **Validation**:
  - `direction`: Must be `'sent'` or `'received'`.
  - `status`: Must be `'completed'`, `'failed'`, or `'cancelled'`.
- **Success Response** (`201 Created`):
  ```json
  {
    "transfer": {
      "_id": "671542f0a1b2c3d4e5f60020",
      "userId": "671542f0a1b2c3d4e5f60001",
      "sessionCode": "ABC234",
      "deviceName": "Pixel 8",
      "fileName": "document.pdf",
      "fileSize": 1048576,
      "direction": "sent",
      "status": "completed",
      "avgSpeedBps": 25000000,
      "durationMs": 42,
      "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "createdAt": "2026-10-20T12:05:00.000Z"
    }
  }
  ```

### 4.2 Query Transfer History
Lists paginated transfer logs for the authenticated user, supporting search and filtering.

- **Method**: `GET`
- **Path**: `/api/transfers`
- **Auth**: Required (`Bearer <token>`)
- **Query Parameters**:
  - `q` *(optional)*: Search string matching `fileName`, `sessionCode`, or `deviceName` (case-insensitive regex).
  - `status` *(optional)*: Filter by `'completed'`, `'failed'`, or `'cancelled'`.
  - `from` *(optional)*: ISO 8601 date string for items created on or after date.
  - `to` *(optional)*: ISO 8601 date string for items created on or before date.
  - `page` *(optional, default: 1)*: Page number.
  - `limit` *(optional, default: 20, max: 100)*: Items per page.
- **Success Response** (`200 OK`):
  ```json
  {
    "items": [
      {
        "_id": "671542f0a1b2c3d4e5f60020",
        "userId": "671542f0a1b2c3d4e5f60001",
        "sessionCode": "ABC234",
        "deviceName": "Pixel 8",
        "fileName": "document.pdf",
        "fileSize": 1048576,
        "direction": "sent",
        "status": "completed",
        "avgSpeedBps": 25000000,
        "durationMs": 42,
        "sha256": "ba7816bf...",
        "createdAt": "2026-10-20T12:05:00.000Z"
      }
    ],
    "total": 1,
    "page": 1
  }
  ```

### 4.3 Delete Single Transfer Record
Deletes a specific transfer log entry belonging to the user.

- **Method**: `DELETE`
- **Path**: `/api/transfers/:id`
- **Auth**: Required (`Bearer <token>`)
- **Success Response**: `204 No Content`
- **Errors**:
  - `404 Not Found`: `{ "error": "Transfer not found" }`

### 4.4 Clear All User Transfer History
Clears all transfer history entries for the authenticated user.

- **Method**: `DELETE`
- **Path**: `/api/transfers`
- **Auth**: Required (`Bearer <token>`)
- **Success Response**: `204 No Content`

---

## 5. Device Registry Endpoints (`/api/devices`)

### 5.1 Register Device
Registers a browser or machine identity to the user account.

- **Method**: `POST`
- **Path**: `/api/devices`
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "name": "MacBook Pro M2",
    "deviceKey": "dkey_987654321"
  }
  ```
- **Success Response** (`201 Created`):
  ```json
  {
    "device": {
      "_id": "671542f0a1b2c3d4e5f60030",
      "userId": "671542f0a1b2c3d4e5f60001",
      "name": "MacBook Pro M2",
      "deviceKey": "dkey_987654321",
      "trusted": false,
      "lastSeenAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{ "error": "Device name is required" }`
  - `400 Bad Request`: `{ "error": "Device key is required" }`

### 5.2 List User Devices
Lists all devices registered to the authenticated user account sorted by `lastSeenAt` descending.

- **Method**: `GET`
- **Path**: `/api/devices`
- **Auth**: Required (`Bearer <token>`)
- **Success Response** (`200 OK`):
  ```json
  [
    {
      "_id": "671542f0a1b2c3d4e5f60030",
      "userId": "671542f0a1b2c3d4e5f60001",
      "name": "MacBook Pro M2",
      "deviceKey": "dkey_987654321",
      "trusted": true,
      "lastSeenAt": "2026-10-20T12:00:00.000Z"
    }
  ]
  ```

### 5.3 Update Device
Renames a device or toggles its trusted flag.

- **Method**: `PATCH`
- **Path**: `/api/devices/:id`
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "name": "MacBook Pro M3",
    "trusted": true
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "device": {
      "_id": "671542f0a1b2c3d4e5f60030",
      "userId": "671542f0a1b2c3d4e5f60001",
      "name": "MacBook Pro M3",
      "deviceKey": "dkey_987654321",
      "trusted": true,
      "lastSeenAt": "2026-10-20T12:10:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{ "error": "Invalid device name" }`
  - `404 Not Found`: `{ "error": "Device not found" }`

### 5.4 Delete Device
Deletes a registered device.

- **Method**: `DELETE`
- **Path**: `/api/devices/:id`
- **Auth**: Required (`Bearer <token>`)
- **Success Response**: `204 No Content`
- **Errors**:
  - `404 Not Found`: `{ "error": "Device not found" }`
