"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const auth_1 = require("../auth/auth");
const authController_1 = require("../controllers/authController");
const accountController_1 = require("../controllers/accountController");
// Authentication endpoints
router.post("/register", authController_1.registerUser);
router.post("/login", authController_1.loginUser);
router.post("/refresh_token", authController_1.refreshToken);
router.post("/revoke_token", authController_1.revokeRefreshTokens);
// Authorized user account endpoints
router.get("/foodprint", auth_1.verifyToken, accountController_1.getFoodprint);
router.post("/avatar", auth_1.verifyToken, accountController_1.changeAvatar);
router.post("/change/password", auth_1.verifyToken, accountController_1.updatePassword);
router.post("/change/username", auth_1.verifyToken, accountController_1.updateUsername);
router.delete("/delete", auth_1.verifyToken, accountController_1.deleteUser);
module.exports = router;
