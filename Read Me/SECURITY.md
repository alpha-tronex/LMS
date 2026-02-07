# Security Enhancement: JWT Authentication Implementation

## Overview
The application has been enhanced with JWT (JSON Web Token) based authentication to improve security. This replaces the previous approach of storing user data in localStorage without proper session management.

## What Was Changed

### Backend Changes

1. **JWT Middleware** (`server/middleware/authMiddleware.js`)
   - Created authentication middleware using `jsonwebtoken` library
   - `verifyToken()`: Validates JWT tokens on protected routes
   - `verifyAdmin()`: Ensures only admin users can access admin-only routes
   - `generateToken()`: Creates JWT tokens with 24-hour expiration
   - Token payload includes: user ID, username, type, and email

2. **Protected Routes**
   - **Auth Routes** (`server/authRoutes.js`):
     - Login and register now return JWT tokens
     - `/api/user/update` requires valid token
   
     - **Assessment Routes** (`server/quizRoutes.js`):
        - `/api/assessments` - requires authentication
        - `/api/assessment` (GET/POST) - requires authentication
        - `/api/assessment/history/:username` - requires authentication
   
   - **Admin Routes** (`server/adminRoutes.js`):
     - `/api/admin/users` - requires admin token
     - `/api/admin/user/:id` (GET/PUT) - requires admin token

3. **Token Generation**
   - Tokens are generated on successful login/registration
   - Tokens expire after 24 hours
   - Token secret stored in `.env` file (JWT_SECRET)

### Frontend Changes

1. **HTTP Interceptor** (`src/app/services/auth.interceptor.ts`)
   - Automatically adds `Authorization: Bearer <token>` header to all HTTP requests
   - Intercepts 401 (Unauthorized) responses
   - Automatically redirects to login page when token is invalid/expired
   - Clears localStorage on authentication failure

2. **User Model** (`src/app/classes/users.ts`)
   - Added optional `token` field to User class
   - Token stored in localStorage with user data

3. **Login Service** (`src/app/services/login-service.ts`)
   - Updated to store token received from server
   - `updateUser()` preserves token when updating user data
   - Token automatically included in all API calls via interceptor

4. **App Module** (`src/app/app.module.ts`)
   - Registered `AuthInterceptor` as HTTP interceptor
   - Interceptor applies to all HTTP requests automatically

## Security Benefits

### 1. **Stateless Authentication**
   - Server doesn't need to maintain session state
   - Tokens are self-contained and verifiable
   - Scales better for distributed systems

### 2. **Token Expiration**
   - Tokens expire after 24 hours
   - Reduces risk of stolen tokens being used indefinitely
   - Forces periodic re-authentication

### 3. **Route Protection**
   - API endpoints are protected with middleware
   - Unauthorized requests are blocked at the server level
   - Admin-only routes require admin privileges

### 4. **Automatic Token Management**
   - Frontend interceptor handles token injection
   - No manual token management in components
   - Consistent authentication across all API calls

### 5. **Role-Based Access Control**
   - Admin routes protected with `verifyAdmin` middleware
   - User type validated from token payload
   - Prevents privilege escalation

## How It Works

### Authentication Flow

1. **Login/Register**
   ```
   User → Frontend → POST /api/login → Backend
   Backend → Validates credentials → Generates JWT
   Backend → Returns user data + token
   Frontend → Stores user + token in localStorage
   ```

2. **API Requests**
   ```
   Component → HTTP Request → Interceptor
   Interceptor → Adds "Authorization: Bearer <token>"
   Server → Middleware verifies token
   Server → Processes request if valid
   Server → Returns 401 if invalid/expired
   Interceptor → Catches 401 → Redirects to login
   ```

3. **Token Validation**
   ```
   Request → verifyToken middleware
   Middleware → Extracts token from header
   Middleware → Verifies signature with JWT_SECRET
   Middleware → Checks expiration
   Middleware → Adds user data to req.user
   Middleware → Calls next() or returns error
   ```

## Environment Variables

Add to `.env` file:
```env
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production-12345
```

**Important**: Change this to a strong, random string in production!

## Best Practices Implemented

1. ✅ **Passwords Hashed**: Using bcrypt with salt rounds
2. ✅ **Tokens Expire**: 24-hour expiration
3. ✅ **HTTPS Ready**: Token transmitted in Authorization header
4. ✅ **No Passwords in Responses**: Password field excluded from API responses
5. ✅ **Role-Based Access**: Admin middleware for privileged routes
6. ✅ **Automatic Logout**: Invalid tokens trigger re-authentication
7. ✅ **Centralized Auth**: HTTP interceptor manages all authentication

## Testing

1. **Test Login**:
   - Login with valid credentials
   - Check that token is in localStorage: `localStorage.getItem('currentUser')`
   - Verify token is included in subsequent requests (check Network tab)

2. **Test Token Expiration**:
   - Wait 24 hours (or manually expire token)
   - Make an API request
   - Should redirect to login page

3. **Test Admin Routes**:
   - Login as regular user
   - Try accessing `/api/admin/users`
   - Should receive 403 Forbidden

4. **Test Protected Routes**:
   - Clear localStorage
   - Try accessing `/api/quizzes`
   - Should receive 401 Unauthorized

## Future Enhancements

Consider these additional security improvements:

1. **Refresh Tokens**: Implement refresh token mechanism for seamless re-authentication
2. **Token Blacklist**: Maintain blacklist of revoked tokens (logout)
3. **Rate Limiting**: Prevent brute force attacks on login endpoint
4. **CORS Configuration**: Restrict API access to specific origins
5. **HTTPS Enforcement**: Redirect all HTTP traffic to HTTPS in production
6. **Password Requirements**: Enforce stronger password policies
7. **Two-Factor Authentication**: Add 2FA for admin accounts
8. **Security Headers**: Add helmet.js for security headers
9. **Input Sanitization**: Prevent XSS and SQL injection
10. **Audit Logging**: Log authentication attempts and admin actions

## Production Deployment Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Enable HTTPS
- [ ] Set secure cookie flags if using cookies
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Dependencies Added

```json
{
  "jsonwebtoken": "^9.x.x",
  "bcrypt": "^5.x.x"
}
```

Install with:
```bash
npm install jsonwebtoken bcrypt --save
```

## Technical Details

**JWT Structure**:
```
Header.Payload.Signature

Payload contains:
- id: user._id
- username: user.username
- type: user.type (student/admin)
- email: user.email
- exp: expiration timestamp
```

**Token Storage**: localStorage (consider httpOnly cookies for enhanced security in future)

**Token Verification**: RS256 or HS256 algorithm with secret key

## Troubleshooting

**401 Unauthorized errors**:
- Check if token exists in localStorage
- Verify token hasn't expired
- Ensure JWT_SECRET matches between environments

**403 Forbidden errors**:
- Verify user has correct role (admin vs student)
- Check token payload contains correct user type

**Token not being sent**:
- Verify interceptor is registered in app.module
- Check browser console for errors
- Inspect Network tab for Authorization header
