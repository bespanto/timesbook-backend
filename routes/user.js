const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("@hapi/joi");
const router = express.Router();
const User = require("../models/User");
const auth = require("./verifyToken");
const cryptoRandomString = require("crypto-random-string");
const logger = require("../logger");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;



/**
 * Sent e-mail via smtp
 */
async function sendMail(regKey) {

    const OAUTH_PLAYGROUND = process.env.OAUTH_PLAYGROUND;
    const SENDER_EMAIL_ADDRESS = process.env.SENDER_EMAIL_ADDRESS;
    const MAILING_SERVICE_CLIENT_ID = process.env.MAILING_SERVICE_CLIENT_ID;
    const MAILING_SERVICE_CLIENT_SECRET = process.env.MAILING_SERVICE_CLIENT_SECRET;
    const MAILING_SERVICE_REFRESH_TOKEN = process.env.MAILING_SERVICE_REFRESH_TOKEN;
    
    const oauth2Client = new OAuth2(
        MAILING_SERVICE_CLIENT_ID,
        MAILING_SERVICE_CLIENT_SECRET,
        OAUTH_PLAYGROUND
    );

    oauth2Client.setCredentials({
        refresh_token: MAILING_SERVICE_REFRESH_TOKEN,
    });
    const accessToken = oauth2Client.getAccessToken();
    logger.info(accessToken);
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: 'OAuth2',
            user: SENDER_EMAIL_ADDRESS,
            clientId: MAILING_SERVICE_CLIENT_ID,
            clientSecret: MAILING_SERVICE_CLIENT_SECRET,
            refreshToken: MAILING_SERVICE_REFRESH_TOKEN,
            accessToken,
        },
    });

    await transporter.sendMail({
        from: '"Timesbook" <max.becker@sstyle.org>',
        to: "bespanto@gmail.com",
        subject: "Du bist zu Timesbook eingeladen",
        text: "Hello world?",
        html: "<b>" + regKey + "</b>",
    })
}

/**
 * Invite user via e-mail
 *
 */
router.patch("/invite", auth, async (req, res) => {
    logger.info(
        "Invite user: Post - username: " +
        req.params.username +
        ", body: " +
        JSON.stringify(req.body)
    );

    const token = req.header("auth-token");
    if (!token) {
        logger.error({ auth: false, message: "No token provided." });
        return res.status(401).send({ auth: false, message: "No token provided." });
    }

    jwt.verify(token, process.env.TOKEN_SECRET, async function (err, decoded) {
        if (err)
            return res
                .status(500)
                .send({ auth: false, message: "Failed to authenticate token." });
        logger.debug(JSON.stringify(decoded));

        const user = await User.findById(decoded._id, { password: 0, _id: 0 });
        logger.debug(JSON.stringify(user));
        if (!user) {
            logger.error({ error: "Profile is not found" });
            return res.status(401).send({ error: "Profile is not found" });
        } else {
            if (
                user.role === "admin" &&
                user.organization === req.body.organization
            ) {
                const randString = cryptoRandomString({ length: 30 });
                logger.debug("regisrationKey: " + randString);
                try {
                    const update = await User.updateOne(
                        { username: req.body.username },
                        {
                            $set: {
                                username: req.body.username,
                                name: req.body.name,
                                role: "user",
                                organization: req.body.organization,
                                regisrationKey: randString,
                            },
                        },
                        { upsert: true }
                    );
                    sendMail(randString)
                        .then((response) => {
                            logger.debug(response);
                            res.send("User '" + req.body.username + "' was invited");
                        })
                        .catch((err) => {
                            logger.error("Mailer error: " + err);
                            res.status(500).send(err);
                        });
                } catch (error) {
                    logger.error(error);
                    res.status(500).send(error);
                }
            } else {
                logger.error({ error: "You have not permissions invite users" });
                return res
                    .status(403)
                    .send({ error: "You have not permissions invite users" });
            }
        }
    });
});

/**
 * Update user profile
 *
 */
router.patch("/:username", auth, async (req, res) => {
    logger.info(
        "PATCH - username: " +
        req.params.username +
        ", body: " +
        JSON.stringify(req.body)
    );

    try {
        const update = await User.updateOne(
            { username: req.params.username },
            {
                $set: {
                    role: req.body.role,
                    name: req.body.name,
                    organization: req.body.organization,
                },
            }
        );
        res.send(update);
    } catch (error) {
        logger.error(error);
        res.status(500).send(error);
    }
});

/**
 * Get user profile
 *
 */
router.get("/", auth, async (req, res) => {
    const token = req.header("auth-token");

    if (!token) {
        logger.error({ auth: false, message: "No token provided." });
        return res.status(401).send({ auth: false, message: "No token provided." });
    }

    jwt.verify(token, process.env.TOKEN_SECRET, async function (err, decoded) {
        if (err)
            return res
                .status(500)
                .send({ auth: false, message: "Failed to authenticate token." });
        logger.debug(JSON.stringify(decoded));

        const user = await User.findById(decoded._id, { password: 0, _id: 0 });
        logger.debug(JSON.stringify(user));
        if (!user) {
            logger.error({ error: "Profile is not found" });
            return res.status(401).send({ error: "Profile is not found" });
        }
        res.status(200).send(user);
    });
});

module.exports = router;
