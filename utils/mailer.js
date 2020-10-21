
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { response } = require("express");
const OAuth2 = google.auth.OAuth2;
const logger = require("../utils/logger");


/**
 * Sents e-mail via smtp
 */
async function sendMail(recipient, mailBody) {

  let transporter;

  // create reusable transporter object using the default SMTP transport
  // let testAccount = await nodemailer.createTestAccount();
  // transporter = nodemailer.createTransport({
  //   host: "smtp.ethereal.email",
  //   port: 587,
  //   secure: false, // true for 465, false for other ports
  //   auth: {
  //     user: testAccount.user, // generated ethereal user
  //     pass: testAccount.pass, // generated ethereal password
  //   },
  // });

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
  const accessToken = oauth2Client.getAccessToken()
    .catch(() => {});

  transporter = nodemailer.createTransport({
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
    to: recipient,
    subject: "Sie sind für die Nutzung von Timesbook eingeladen",
    html: mailBody,
  });
}


module.exports = sendMail;