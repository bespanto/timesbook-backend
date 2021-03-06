const express = require("express");
const axios = require('axios');
const FormData = require('form-data')
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validate = require("validate.js");
const User = require("../models/User");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const cryptoRandomString = require("crypto-random-string");
const mailer = require("../utils/mailer");


/**
 * Recovers the password for a user by sending an e-mail with registrationKey
 *
 */
router.post("/recoverPass", async (req, res) => {
  logger.info(
    "POST request on endpoint '/auth/recoverPass'. Body: " + JSON.stringify(req.body)
  );

  const userExists = await User.findOne({
    username: req.body.username,
  });
  if (!userExists) {
    logger.error(
      `Username: ${req.body.username} is not registered`
    );
    return res.status(400)
      .send({ errorCode: 4003, message: "Username: " + req.body.username + "' is not registered" });
  } else {

    const randString = cryptoRandomString({ length: 30 });
    try {
      const update = await User.updateOne(
        {
          username: req.body.username,
        },
        {
          $set: {
            registrationKey: randString,
          },
        }
      );
    }
    catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }

    mailer(
      req.body.username,
      "Passwort für TimesBook setzen",
      "<p>Sehr geehrter Nutzer,</p><br>" +
      `<p>Zum Setzen eines neuen Passwortes für Ihr Benutzerkonto folgen Sie bitte diesem Link:</p><br/>` +
      `<p><a href="${process.env.FRONTEND_URL}/ResetPassword?username=${req.body.username}&regKey=${randString}">${process.env.FRONTEND_URL}/ResetPassword?username=${req.body.username}&regKey=${randString}</a></p><br/>` +
      "<p>TimesBook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
      "TimesBook")
      .then(() => {
        logger.info("Admin '" + req.body.username + "' for organisation '" + req.body.organization + "' was invited");
      })
      .catch((err) => {
        logger.error("Error while sending e-mail: " + err);
        res
          .status(500)
          .send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
      });
    logger.info("Pass recovery process was started for: " + req.body.username);
    res.send({ success: "Pass recovery process was started for: " + req.body.username });
  }

});


/**
 * Confirms admin user account
 *
 */
router.patch("/confirmAdminAccount", async (req, res) => {
  logger.info("POST request on endpoint '/auth/confirmAdminAccount'. Body: " + JSON.stringify(req.body));

  const user = await User.findOne({ username: req.body.username, });
  if (!user) {
    logger.error(`User was not found for the given username (e-mail): ${req.body.username}`);
    return res.status(400).send({ errorCode: 4003, message: "User was not found for the given username (e-mail)" });
  }
  else if (user.registrationKey === 'matched') {
    logger.error(`Account ${req.body.username} was already confirmed`);
    return res.status(200).send({ errorCode: 4023, message: "Account " + req.body.username + "' was already confirmed." });
  }
  else if (user.registrationKey !== req.body.registrationKey) {
    logger.error(`Username: ${req.body.username} is not registered or registartion key is invalid`);
    return res.status(400).send({ errorCode: 4022, message: "Registartion key is invalid" });
  }
  else {
    try {
      const update = await User.updateOne(
        {
          username: req.body.username,
          registrationKey: req.body.registrationKey,
        },
        {
          $set: {
            registrationKey: "matched",
          },
        }
      );
      logger.info("The account '" + req.body.username + "' was confirmed");
      res.send({ success: "The account was confirmed" });
    }
    catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }
  }
});


/**
 * Sets password for the registered user
 *
 */
