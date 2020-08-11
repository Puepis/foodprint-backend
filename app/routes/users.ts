import express from "express";
const router = express.Router();
import { verifyToken } from "../auth/auth";
import {
  registerUser,
  loginUser,
  refreshToken,
  revokeRefreshTokens,
} from "../controllers/authController";
import {
  getFoodprint,
  changeAvatar,
  updatePassword,
  updateUsername,
  deleteUser,
} from "../controllers/accountController";

// Authentication endpoints
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh_token", refreshToken);
router.post("/revoke_token", revokeRefreshTokens);

// Authorized user account endpoints
router.get("/foodprint", verifyToken, getFoodprint);
router.post("/avatar", verifyToken, changeAvatar);
router.post("/change/password", verifyToken, updatePassword);
router.post("/change/username", verifyToken, updateUsername);
router.delete("/delete", verifyToken, deleteUser);

module.exports = router;
