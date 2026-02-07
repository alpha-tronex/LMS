const bcrypt = require('bcrypt');
const validators = require('../utils/validators');
const { generateToken, verifyToken } = require('../middleware/authMiddleware');
const saltRounds = 10;

module.exports = function(app, User) {

    app.route("/api/register")
        .post(async (req, res) => {
            try {
                const { fname, lname, uname, email, pass, phone, address } = req.body || {};

                // Validation using validators module
                const validationErrors = [];
                
                // Required fields: uname and pass
                const unameValidation = validators.validateUsername(uname);
                if (!unameValidation.valid) {
                    validationErrors.push(unameValidation.error);
                }

                const passValidation = validators.validatePassword(pass);
                if (!passValidation.valid) {
                    validationErrors.push(passValidation.error);
                }

                // Optional fields: validate only if provided
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

                if (address && address.zipCode && address.zipCode.trim()) {
                    const zipValidation = validators.validateZipCode(address.zipCode);
                    if (!zipValidation.valid) {
                        validationErrors.push(zipValidation.error);
                    }
                }

                if (validationErrors.length) {
                    return res.status(400).json({ errors: validationErrors });
                }

                // ensure username/email uniqueness (only check email if provided)
                const uniqueQuery = [{ username: uname }];
                if (email) {
                    uniqueQuery.push({ email: email });
                }
                const existing = await User.findOne({ $or: uniqueQuery });
                if (existing) {
                    return res.status(409).json({ errors: ['Username or email already in use'] });
                }

                const hash = await bcrypt.hash(pass, saltRounds);
                const user = new User({
                    fname: fname || '',
                    lname: lname || '',
                    username: uname,
                    email: email || '',
                    password: hash,
                    phone: phone || '',
                    role: 'student',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                console.log('before save');

                await user.save();

                console.log('username: ' + user.username);
                console.log('email: ' + user.email);

                console.log('after save');

                // Generate JWT token
                const token = generateToken(user);

                const userObj = {
                    id: user._id,
                    fname: user.fname,
                    lname: user.lname,
                    uname: user.username,
                    email: user.email,
                    phone: user.phone,
                    pass: '', // Don't send the hashed password
                    confirmPass: '',
                    role: user.role,
                    token: token
                };
                res.status(200).json(userObj);

            } catch (err) {
                console.log('err' + err);
                res.status(500).send(err);
            }
        })

    app.route("/api/login")
        .post(async (req,res) => {
        try {
            console.log("uname: " + req.body.uname);
            console.log("pass: " + req.body.pass);
            
            const uname = req.body.uname;
            const pass = req.body.pass;

            // cannot query password field if it is encrypted
            const foundUser = await User.findOne({username: uname});
            console.log("foundUser: " + foundUser);

            if (!foundUser) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            console.log("in if (foundUser)");
            bcrypt.compare(pass, foundUser.password, function(err, result) {
                console.log('result: ' + result);
                if (result === true) {
                    // Generate JWT token
                    const token = generateToken(foundUser);

                    const userObj = {
                        id: foundUser._id,
                        fname: foundUser.fname,
                        lname: foundUser.lname,
                        uname: foundUser.username,
                        email: foundUser.email,
                        phone: foundUser.phone,
                        address: foundUser.address,
                        pass: '', // Don't send the hashed password
                        confirmPass: '',
                        role: foundUser.role || 'student',
                        token: token
                    };
                    res.status(200).json(userObj);
                    console.log("status 200 success");
                } else {
                    res.status(401).json({ error: 'Invalid credentials' });
                }
                console.log("in crypto");
            });

        } catch (err) {
            console.log('err' + err);
            res.status(500).send(err);
        }
    });

    app.route("/api/logout")
        .get((req,res) => {
            // kill the session cookie, then
            res.redirect("/");
    });

    app.route("/api/users")
        .get(async (req, res) => {
            try {
                // Fetch all users but exclude password field
                const users = await User.find({}, { password: 0 });
                
                const userList = users.map(user => ({
                    id: user._id,
                    fname: user.fname || '',
                    lname: user.lname || '',
                    uname: user.username,
                    email: user.email || '',
                    phone: user.phone || '',
                    role: user.role || 'student'
                }));

                res.status(200).json(userList);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    app.route("/api/user/update")
        .put(verifyToken, async (req, res) => {
            try {
                const { id, fname, lname, email, phone, address } = req.body || {};

                // Validation using validators module
                const validationErrors = [];
                
                if (!id) {
                    return res.status(400).json({ error: 'User ID is required' });
                }

                // Optional fields: validate only if provided and not empty
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

                if (address && address.zipCode && address.zipCode.trim()) {
                    const zipValidation = validators.validateZipCode(address.zipCode);
                    if (!zipValidation.valid) {
                        validationErrors.push(zipValidation.error);
                    }
                }

                if (validationErrors.length) {
                    return res.status(400).json({ errors: validationErrors });
                }

                // Update user
                const updatedUser = await User.findByIdAndUpdate(
                    id,
                    {
                        fname: fname,
                        lname: lname,
                        email: email,
                        phone: phone,
                        address: address || {},
                        updatedAt: new Date()
                    },
                    { new: true }
                );

                if (!updatedUser) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const userObj = {
                    id: updatedUser._id,
                    fname: updatedUser.fname,
                    lname: updatedUser.lname,
                    uname: updatedUser.username,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    address: updatedUser.address,
                    pass: '',
                    confirmPass: '',
                    role: updatedUser.role || 'student'
                };

                res.status(200).json(userObj);
            } catch (err) {
                console.log('err: ' + err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

};
