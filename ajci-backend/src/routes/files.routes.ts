import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { getFile } from "../controllers/files.controller.js";

const router = Router();

router.get("/:id", asyncHandler(getFile));

export default router;
