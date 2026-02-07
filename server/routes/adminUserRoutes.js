const validators = require('../utils/validators');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

/**
 * Admin User Routes
 * Handles all user management operations for administrators
 */
module.exports = function(app, User) {

    // Get all users (admin only)
    app.route("/api/admin/users")
        .get(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const users = await User.find({}, { password: 0 });
                
                const usersArray = users.map(user => ({
                    id: user._id,
                    fname: user.fname || '',
                    lname: user.lname || '',
                    uname: user.username,
                    email: user.email || '',
                    phone: user.phone || '',
                    type: user.type || 'student',
                    assessments: user.assessments || []
                }));

                res.status(200).json(usersArray);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Get user by ID (admin only)
    app.route("/api/admin/user/:id")
        .get(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.id;
                
                const user = await User.findById(userId, { password: 0 });
                
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const userObj = {
                    id: user._id,
                    fname: user.fname || '',
                    lname: user.lname || '',
                    uname: user.username,
                    email: user.email || '',
                    phone: user.phone || '',
                    type: user.type || 'student',
                    address: user.address || {
                        street1: '',
                        street2: '',
                        street3: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: ''
                    },
                    assessments: user.assessments || []
                };

                res.status(200).json(userObj);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Update user (admin only)
    app.route("/api/admin/user/:id")
        .put(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.id;
                const { fname, lname, email, phone, uname, type, address } = req.body || {};

                // Validation using validators module
                const validationErrors = [];
                
                if (uname && uname.trim()) {
                    const unameValidation = validators.validateUsername(uname);
                    if (!unameValidation.valid) {
                        validationErrors.push(unameValidation.error);
                    }
                }

                if (fname && fname.trim()) {
                    const fnameValidation = validators.validateName(fname, 'First name');
                    if (!fnameValidation.valid) {
                        validationErrors.push(fnameValidation.error);
                    }
                }

                if (lname && lname.trim()) {
                    const lnameValidation = validators.validateName(lname, 'Last name');
                    if (!lnameValidation.valid) {
                        validationErrors.push(lnameValidation.error);
                    }
                }

                if (email && email.trim()) {
                    const emailValidation = validators.validateEmail(email);
                    if (!emailValidation.valid) {
                        validationErrors.push(emailValidation.error);
                    }
                }

                if (phone && phone.trim()) {
                    const phoneValidation = validators.validatePhone(phone);
                    if (!phoneValidation.valid) {
                        validationErrors.push(phoneValidation.error);
                    }
                }

                if (type && type.trim()) {
                    const typeValidation = validators.validateUserType(type);
                    if (!typeValidation.valid) {
                        validationErrors.push(typeValidation.error);
                    }
                }

                if (address && address.zipCode && address.zipCode.trim()) {
                    const zipValidation = validators.validateZipCode(address.zipCode);
                    if (!zipValidation.valid) {
                        validationErrors.push(zipValidation.error);
                    }
                }

                if (validationErrors.length) {
                    return res.status(400).json({ errors: validationErrors });
                }

                // Check if username is taken by another user
                if (uname) {
                    const existingUser = await User.findOne({ username: uname, _id: { $ne: userId } });
                    if (existingUser) {
                        return res.status(409).json({ error: 'username already in use' });
                    }
                }

                // Update user
                const updateData = {};
                if (fname !== undefined) updateData.fname = fname;
                if (lname !== undefined) updateData.lname = lname;
                if (email !== undefined) updateData.email = email;
                if (phone !== undefined) updateData.phone = phone;
                if (uname !== undefined) updateData.username = uname;
                if (type !== undefined) updateData.type = type;
                if (address !== undefined) updateData.address = address;
                updateData.updatedAt = new Date();

                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    updateData,
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const userObj = {
                    id: updatedUser._id,
                    fname: updatedUser.fname || '',
                    lname: updatedUser.lname || '',
                    uname: updatedUser.username,
                    email: updatedUser.email || '',
                    phone: updatedUser.phone || '',
                    type: updatedUser.type || 'student',
                    address: updatedUser.address || {
                        street1: '',
                        street2: '',
                        street3: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: ''
                    }
                };

                res.status(200).json(userObj);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete user (admin only)
    app.route("/api/admin/user/:id")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.id;
                
                const deletedUser = await User.findByIdAndDelete(userId);
                
                if (!deletedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json({ message: 'User deleted successfully', id: userId });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Update user type (promote/demote admin)
    app.route("/api/admin/user/:id/type")
        .patch(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.id;
                const { type } = req.body || {};

                if (!type || !['student', 'admin'].includes(type)) {
                    return res.status(400).json({ error: 'Invalid user type. Must be student or admin' });
                }

                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    { type: type },
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const userObj = {
                    id: updatedUser._id,
                    fname: updatedUser.fname || '',
                    lname: updatedUser.lname || '',
                    uname: updatedUser.username,
                    email: updatedUser.email || '',
                    phone: updatedUser.phone || '',
                    type: updatedUser.type || 'student'
                };

                res.status(200).json(userObj);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete all assessment history data from a specific user
    app.route("/api/admin/user/:id/assessments")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.id;
                
                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    { $set: { assessments: [] } },
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json({ 
                    message: 'User assessment history deleted successfully', 
                    userId: userId 
                });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete a specific assessment attempt from a specific user
    app.route("/api/admin/user/:userId/assessment/:assessmentId")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const userId = req.params.userId;
                const assessmentId = req.params.assessmentId;
                
                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    { $pull: { assessments: { _id: assessmentId } } },
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json({ 
                    message: 'Assessment entry deleted successfully', 
                    userId: userId,
                    assessmentId: assessmentId
                });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    // Delete all assessment history data from all users
    app.route("/api/admin/assessments/all-users-data")
        .delete(verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await User.updateMany(
                    {},
                    { $set: { assessments: [] } }
                );

                res.status(200).json({ 
                    message: 'All users assessment history deleted successfully',
                    modifiedCount: result.modifiedCount 
                });
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

};
