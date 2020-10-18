const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validate = require("validate.js");
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
router.patch("/changePass/:username", auth, async (req, res) => {
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
      res.status(400).send("The password must be at least six characters long");
  } else {
    try {
      //check user in db
      const user = await User.findById(req.decodedToken._id);
      if (!user) {
        logger.error({ error: "No user found for the given id" });
        return res.status(401).send({ errorCode: 4009, message: "No user found for the given id" });
      } else {
        if (user.username === req.params.username){
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(req.body.password, salt);
          const update = await User.updateOne(
            { username: req.params.username },
            {
              $set: {
                password: hashedPassword,
              },
            }
          );
          res.status(200).send({ success: `The password for user ${user.username} was successfully changed` });
        }
        else
          res.status(403).send({ errorCode: 403, message: "No permissions to change password for another user." });
      }
    } catch (error) {
      logger.error(error);
      res.status(500).send({ errorCode: 500, message: "Internal server error"});
    }
  }
  // 3. set Pass
});


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
    res.status(500).send({ errorCode: 5001, message: error });
  }
});

/**
 * Updates user profile
 *
 */
router.patch("/:username", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/:username'. Username: " + req.params.username +
    "; body: " + JSON.stringify(req.body)
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
    res.status(200).send({ success: "User updated" });
  } catch (error) {
    logger.error("Error while accessing Database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
  }
});

/**
 * Gets all user profiles of a organization
 *
 */
router.get("/", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user'");

  try {
    const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
    logger.debug(JSON.stringify(user));
    if (!user) {
      logger.error("No user found for the given id");
      return res.status(400).send({ errorCode: 4009, message: "No user found for the given id" });
    } else {
      if (user.role === "admin") {
        const users = await User.find({ organization: user.organization }, { password: 0, _id: 0, registrationKey: 0 });
        res.status(200).send(users);
      } else {
        logger.error("User have no permissions to retrieve other user profiles");
        return res.status(403).send({ errorCode: 4010, message: "User have no permissions to retrieve other user profiles" });
      }
    }
  } catch (error) {
    logger.error("Error while accessing Database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
  }

});

/**
 * Gets user profile
 *
 */
router.get("/profile", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user/profile'");

  try {
    const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0, registrationKey: 0 });
    logger.debug(JSON.stringify(user));
    if (!user) {
      logger.error("No user found for the given id");
      return res.status(400).send({ errorCode: 4009, message: "No user found for the given id" });
    }
    res.status(200).send(user);
  } catch (error) {
    logger.error("Error while accessing Database: " + error)
    res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
  }


});

module.exports = router;