router.post("/setPass", async (req, res) => {
  logger.info("POST request on endpoint '/auth/setPass'. Body: " + JSON.stringify(req.body));

  try {
    const userExists = await User.findOne({ username: req.body.username, });
    if (!userExists) {
      logger.error("No user found for the given username (e-mail): " + req.body.username);
      return res.status(400).send({ errorCode: 4003, message: "No user found for the given username (e-mail): " + req.body.username });
    } else if (userExists.registrationKey === "matched") {
      logger.error(`The Password for user ${req.body.username} is already set`);
      return res.status(400).send({ errorCode: 4005, message: `The Password for user ${req.body.username} is already set`, });
    } else if (userExists.registrationKey !== req.body.registrationKey) {
      logger.error(`Bad registration key for user: ${req.body.username}`);
      return res.status(400).send({ errorCode: 4006, message: `Bad registration key for user: ${req.body.username}` });
    }
  } catch (error) {
    logger.error("Error while accessing the database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
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
    logger.info("Passwort successfully set for user: " + req.body.username);
    res.status(200).send({ success: "Passwort successfully set" });
  } catch (error) {
    logger.error("Error while accessing zhe database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }
});


/**
 * Registers a user with role 'admin'
 *
 */
router.post("/register", async (req, res) => {
  logger.info(`POST request on endpoint '/auth/register'
    Body: " + ${JSON.stringify(req.body)}`);


  const recaptchaResult = await axios.post(`${process.env.RECAPTCHA_API_URL}?secret=${process.env.RECAPTCHA_SECRET}&response=${req.body.recaptchaKey}`,
    {},
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

  if (!recaptchaResult.data.success)
    res.status(400).send({ errorCode: 4027, message: "Recaptcha verification failed" });
  else {
    // check e-mail in DB
    const userExists = await User.findOne({ username: req.body.username });
    if (userExists) {
      logger.error("The user cannot be registered. E-mail already exists: " + req.body.username);
      return res.status(400).send({ errorCode: 4001, message: "The user cannot be registered. E-mail already exists: " + req.body.username, });
    }

    //check, if admin account for orga exists
    const adminForOrgaExists = await User.findOne({ organization: req.body.organization, role: "admin", });
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

    // send confirmation e-mail
    const randString = cryptoRandomString({ length: 30 });
    mailer(
      req.body.username,
      "Registrierung bei TimesBook abschließen",
      "<p>Sehr geehrter Nutzer,</p>" +
      `<p>Sie haben sich als Verwalter (admin) der Organisation ${req.body.organization} zur Nutzung des Zeiterfassunssystems 'TimesBook’ angemeldet. Bitte schließen Sie Ihre Registrierung unter folgendem Link ab:</p>` +
      `<p><a href="${process.env.FRONTEND_URL}/confirmAccount?username=${req.body.username}&regKey=${randString}">${process.env.FRONTEND_URL}confirmAccount?username=${req.body.username}&regKey=${randString}</a></p>` +
      "<p>TimesBook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
      "<p>Vielen Dank für Ihre Registrierung!<p/><br/>" +
      "TimesBook")
      .then(() => {
        logger.info("Admin '" + req.body.username + "' for organisation '" + req.body.organization + "' was invited");
      })
      .catch((err) => {
        logger.error("Error while sending e-mail: " + err);
        res
          .status(500)
          .send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
      });

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      const user = new User({
        name: req.body.name,
        username: req.body.username,
        password: hashedPassword,
        role: "admin",
        organization: req.body.organization,
        registrationKey: randString,
      });

      const savedUser = await user.save();
      logger.debug(JSON.stringify(savedUser));
      res.status(200).send({ success: `Admin '${req.body.username}' for organisation '${req.body.organization}' was registered` });
    } catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }
  }
});


/**
 * User login. Response jwt.
 *
 */
router.post("/login", async (req, res) => {
  logger.info(`POST request on endpoint '/auth/login'
    Body: + ${JSON.stringify(req.body)}`);

  const recaptchaResult = await axios.post(`${process.env.RECAPTCHA_API_URL}?secret=${process.env.RECAPTCHA_SECRET}&response=${req.body.recaptchaKey}`,
    {},
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

  if (!recaptchaResult.data.success)
    res.status(400).send({ errorCode: 4027, message: "Recaptcha verification failed" });
  else {
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

    if (user.registrationKey !== 'matched')
      return res
        .status(400)
        .send({
          errorCode: 4011,
          error:
            "Account ist not confirmed."
        });

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
    res.header("auth-token", token).send({ success: { jwt: token } });
  }
}
);


/**
 * Invites user via e-mail
 *
 */
router.post("/invite", auth, async (req, res) => {
  logger.info(
    "POST request on endpoint '/invite'. Body: " + JSON.stringify(req.body)
  );

  const randString = cryptoRandomString({ length: 30 });
  if (req.requestingUser.role === "admin") {
    mailer(
      req.body.username,
      "Einladung von TimesBook ",
      "<p>Sehr geehrter Nutzer,</p>" +
      `<p>Sie sind vom Verwalter Ihrer Organisation ${req.requestingUser.organization} zur Nutzung des Zeiterfassungssystems 'TimesBook' eingeladen. Damit Sie die App nutzen können, schließen Sie bitte Ihre Registrierung unter folgendem Link ab:</p>` +
      `<p><a href="${process.env.FRONTEND_URL}/ResetPassword?username=${req.body.username}&regKey=${randString}">${process.env.FRONTEND_URL}/ResetPassword?username=${req.body.username}&regKey=${randString}</a></p>` +
      "<p>TimesBook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
      "<p>Vielen Dank für Ihre Registrierung!<p/><br/>" +
      "TimesBook")
      .then(async (response) => {
        try {
          const newUser = new User({
            username: req.body.username,
            name: req.body.name,
            role: "user",
            organization: req.requestingUser.organization,
            registrationKey: randString,

          });
          const savedUser = await newUser.save();
          logger.info("User '" + req.body.username + "' was invited");
          res.status(200).send({ success: `User ${req.body.username} was invited` });
        } catch (error) {
          if (error.code === 11000) {
            logger.error("The user already exists: " + req.body.username);
            res.status(400).send({ errorCode: 4018, message: "The user already exists: " + req.body.username });
          }
          else {
            logger.error("Error while accessing the database: " + error);
            res.status(500).send({ errorCode: 5001, message: error });
          }
        }
      })
      .catch((err) => {
        logger.error("Error while sending e-mail: " + err);
        res.status(500).send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
      });
  } else {
    logger.error("User have no permissions to invite other users");
    return res.status(403).send({ errorCode: 4010, message: "User have no permissions to invite other users" });
  }
});


/**
 * Change the pass for a user
 *
 */
router.patch("/changePass/", auth, async (req, res) => {
  logger.info("PATCH request on endpoint '/cahngePass'.");

  // check body
  var constraints = {
    password: {
      presence: true,
      length: {
        minimum: 6,
      },
    },
  };
  const result = validate({ password: req.body.password }, constraints);
  if (result !== undefined) {
    if (result.pass)
      res.status(400).send({ errorCode: 4020, message: "The password must be at least six characters long" });
  } else {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      const update = await User.updateOne(
        { username: req.requestingUser.username },
        {
          $set: {
            password: hashedPassword,
          },
        }
      );
      res.status(200).send({ success: `The password for user ${req.requestingUser.username} was successfully changed` });
    } catch (error) {
      logger.error(error);
      res.status(500).send({ errorCode: 500, message: "Internal server error" });
    }
  }
});

module.exports = router;
