const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");


/**
 * 
 */
function verify(req, res, next) {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errorCode: 4007,  message: "Access denied. No JWT provided." });

  try {
    req.decodedToken = jwt.verify(token, process.env.TOKEN_SECRET);
    logger.debug("Decoded JWT: " + JSON.stringify(req.decodedToken));
    next();
  } catch (error) {
    res.status(401).send({ errorCode: 4008, message: "JWT cannot be verified" });
  }
}

module.exports = verify;
