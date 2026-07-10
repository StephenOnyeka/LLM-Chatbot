import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { uploadFile } from "../controllers/upload.controller.js";

const router = Router();
router.use(requireAuth);

router.post("/", asyncHandler(uploadFile));

export default router;
