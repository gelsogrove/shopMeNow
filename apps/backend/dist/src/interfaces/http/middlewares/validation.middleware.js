"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOtp = exports.validateResetPassword = exports.validateForgotPassword = exports.validateRegister = void 0;
const zod_1 = require("zod");
const error_middleware_1 = require("./error.middleware");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
    firstName: zod_1.z.string().min(2, "First name must be at least 2 characters"),
    lastName: zod_1.z.string().min(2, "Last name must be at least 2 characters"),
    gdprAccepted: zod_1.z.boolean().refine((val) => val === true, {
        message: "You must accept the GDPR terms",
    }),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Token is required"),
    newPassword: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
});
const otpSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
});
const validateRegister = (req, res, next) => {
    try {
        registerSchema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new error_middleware_1.AppError(400, error.errors[0].message);
        }
        next(error);
    }
};
exports.validateRegister = validateRegister;
const validateForgotPassword = (req, res, next) => {
    try {
        forgotPasswordSchema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new error_middleware_1.AppError(400, error.errors[0].message);
        }
        next(error);
    }
};
exports.validateForgotPassword = validateForgotPassword;
const validateResetPassword = (req, res, next) => {
    try {
        resetPasswordSchema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new error_middleware_1.AppError(400, error.errors[0].message);
        }
        next(error);
    }
};
exports.validateResetPassword = validateResetPassword;
const validateOtp = (req, res, next) => {
    try {
        otpSchema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new error_middleware_1.AppError(400, error.errors[0].message);
        }
        next(error);
    }
};
exports.validateOtp = validateOtp;
//# sourceMappingURL=validation.middleware.js.map