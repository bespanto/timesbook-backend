const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('@hapi/joi')
const router = express.Router();
const User = require('../models/User');
const auth = require('./verifyToken');
const logger = require('../logger');


/**
 * Register a user
 * 
 */
router.post('/setpass', async (req, res) => {
    logger.info('PATCH - body: ' + JSON.stringify(req.body));

    const userExists = await User.findOne({ username: req.body.username, registrationKey: req.body.registrationKey });
    if (!userExists) {
        logger.error('You cannot reset the passwort');
        return res.status(400).send({ error: 'You cannot reset the passwort' });
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
        logger.debug(JSON.stringify('Passwort successfuly set for user: ' + req.body.username))
        res.send({ message: 'Passwort successfuly set' });
    } catch (error) {
        logger.error(error);
        res.status(500).send(error);
    }
});

/**
 * Register a user
 * 
 */
router.post('/register', async (req, res) => {
    logger.info('PATCH - body: ' + JSON.stringify(req.body));

    const userExists = await User.findOne({ username: req.body.username });
    if (userExists) {
        logger.error('Email already exists');
        return res.status(400).send({ error: 'Email already exists' });
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
        res.send({ user: user._id });
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
    logger.info('POST - body: ' + JSON.stringify(req.body));

    const user = await User.findOne({ username: req.body.username });
    console.log(user);
    if (!user) {
        logger.error('Your e-mail address is not registered');
        return res.status(400).send({ error: 'Your e-mail address is not registered' });
    }

    const validPass = await bcrypt.compare(req.body.password, user.password);
    if (!validPass) {
        logger.error('Invalid password');
        return res.status(400).send({ error: 'Invalid password' });
    }

    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET, { expiresIn: 86400 });
    res.header('auth-token', token).send({ jwt: token });
});

/**
 *  Get user profile by jwt.
 */
router.get('/profile', auth,
    async (req, res) => {
        const token = req.header('auth-token');
        logger.info('GET - header: ' + token);

        if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });

        jwt.verify(token, process.env.TOKEN_SECRET, async function (err, decoded) {
            if (err) {
                logger.error('Failed to authenticate token.');
                return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
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