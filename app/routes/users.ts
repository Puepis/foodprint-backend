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
router.use(verifyToken);
router.get("/foodprint", getFoodprint);
router.post("/avatar", changeAvatar);
router.post("/change/password", updatePassword);
router.post("/change/username", updateUsername);
router.delete("/delete", deleteUser);

export = router;
