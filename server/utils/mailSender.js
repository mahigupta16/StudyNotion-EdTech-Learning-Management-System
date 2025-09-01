const nodemailer = require("nodemailer");

const mailSender = async (email, title, body) => {
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,   // smtp.gmail.com
      port: 465,                     // Gmail SSL
      secure: true,                  // true for 465, false for 587
      auth: {
        user: process.env.MAIL_USER, // your Gmail
        pass: process.env.MAIL_PASS, // your App Password
      },
    });

    let info = await transporter.sendMail({
      from: `"StudyNotion || CodeHelp - by Babbar" <${process.env.MAIL_USER}>`, 
      to: email,
      subject: title,
      html: body,
    });

    console.log("Email sent successfully ✅:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email sending error ❌:", error.message);
    return null;
  }
};

module.exports = mailSender;
