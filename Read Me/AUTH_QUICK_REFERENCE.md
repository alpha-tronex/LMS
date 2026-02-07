# JWT Authentication Quick Reference

## For Developers

### Testing Authentication Locally

1. **Start the server**:
   ```bash
   cd server
   npm start
   ```

2. **Build and run Angular app**:
   ```bash
   npm run build
   # or for dev mode:
   ng serve
   ```

3. **Login via UI** or **Test with curl**:
   ```bash
   # Login
   curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"uname":"admin","pass":"local123"}'
   
   # Response includes token:
   # {"id":"...","uname":"admin","token":"eyJhbGc..."}
   ```

4. **Use token in requests**:
   ```bash
   # Get protected resource
    curl -X GET http://localhost:3000/api/assessments \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

### Key Files

```
server/
  middleware/
    authMiddleware.js       # JWT verification logic
  authRoutes.js             # Login/register endpoints (generates tokens)
  quizRoutes.js             # Quiz endpoints (protected)
  adminRoutes.js            # Admin endpoints (protected + admin check)

src/app/
  services/
    auth.interceptor.ts     # Adds token to all requests
    login-service.ts        # Handles login/register
  models/
    users.ts                # User model with token field
  app.module.ts             # Registers interceptor
```

### Environment Setup

**`.env` file** (in project root):
```env
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production-12345
MONGODB_URI=mongodb://localhost:27017/userDB
PORT=3000
```

⚠️ **Never commit real JWT secrets to git!**

### How to Check if Auth is Working

1. **Frontend (Browser Console)**:
   ```javascript
   // Check stored user/token
   JSON.parse(localStorage.getItem('currentUser'))
   
   // Should show: { id, uname, email, ..., token: "eyJhbG..." }
   ```

2. **Backend (Server Logs)**:
   - Look for "status 200 success" after login
   - Check Network tab for `Authorization: Bearer ...` header

3. **Test Protected Route**:
   - Clear localStorage: `localStorage.clear()`
   - Try to access `/api/assessments`
   - Should get 401 error and redirect to login

### Common Issues

**Problem**: 401 Unauthorized on all requests
- **Solution**: Check token in localStorage exists
- **Solution**: Verify interceptor is registered in app.module.ts
- **Solution**: Check JWT_SECRET matches in .env

**Problem**: 403 Forbidden on admin routes
- **Solution**: Verify user type is 'admin' in token payload
- **Solution**: Login with admin credentials

**Problem**: Token expired
- **Solution**: Login again (tokens expire after 24 hours)
- **Solution**: Consider implementing refresh token mechanism

### Adding New Protected Routes

**Backend**:
```javascript
const { verifyToken, verifyAdmin } = require('./middleware/authMiddleware');

// For authenticated users
app.get('/api/my-route', verifyToken, (req, res) => {
  // req.user contains decoded token data
  res.json({ userId: req.user.id });
});

// For admin only
app.get('/api/admin/my-route', verifyToken, verifyAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});
```

**Frontend**: No changes needed! Interceptor automatically adds token.

### Security Checklist

Development:
- [x] JWT tokens generated on login/register
- [x] Tokens include expiration (24h)
- [x] Protected routes require valid token
- [x] Admin routes require admin role
- [x] Interceptor adds token automatically
- [x] 401 responses trigger logout

Production (TODO):
- [ ] Strong JWT_SECRET (32+ random characters)
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting on login endpoint
- [ ] Helmet.js for security headers
- [ ] Regular dependency updates

### Testing Different User Roles

**Student Account**:
- Can access: quiz routes, own user update
- Cannot access: admin routes

**Admin Account**:
- Can access: everything
- Special privileges: user management

Test by logging in as different users and checking `/api/admin/users` access.

### Debugging Tips

1. **Token Inspection**:
   ```javascript
   // In browser console
   const user = JSON.parse(localStorage.getItem('currentUser'));
   const tokenParts = user.token.split('.');
   const payload = JSON.parse(atob(tokenParts[1]));
   console.log('Token payload:', payload);
   console.log('Expires:', new Date(payload.exp * 1000));
   ```

2. **Network Tab**:
   - Open DevTools → Network
   - Filter by XHR
   - Click any request
   - Check "Request Headers" for `Authorization: Bearer ...`

3. **Server Logs**:
   - Token verification errors appear in server console
   - Look for "Invalid token" or "Token expired" messages

### Quick Command Reference

```bash
# Install dependencies
cd server && npm install

# Generate strong secret (Linux/Mac)
openssl rand -base64 32

# Test token generation
node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({test:1}, 'secret', {expiresIn:'24h'}))"

# Check server can load auth middleware
cd server && node -e "require('./middleware/authMiddleware'); console.log('OK')"

# Build frontend
npm run build

# Start server
cd server && npm start
```
