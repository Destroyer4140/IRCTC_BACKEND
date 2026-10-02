const { config } = require("../config");
const { BadRequestError } = require("../utils/error");
const { asyncHandler } = require('../utils/asyncHandler');
const authService  = require('../services/auth.service');



exports.sendOTP = asyncHandler (async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    console.log(firstName, lastName, email, password, confirmPassword);
    throw new BadRequestError("All fields are mandatory!!");
  }
  if (password !== confirmPassword) {
    throw new BadRequestError("Password mismatch");
  }

  const { otpSessionId } = await authService.sendOTP(firstName, lastName, email, password);
  res.cookie("otp_session", otpSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: config.OTP_TTL*1000
  }).status(200).json({
    success: true,
    message: "OTP sent successfully"
  })
})