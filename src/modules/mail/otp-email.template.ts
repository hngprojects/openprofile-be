export const otpEmailTemplate = ({ otp }: { otp: string }) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Your Open Profile Verification Code</h2>
    <p>Hello,</p>
    <p>You requested a new verification code. Please use the following 6-digit code to verify your account:</p>
    <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
    </div>
    <p>This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
    <p>Best regards,<br>The Open Profile Team</p>
</body>
</html>
`;
