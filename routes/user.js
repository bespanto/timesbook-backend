const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("@hapi/joi");
const router = express.Router();
const User = require("../models/User");
const auth = require("./verifyToken");
const cryptoRandomString = require("crypto-random-string");
const logger = require("../utils/logger");
const mailer = require("../utils/mailer");


/**
 * Invites user via e-mail
 *
 */
router.patch("/invite", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/invite'. Body: " + JSON.stringify(req.body)
  );
  try {
    const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
    logger.debug(JSON.stringify(user));
    if (!user) {
      logger.error({ error: "No user found for the given id" });
      return res.status(401).send({ errorCode: 4009, message: "No user found for the given id" });
    } else {
      if (
        user.role === "admin" &&
        user.organization === req.body.organization
      ) {
        const randString = cryptoRandomString({ length: 30 });
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
        mailer(
          req.body.username,
          "<p>Sehr geehrter Nutzer,</p><br>" +
          `<p>Sie sind vom Verwalter Ihrer Organisation (${req.body.organization}) zur Nutzung von ‘Timesbook’ eingeladen. Bitte schließen Sie Ihre Registrierung unter folgendem Link ab:</p><br/>` +
          `<p><a href="http://localhost:3000/resetPassword?username=${req.body.username}&regKey=${randString}">http://localhost:3000/resetPassword?username=${req.body.username}&regKey=${randString}</a></p><br/>` +
          "<p>Timesbook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
          "<p>Vielen Dank für Ihre Registrierung!<p/><br/>" +
          "Timesbook")
          .then((response) => {
            logger.info("User '" + req.body.username + "' was invited");
            res.send({ success: `User ${req.body.username} was invited` });
          })
          .catch((err) => {
            logger.error("Error while sending e-mail: " + err);
            res
              .status(500)
              .send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
          });

      } else {
        logger.error("User have no permissions to invite other users");
        return res
          .status(403)
          .send({ errorCode: 4010, message: "User have no permissions to invite other users" });
      }
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({errorCode: 5001, message: error});
  }
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
