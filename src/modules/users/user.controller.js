import express from "express";
import * as userservrice from ".//user.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Profile data
 */
router.get("/me", auth, userservrice.getProfile);

/**
 * @swagger
 * /users/all:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/all", auth, permission("VIEW_USERS"), userservrice.get_users);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 */
router.delete("/:id", auth, permission("DELETE_USER"), userservrice.deleteuser);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Assign a system role to a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch("/:id/role", auth, permission("ASSIGN_ROLE"), userservrice.update_userrole);

/**
 * @swagger
 * /users/updatepassword:
 *   post:
 *     summary: Update password (Authenticated)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post('/updatepassword', auth, userservrice.updatepassword);

router.get('/count', auth, permission("VIEW_USERS"), userservrice.get_usercount);
router.get('/:id', auth, permission("VIEW_USERS"), userservrice.get_member_profile);
export default router;  