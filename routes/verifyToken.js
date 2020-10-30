const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");


/**
 * 
 */
async function verify(req, res, next) {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errorCode: 4007, message: "Access denied. No JWT provided." });

  try {
    req.decodedToken = jwt.verify(token, process.env.TOKEN_SECRET);
    try {
      const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0, registrationKey: 0 });

      if (!user) {
        logger.error("The requesting user with the given ID provided by JWT does not exist.");
        return res.status(400).send({ errorCode: 4009, message: "The requesting user with the given ID provided by JWT does not exist." });
      }
      logger.info("Requesting user: " + user);
      req.requestingUser = user;
      next();
    } catch (error) {
      logger.error("Error while accessing the database: ", error)
      res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
    }
  } catch (error) {
    res.status(401).send({ errorCode: 4008, message: "JWT cannot be verified" });
  }


}

module.exports = verify;
