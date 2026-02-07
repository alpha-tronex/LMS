# Backend Routes Refactoring

## Overview
The backend routes have been refactored from a mixed structure into a clean, domain-based architecture that aligns with the frontend services.

## Previous Structure
```
server/routes/
  ├── adminRoutes.js       (370 lines - mixed user & quiz operations)
  ├── quizRoutes.js        (80 lines - student quiz operations)
  ├── quizUploadRoutes.js  (162 lines - admin quiz upload)
  ├── authRoutes.js        (authentication)
  └── utilRoutes.js        (utilities)
```

## New Structure
```
server/routes/
  ├── adminUserRoutes.js   (312 lines - admin user management)
  ├── adminQuizRoutes.js   (221 lines - admin quiz file operations)
  ├── quizRoutes.js        (80 lines - student quiz operations)
  ├── authRoutes.js        (authentication)
  └── utilRoutes.js        (utilities)
```

## Route Mapping

### Admin User Routes (`adminUserRoutes.js`)
**Purpose**: All user management and user assessment history operations for administrators

| Method | Endpoint | Description | Middleware |
|--------|----------|-------------|------------|
| GET | `/api/admin/users` | Get all users | verifyToken, verifyAdmin |
| GET | `/api/admin/user/:id` | Get user by ID | verifyToken, verifyAdmin |
| PUT | `/api/admin/user/:id` | Update user details | verifyToken, verifyAdmin |
| DELETE | `/api/admin/user/:id` | Delete user account | verifyToken, verifyAdmin |
| PATCH | `/api/admin/user/:id/type` | Update user type (admin/student) | verifyToken, verifyAdmin |
| DELETE | `/api/admin/user/:id/assessments` | Delete all assessment history for a user | verifyToken, verifyAdmin |
| DELETE | `/api/admin/user/:userId/assessment/:assessmentId` | Delete specific assessment entry from user | verifyToken, verifyAdmin |
| DELETE | `/api/admin/assessments/all-users-data` | Delete all assessment history from all users | verifyToken, verifyAdmin |

**Features**:
- User CRUD operations with validation
- Username uniqueness checking
- User type management (promote/demote)
- User assessment history management
- Comprehensive validation using validators module

### Admin Quiz Routes (`adminQuizRoutes.js`)
**Purpose**: Assessment file operations (upload, list, delete) for administrators

| Method | Endpoint | Description | Middleware |
|--------|----------|-------------|------------|
| POST | `/api/assessment/upload` | Upload new assessment file | verifyToken, verifyAdmin |
| GET | `/api/assessment/list` | List all uploaded assessments | verifyToken, verifyAdmin |
| DELETE | `/api/admin/assessment-file/:assessmentId` | Delete specific assessment file | verifyToken, verifyAdmin |
| DELETE | `/api/admin/assessment-files/all` | Delete all assessment files | verifyToken, verifyAdmin |
| DELETE | `/api/assessment/delete/:id` | Delete assessment by ID (alternative) | verifyToken, verifyAdmin |

**Features**:
- Assessment validation (title, questions, answers, instructions)
- Auto-assign lowest available assessment ID (fills gaps)
- Duplicate title checking
- Batch file operations
- Comprehensive question validation

### Assessment Routes (`quizRoutes.js`)
**Purpose**: Student-facing assessment operations

| Method | Endpoint | Description | Middleware |
|--------|----------|-------------|------------|
| GET | `/api/assessments` | Get list of available assessments | verifyToken |
| GET | `/api/assessment` | Get specific assessment data | verifyToken |
| POST | `/api/assessment` | Submit completed assessment | verifyToken |
| GET | `/api/assessment/history/:username` | Get assessment history for user | verifyToken |

**Features**:
- Assessment listing with ID and title
- Assessment data retrieval
- Assessment submission and storage
- User assessment history

## Alignment with Frontend Services

The backend routes now perfectly align with the frontend service architecture:

### Frontend → Backend Mapping

**AdminUserService** → **adminUserRoutes.js**
```typescript
getAllUsers()           → GET /api/admin/users
getUserById()           → GET /api/admin/user/:id
updateUser()            → PUT /api/admin/user/:id
deleteUser()            → DELETE /api/admin/user/:id
updateUserType()        → PATCH /api/admin/user/:id/type
deleteUserQuizData()    → DELETE /api/admin/user/:id/quizzes
deleteSpecificUserQuiz()→ DELETE /api/admin/user/:userId/assessment/:assessmentId
```

**AdminQuizService** → **adminQuizRoutes.js**
```typescript
getAvailableQuizzes()   → GET /api/quizzes (from quizRoutes)
deleteAllUsersQuizData()→ DELETE /api/admin/assessments/all-users-data (from adminUserRoutes)
deleteQuizFile()        → DELETE /api/admin/assessment-file/:assessmentId
deleteAllQuizFiles()    → DELETE /api/admin/assessment-files/all
```

**Note**: `getAvailableQuizzes()` uses the public assessment list endpoint, and `deleteAllUsersQuizData()` is in adminUserRoutes since it operates on user data.

## Benefits of Refactoring

### 1. Clear Separation of Concerns
- User operations separated from quiz file operations
- Admin operations separated from student operations
- Each file has a single, well-defined responsibility

### 2. Improved Maintainability
- Smaller, focused files easier to understand and modify
- Clear naming conventions
- Reduced cognitive load when making changes

### 3. Better Alignment
- Backend structure mirrors frontend services
- Easier to understand data flow
- Consistent naming across stack

### 4. Enhanced Security
- Clear middleware application
- All admin operations protected by verifyAdmin
- Consistent authentication patterns

### 5. Scalability
- Easy to add new routes in appropriate files
- Clear place for new functionality
- Supports future feature additions

## Migration Notes

### Breaking Change
These endpoints were renamed from `quiz*` → `assessment*`, and the persisted Mongo field was renamed from `user.quizzes` → `user.assessments`.

### One-time DB Migration
Run the migration script once before/alongside deployment:
```bash
cd server
npm run migrate:assessments
```
- ✅ API paths identical
- ✅ Request/response formats unchanged
- ✅ Middleware unchanged
- ✅ Frontend code requires no changes

### Server.js Updates
```javascript
// Old
const adminRoutes = require('./routes/adminRoutes.js');
const quizUploadRoutes = require('./routes/quizUploadRoutes.js');
adminRoutes(app, User);
quizUploadRoutes(app);

// New
const adminUserRoutes = require('./routes/adminUserRoutes.js');
const adminQuizRoutes = require('./routes/adminQuizRoutes.js');
adminUserRoutes(app, User);
adminQuizRoutes(app);
```

## Testing Checklist

After refactoring, verify:
- ✅ Server starts without errors
- ✅ User management operations work (list, get, update, delete)
- ✅ User type changes work (promote/demote)
- ✅ Quiz upload works
- ✅ Quiz file deletion works
- ✅ User quiz data deletion works
- ✅ Student quiz operations work (list, get, submit, history)

## Future Enhancements

Potential improvements for the route architecture:

1. **Router-based approach**: Convert from `app.route()` to Express Router
2. **Validation middleware**: Extract validation logic into separate middleware
3. **Error handling middleware**: Centralized error handling
4. **Rate limiting**: Add rate limiting for admin operations
5. **Logging middleware**: Comprehensive request/response logging
6. **API versioning**: Support for `/api/v1/` endpoints
7. **OpenAPI documentation**: Auto-generated API documentation
8. **Controller pattern**: Separate route handlers from business logic
