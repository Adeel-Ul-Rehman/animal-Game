const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendOTPEmail = async (email, otp, purpose) => {
  const subject = purpose === 'verification' 
    ? 'Verify Your Email - Animal Battle' 
    : 'Reset Your Password - Animal Battle';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h1 style="color: #4CAF50; text-align: center;">Animal Battle Game</h1>
      <h2 style="color: #333; text-align: center;">${subject}</h2>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center;">
        <p style="font-size: 16px; color: #666;">Your OTP code is:</p>
        <h1 style="font-size: 48px; color: #4CAF50; letter-spacing: 10px; margin: 20px 0;">${otp}</h1>
        <p style="font-size: 14px; color: #999;">This code will expire in 5 minutes.</p>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        If you didn't request this, please ignore this email.
      </p>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: `"Animal Battle" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: subject,
      html: html
    });
    console.log(`📧 OTP email sent to ${email} for ${purpose}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

const sendCoinNotification = async (email, username, amount, type) => {
  let subject, message;
  
  switch(type) {
    case 'approved':
      subject = '✅ Coin Request Approved!';
      message = 'Your coin request has been approved!';
      break;
    case 'bonus':
      subject = '🎁 Bonus Coins Received!';
      message = 'Bonus coins have been added to your account!';
      break;
    default:
      subject = '💰 Coins Added to Your Account';
      message = 'Coins have been added to your account!';
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h1 style="color: #4CAF50; text-align: center;">Animal Battle Game</h1>
      <h2 style="color: #333; text-align: center;">Hello ${username}!</h2>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center;">
        <p style="font-size: 18px; color: #333;">${message}</p>
        <h1 style="font-size: 48px; color: #FFD700; margin: 10px 0;">+${amount} Coins</h1>
        <p style="font-size: 16px; color: #666;">Your balance has been updated. Good luck!</p>
      </div>
      <p style="text-align: center; margin-top: 20px;">
        <a href="${process.env.CLIENT_URL}/game" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Play Now</a>
      </p>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        If you have any questions, please contact support.
      </p>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: `"Animal Battle" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: subject,
      html: html
    });
    console.log(`📧 Coin notification sent to ${email}: +${amount} coins`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

const sendBanNotification = async (email, username, banReason, contactEmail) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h1 style="color: #4CAF50; text-align: center;">Animal Battle Game</h1>
      <h2 style="color: #f44336; text-align: center;">⚠️ Account Banned</h2>
      <div style="background-color: #fff3f3; padding: 20px; border-radius: 5px; border-left: 4px solid #f44336;">
        <p style="font-size: 16px; color: #333;">Hello <strong>${username}</strong>,</p>
        <p style="font-size: 16px; color: #333;">Your account has been banned from Animal Battle.</p>
        <div style="background: #fee2e2; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #991b1b;">Reason: ${banReason}</p>
        </div>
        <p style="font-size: 14px; color: #666;">If you believe this is a mistake or would like to appeal, please contact us at:</p>
        <p style="font-size: 16px; text-align: center;"><a href="mailto:${contactEmail}" style="color: #3b82f6; font-weight: bold;">${contactEmail}</a></p>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        This action was taken by the Animal Battle administration team.
      </p>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"Animal Battle" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: '⚠️ Your Animal Battle account has been banned',
      html,
    });
    console.log(`📧 Ban notification sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Ban email send error:', error);
    return false;
  }
};

module.exports = { sendOTPEmail, sendCoinNotification, sendBanNotification };