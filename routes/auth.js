const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('@hapi/joi')
const User = require('../models/User');
const auth = require('./verifyToken');
const logger = require('../logger');

/**
 * Sets password for user with registrationKey
 * 
 */
router.post('/setpass', async (req, res) => {
    logger.info('POST request on endpoint \'/setpass\'. Body: ' + JSON.stringify(req.body));

    const userExists = await User.findOne({ username: req.body.username, registrationKey: req.body.registrationKey });
    if (!userExists) {
        logger.error(`Reset password is failed. Username: ${req.body.username}, registrationKey: ${req.body.registrationKey}`);
        return res.status(400).send({ error: 'Reset password is failed' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    try {
        const update = await User.updateOne(
            { username: req.body.username, registrationKey: req.body.registrationKey },
            {
                $set: {
                    password: hashedPassword,
                    registrationKey: 'matched',
                },
            }
        );
        logger.info(JSON.stringify('Passwort successfully set for user: ' + req.body.username))
        res.send({ success: 'Passwort successfully set' });
    } catch (error) {
        logger.error(error);
        res.status(500).send(error);
    }
});

/**
 * Registers a user
 * 
 */
router.post('/register', async (req, res) => {
    logger.info('POST request on endpoint \'/register\'. Body: ' + JSON.stringify(req.body));

    const userExists = await User.findOne({ username: req.body.username });
    if (userExists) {
        logger.error('User can be not registered. Username (e-mail) already exists: ' + req.body.username);
        return res.status(400).send({ error: 'User can be not registered. Username (e-mail) already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const user = new User({
        name: req.body.name,
        username: req.body.username,
        password: hashedPassword,
        role: req.body.role,
        organization: req.body.organization
    });
    try {
        const savedUser = await user.save();
        logger.debug(JSON.stringify(savedUser))
        res.send({ success: 'User is registered.', id: user._id });
    } catch (error) {
        logger.error(error);
        res.status(500).send(error);
    }
});

/**
 * User login. Response jwt.
 * 
 */
router.post('/login', async (req, res) => {
    logger.info('POST request on endpoint \'/login\'. Body: ' + JSON.stringify(req.body));

    const user = await User.findOne({ username: req.body.username });
    console.log(user);
    if (!user) {
        logger.error('Login is failed. Username (e-mail)is not registered: ' + req.body.username);
        return res.status(400).send({ error: 'Login is failed. Username (e-mail)is not registered' });
    }

    const validPass = await bcrypt.compare(req.body.password, user.password);
    if (!validPass) {
        logger.error('Login is failed. Invalid password for user: ' + req.body.username);
        return res.status(400).send({ error: 'Login is failed. Invalid password' });
    }

    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET, { expiresIn: 86400 });
    res.header('auth-token', token).send({ jwt: token });
});

/**
 *  Gets user profile by jwt.
 */
router.get('/profile', auth,
    async (req, res) => {
        const token = req.header('auth-token');
        logger.info(`GET request on endpoint '/profile'. Header 'auth-token' => ${token}`);

        if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });

        jwt.verify(token, process.env.TOKEN_SECRET, async function (err, decoded) {
            if (err) {
                logger.error('Failed to authenticate token: ' + token);
                return res.status(500).send({ error: 'Failed to authenticate token.' });
            }

            logger.debug(JSON.stringify(decoded))
            const user = await User.findById(decoded._id, { password: 0, _id: 0 });
            logger.debug(JSON.stringify(user));
            if (!user) {
                logger.error('Profile is not found');
                return res.status(400).send({ error: 'Profile is not found' });
            }
            res.status(200).send(user);
        });

    });

module.exports = router;