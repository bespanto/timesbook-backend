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
 * Sents e-mail via smtp
 */
async function sendMail(mailOptions) {
  const OAUTH_PLAYGROUND = process.env.OAUTH_PLAYGROUND;
  const SENDER_EMAIL_ADDRESS = process.env.SENDER_EMAIL_ADDRESS;
  const MAILING_SERVICE_CLIENT_ID = process.env.MAILING_SERVICE_CLIENT_ID;
  const MAILING_SERVICE_CLIENT_SECRET =
    process.env.MAILING_SERVICE_CLIENT_SECRET;
  const MAILING_SERVICE_REFRESH_TOKEN =
    process.env.MAILING_SERVICE_REFRESH_TOKEN;

  const oauth2Client = new OAuth2(
    MAILING_SERVICE_CLIENT_ID,
    MAILING_SERVICE_CLIENT_SECRET,
    OAUTH_PLAYGROUND
  );

  oauth2Client.setCredentials({
    refresh_token: MAILING_SERVICE_REFRESH_TOKEN,
  });
  const accessToken = oauth2Client.getAccessToken();

  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  // let transporter = nodemailer.createTransport({
  //   host: "smtp.ethereal.email",
  //   port: 587,
  //   secure: false, // true for 465, false for other ports
  //   auth: {
  //     user: testAccount.user, // generated ethereal user
  //     pass: testAccount.pass, // generated ethereal password
  //   },
  // });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: SENDER_EMAIL_ADDRESS,
      clientId: MAILING_SERVICE_CLIENT_ID,
      clientSecret: MAILING_SERVICE_CLIENT_SECRET,
      refreshToken: MAILING_SERVICE_REFRESH_TOKEN,
      accessToken,
    },
  });

  await transporter.sendMail({
    from: '"Timesbook" <max.becker@sstyle.org>',
    to: mailOptions.username,
    subject: "Sie sind für die Nutzung von Timesbook eingeladen",
    text: "Hello world?",
    html:
      "<p>Sehr geehrter Nutzer,</p><br>" +
      `<p>Sie sind vom Verwalter Ihrer Organisation (${mailOptions.orga}) zur Nutzung von ‘Timesbook’ eingeladen. Bitte schließen Sie Ihre Registrierung unter folgendem Link ab:</p><br/>` +
      `<p><a href="http://localhost:3000/resetPassword?username=${mailOptions.username}&regKey=${mailOptions.regKey}">http://localhost:3000/resetPassword?username=${mailOptions.username}&regKey=${mailOptions.regKey}</a></p><br/>` +
      "<p>Timesbook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
      "<p>Vielen Dank für Ihre Registrierung!<p/><br/>" +
      "Timesbook",
  });
}

/**
 * Invites user via e-mail
 *
 */
router.patch("/invite", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/invite'. Body: " + JSON.stringify(req.body)
  );

  const token = req.header("auth-token");
  if (!token) {
    logger.error("No token provided");
    return res.status(401).send({ error: "No token provided." });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, async function (err, decoded) {
    if (err)
      return res.status(500).send({ error: "Failed to authenticate token" });
    logger.debug(JSON.stringify(decoded));

    const user = await User.findById(decoded._id, { password: 0, _id: 0 });
    logger.debug(JSON.stringify(user));
    if (!user) {
      logger.error({ error: "No profile was found" });
      return res.status(401).send({ error: "No profile was found" });
    } else {
      if (
        user.role === "admin" &&
        user.organization === req.body.organization
      ) {
        const randString = cryptoRandomString({ length: 30 });
        try {
          const update = await User.updateOne(
            { username: req.body.username },
            {
              $set: {
                username: req.body.username,
                name: req.body.name,
                role: "user",
                organization: req.body.organization,
                registrationKey: randString,
              },
            },
            { upsert: true }
          );
          sendMail({
            regKey: randString,
            username: req.body.username,
            orga: req.body.organization,
          })
            .then((response) => {
              logger.info("User '" + req.body.username + "' was invited");
              res.send({ success: `User ${req.body.username} was invited` });
            })
            .catch((err) => {
              logger.error("Mailer error: " + err);
              res
                .status(500)
                .send({ error: "User cannot be invited. Mailer error." });
            });
        } catch (error) {
          logger.error(error);
          res.status(500).send(error);
        }
      } else {
        logger.error({ error: "You have no permissions to invite users" });
        return res
          .status(403)
          .send({ error: "You have no permissions to invite users" });
      }
    }
  });
});

/**
 * Updates user profile
 *
 */
router.patch("/:username", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/:username'. Username: " +
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
    res.send({ success: "User profile was updated" });
  } catch (error) {
    logger.error("Cannot update user profile: " + error);
    res.status(500).send({ error: "Cannot update user profile" });
  }
});

/**
 * Gets all users of a organization
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
      logger.error({ error: "No profile was found" });
      return res.status(401).send({ error: "No profile was found" });
    } else {
      if (user.role === "admin") {
        try {
          const users = await User.find({ organization: user.organization });
          res.send(users);
        } catch (error) {
          logger.error(error);
          res
            .status(500)
            .send({ error: "Server error. Cannot retrieve user list" });
        }
      } else {
        logger.error({ error: "You have no permissions to invite users" });
        return res
          .status(403)
          .send({ error: "You have no permissions to invite users" });
      }
    }
  });
});

/**
 * Gets user profile
 *
 */
router.get("/profile", auth, async (req, res) => {
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
