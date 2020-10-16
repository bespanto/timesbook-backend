const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("@hapi/joi");
const User = require("../models/User");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const cryptoRandomString = require("crypto-random-string");
const mailer = require("../utils/mailer");

/**
 * Sets password for user with registrationKey
 *
 */
router.post("/setpass", async (req, res) => {
  logger.info(
    "POST request on endpoint '/auth/setpass'. Body: " + JSON.stringify(req.body)
  );

  const userExists = await User.findOne({
    username: req.body.username,
  });
  if (!userExists) {
    logger.error(
      `Reset password is failed. Username: ${req.body.username} is not registered`
    );
    return res
      .status(400)
      .send({ errorCode: 4003, message: "Reset password is failed" });
  } else if (userExists.registrationKey === "matched") {
    logger.error(`The Password for user ${req.body.username} is already set`);
    return res
      .status(400)
      .send({
        errorCode: 4005,
        message: `The Password for user ${req.body.username} is already set`,
      });
  } else if (userExists.registrationKey !== req.body.registrationKey) {
    logger.error(`Bad registration key for user: ${req.body.username}`);
    return res
      .status(400)
      .send({
        errorCode: 4006,
        message: `Bad registration key for user: ${req.body.username}`,
      });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  try {
    const update = await User.updateOne(
      {
        username: req.body.username,
        registrationKey: req.body.registrationKey,
      },
      {
        $set: {
          password: hashedPassword,
          registrationKey: "matched",
        },
      }
    );
    logger.info(
      JSON.stringify("Passwort successfully set for user: " + req.body.username)
    );
    res.send({ success: "Passwort successfully set" });
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }
});

/**
 * Registers a user with role 'admin'
 *
 */
router.post("/register", async (req, res) => {
  logger.info(
    "POST request on endpoint '/auth/register'. Body: " + JSON.stringify(req.body)
  );

  // check e-mail in DB
  const userExists = await User.findOne({ username: req.body.username });
  if (userExists) {
    logger.error(
      "The user cannot be registered. E-mail already exists: " +
      req.body.username
    );
    return res.status(400).send({
      errorCode: 4001,
      message:
        "The user cannot be registered. E-mail already exists: " +
        req.body.username,
    });
  }

  //check, if admin account for orga exists
  const adminForOrgaExists = await User.findOne({
    organization: req.body.organization,
    role: "admin",
  });
  if (adminForOrgaExists) {
    logger.error(
      "The user cannot '" + req.body.username + "' be registered. The organization '" +
      req.body.organization + "' has already admin account: " + req.body.username
    );
    return res.status(400).send({
      errorCode: 4002,
      message:
        "The user cannot be registered. Admin account already exists for organization: " +
        req.body.organization,
    });
  }

  const randString = cryptoRandomString({ length: 30 });
  const user = new User({
    name: req.body.name,
    username: req.body.username,
    role: "admin",
    organization: req.body.organization,
    registrationKey: randString,
  });
  try {
    const savedUser = await user.save();
    logger.debug(JSON.stringify(savedUser));

    mailer(
      req.body.username,
      "<p>Sehr geehrter Nutzer,</p><br>" +
      `<p>Sie haben sich als Verwalter (admin) der Organisation ${req.body.organization} zur Nutzung von ‘Timesbook’ angemeldet. Bitte schließen Sie Ihre Registrierung unter folgendem Link ab:</p><br/>` +
      `<p><a href="http://localhost:3000/resetPassword?username=${req.body.username}&regKey=${randString}">http://localhost:3000/resetPassword?username=${req.body.username}&regKey=${randString}</a></p><br/>` +
      "<p>Timesbook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
      "<p>Vielen Dank für Ihre Registrierung!<p/><br/>" +
      "Timesbook")
      .then(() => {
        logger.info("Admin '" + req.body.username + "' for organisation '" + req.body.organization + "' was invited");
        res.status(200).send({ success: `Admin '${req.body.username}' for organisation '${req.body.organization}' was invited` });
      })
      .catch((err) => {
        logger.error("Error while sending e-mail: " + err);
        res
          .status(500)
          .send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
      });
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }
});

/**
 * User login. Response jwt.
 *
 */
router.post("/login", async (req, res) => {
  logger.info("POST request on endpoint '/auth/login'. Body: " + JSON.stringify(req.body));

  const user = await User.findOne({ username: req.body.username });
  if (!user) {
    logger.error(
      "Login is failed. Username (e-mail)is not registered: " +
      req.body.username
    );
    return res
      .status(400)
      .send({
        errorCode: 4003,
        error:
          "Login is failed. Username (e-mail) is not registered: " +
          req.body.username,
      });
  }

  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) {
    logger.error(
      "Login is failed. Invalid password for user: " + req.body.username
    );
    return res
      .status(400)
      .send({
        errorCode: 4004,
        error:
          "Login is failed. Invalid password for user: " + req.body.username,
      });
  }

  const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET, {
    expiresIn: 86400,
  });
  res.header("auth-token", token).send({ jwt: token });
});

module.exports = router;
