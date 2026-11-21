import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { ActivityStatus, SubmissionReviewStatus, UnifiedAuditCategory } from '../../src/shared/types.ts';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
  RETENTION_DAYS,
} from '../../src/shared/domain.ts';
import type { LittleStepsRepository } from '../repositories/index.ts';
import type { RetentionWorker } from '../services/retentionWorker.ts';
import type { MediaStorageAdapter } from '../storage/mediaStorage.ts';
import {
  buildSessionCookieOptions,
  createAuthMiddleware,
  createRateLimiter,
  requireCsrfProtection,
  requireRole,
  SESSION_COOKIE_NAME,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  generateOneTimeToken,
  hashIp,
  hashOneTimeToken,
  hashPassword,
  signSessionToken,
  signVideoStreamToken,
  validateImageMagicBytes,
  validateVideoMagicBytes,
  verifyPassword,
  verifyVideoStreamToken,
} from '../security/crypto.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
    files: 1,
  },
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max for optional profile photos
    files: 1,
  },
});

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().min(2, 'Please enter your name.').max(100),
  phoneNumber: z.string().max(24).optional().nullable(),
  preferredLocale: z.enum(['en', 'hi']).optional().default('en'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
  portalRole: z.enum(['parent', 'reviewer', 'admin']).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is missing or invalid.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Verification token is missing or invalid.'),
});

const childSchema = z.object({
  displayName: z.string().min(1, 'Please enter your baby’s name or nickname.').max(60),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid date of birth.'),
  profilePhotoUrl: z.string().max(200).optional().nullable(),
  activityPreferences: z.string().max(500).optional().nullable(),
});

const onboardingParentSchema = z.object({
  fullName: z.string().min(2, 'Please enter your name.').max(100),
  email: z.string().email('Please enter a valid email address.'),
  preferredLocale: z.enum(['en', 'hi']),
  profilePhotoUrl: z.string().max(200).optional().nullable(),
});

const onboardingPreferencesSchema = z.object({
  preferredActivityTime: z.enum(['morning', 'afternoon', 'evening', 'flexible']),
  notificationPreference: z.enum(['daily_gentle', 'weekly_summary', 'none']),
  preferredLocale: z.enum(['en', 'hi']),
  markComplete: z.boolean().optional().default(true),
});

const completionSchema = z.object({
  childId: z.string().min(1),
  activityId: z.string().min(1),
  status: z.enum(['started', 'completed']),
  caregiverNotes: z.string().max(600).optional().nullable(),
});

const reviewSubmitSchema = z
  .object({
    mode: z.enum(['draft', 'publish', 'not_assessable']).optional().default('publish'),
    strengthsNote: z.string().max(1000).optional().default(''),
    coachingTip: z.string().max(1000).optional().default(''),
    reviewerComments: z.string().max(1200).optional().nullable(),
    notAssessableReason: z.string().max(600).optional().nullable(),
    evaluationScopeAcknowledged: z.boolean().optional().default(false),
    criterionRatings: z
      .array(
        z.object({
          criterionId: z.string().min(1),
          achievedLevel: z.enum([
            'met',
            'partially_met',
            'not_met',
            'not_observed',
            'not_assessable',
          ]),
          explanation: z.string().max(400).optional().nullable(),
        })
      )
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== 'draft' && !data.evaluationScopeAcknowledged) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please confirm this evaluation assesses caregiver instruction execution only.',
        path: ['evaluationScopeAcknowledged'],
      });
    }
    if (data.mode === 'publish') {
      if (data.strengthsNote.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please share positive caregiver observations (at least 10 characters).',
          path: ['strengthsNote'],
        });
      }
      if (data.coachingTip.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please share one practical area to improve (at least 10 characters).',
          path: ['coachingTip'],
        });
      }
      if (data.criterionRatings.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please evaluate the activity rubric criteria before publishing.',
          path: ['criterionRatings'],
        });
      }
    }
    if (data.mode === 'not_assessable') {
      if ((data.notAssessableReason?.trim().length ?? 0) < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Please provide a clear explanation (at least 10 characters) of why evidence is insufficient.',
          path: ['notAssessableReason'],
        });
      }
    }
  });

const adminActivitySchema = z.object({
  ageGroupId: z.string().min(1, 'Please choose an age group.'),
  domainId: z.string().min(1, 'Please choose a development domain.'),
  title: z.string().min(3, 'Title must be at least 3 characters.').max(120),
  summary: z.string().min(10, 'Summary must be at least 10 characters.').max(300),
  objectives: z.array(z.string().min(2).max(200)).max(8).optional().default([]),
  durationMinutes: z.coerce.number().int().min(1).max(30),
  prepLevel: z.enum(['no_prep', 'quick_setup', 'guided_prep']).optional().default('quick_setup'),
  materials: z.array(z.string().min(1).max(100)).min(1, 'Add at least one household material.').max(10),
  safetyNotes: z.string().min(5, 'Safety guidelines must be at least 5 characters.').max(500),
  instructionalPosterUrl: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (url) =>
        (url.startsWith('/') && !url.startsWith('//')) ||
        /^https?:\/\/[^\s]+$/i.test(url),
      'Instructional poster URL must be a safe relative path or http(s) URL.'
    ),
  instructionalVideoUrl: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^https?:\/\/.+/i.test(val) || val.startsWith('/'),
      'Instructional video URL must start with http://, https://, or /.'
    )
    .optional()
    .nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  changeNote: z.string().max(300).optional().nullable(),
  steps: z
    .array(
      z.object({
        title: z.string().min(2, 'Each step needs a short title.').max(100),
        instructionText: z.string().min(5, 'Each step needs clear instructions.').max(500),
        caregiverTip: z.string().max(240).optional().nullable(),
      })
    )
    .min(1, 'Add at least one step-by-step instruction.')
    .max(8),
  rubricCriteria: z
    .array(
      z.object({
        label: z.string().min(3, 'Criterion label must be at least 3 characters.').max(100),
        description: z.string().min(5, 'Criterion description must be at least 5 characters.').max(300),
        weightPoints: z.coerce.number().int().min(5).max(100),
      })
    )
    .min(1, 'Add at least one rubric criterion.')
    .max(8),
});

const ageGroupSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug is required.')
    .max(24)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens.'),
  label: z.string().trim().min(2, 'Label is required.').max(60),
  minMonths: z.coerce.number().int().min(0).max(48),
  maxMonths: z.coerce.number().int().min(1).max(60),
  sortOrder: z.coerce.number().int().min(1).max(100),
});

const domainSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug is required.')
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'Slug may only contain lowercase letters, numbers, hyphens, and underscores.'),
  name: z.string().trim().min(2, 'Domain name is required.').max(80),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(400),
  sortOrder: z.coerce.number().int().min(1).max(100),
});

const createReviewerSchema = z.object({
  email: z.string().email('Please enter a valid reviewer email address.'),
  fullName: z.string().trim().min(2, 'Please enter the reviewer’s full name.').max(100),
  password: z.string().min(8, 'Temporary password must be at least 8 characters.'),
  allowedAgeGroupSlugs: z.array(z.string().max(32)).max(16).optional().default([]),
  specialtyNote: z.string().max(240).optional().nullable(),
});

const updateReviewerSchema = z.object({
  isActive: z.boolean().optional(),
  allowedAgeGroupSlugs: z.array(z.string().max(32)).max(16).optional(),
  specialtyNote: z.string().max(240).optional().nullable(),
});

const dailyPlanSchema = z.object({
  ageGroupId: z.string().min(1),
  dayNumber: z.coerce.number().int().min(1).max(30),
  title: z.string().min(3).max(100),
  focusNote: z.string().min(5).max(300),
  activityIds: z.array(z.string().min(1)).min(1).max(4),
});

function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(req, 7 * 24 * 60 * 60 * 1000));
}

export function createApiRouter(
  repo: LittleStepsRepository,
  storage: MediaStorageAdapter,
  retentionWorker: RetentionWorker
): express.Router {
  const router = express.Router();
  router.use(requireCsrfProtection);
  const requireAuth = createAuthMiddleware(repo);
  const authRateLimit = createRateLimiter(15 * 60 * 1000, 40);
  const uploadRateLimit = createRateLimiter(15 * 60 * 1000, 20);

  // ======================== HEALTH & META ========================

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'LittleSteps API v1' });
  });

  router.get('/curriculum/meta', (_req, res) => {
    res.json({
      ageGroups: repo.listAgeGroups(),
      learningDomains: repo.listLearningDomains(),
    });
  });

  router.post('/contact', authRateLimit, (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2, 'Please enter your name.').max(100),
      email: z.string().email('Please enter a valid email address.'),
      topic: z.string().min(2).max(80),
      message: z.string().min(10, 'Please share a few details (at least 10 characters).').max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid message details.' });
      return;
    }
    const inquiry = repo.createContactInquiry(parsed.data);
    res.status(201).json({ inquiry });
  });

  // ======================== AUTHENTICATION ========================

  router.post('/auth/register', authRateLimit, (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
      return;
    }
    const existing = repo.findUserByEmail(parsed.data.email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const { user, sessionVersion } = repo.createUser({
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber ?? null,
      role: 'parent',
      preferredLocale: parsed.data.preferredLocale,
      ipHash: hashIp(req.ip || 'unknown'),
    });

    const { rawToken, tokenHash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    repo.createAuthToken({
      userId: user.id,
      tokenType: 'email_verification',
      tokenHash,
      expiresAt,
    });

    const sessionToken = signSessionToken(user.id, user.role, sessionVersion);
    setSessionCookie(req, res, sessionToken);
    // Prototype preview link is returned strictly in non-production preview so email verification can be tested without SMTP
    res.status(201).json({
      user,
      verificationPreviewPath:
        process.env.NODE_ENV !== 'production'
          ? `/verify-email?token=${encodeURIComponent(rawToken)}`
          : undefined,
    });
  });

  router.post('/auth/login', authRateLimit, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter a valid email and password.' });
      return;
    }
    const found = repo.findUserByEmail(parsed.data.email);
    if (!found || !found.isActive || !verifyPassword(parsed.data.password, found.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (parsed.data.portalRole && found.role !== parsed.data.portalRole) {
      const roleLabels: Record<string, string> = {
        parent: 'Parent',
        reviewer: 'Reviewer',
        admin: 'Admin',
      };
      res.status(403).json({
        error: `This account does not have ${roleLabels[parsed.data.portalRole]} access. Please sign in using the ${roleLabels[found.role]} tab.`,
      });
      return;
    }
    const { passwordHash: _omit, sessionVersion, ...user } = found;
    const token = signSessionToken(user.id, user.role, sessionVersion);
    setSessionCookie(req, res, token);
    res.json({ user });
  });

  router.post('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, buildSessionCookieOptions(req));
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  router.post('/auth/forgot-password', authRateLimit, (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please enter a valid email.' });
      return;
    }
    const found = repo.findUserByEmail(parsed.data.email);
    let resetPreviewPath: string | undefined;
    if (found && found.isActive) {
      const { rawToken, tokenHash } = generateOneTimeToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      repo.createAuthToken({
        userId: found.id,
        tokenType: 'password_reset',
        tokenHash,
        expiresAt,
      });
      if (process.env.NODE_ENV !== 'production') {
        resetPreviewPath = `/reset-password?token=${encodeURIComponent(rawToken)}`;
      }
    }
    // Always return a calm generic response to prevent account enumeration
    res.json({
      message:
        'If an account exists for that email address, we have prepared a password reset link.',
      resetPreviewPath,
    });
  });

  router.post('/auth/reset-password', authRateLimit, (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password reset request.' });
      return;
    }
    const tokenHash = hashOneTimeToken(parsed.data.token.trim());
    const consumed = repo.consumeAuthToken(tokenHash, 'password_reset');
    if (!consumed) {
      res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a fresh reset link.',
      });
      return;
    }
    repo.updateUserPasswordAndBumpSession(consumed.userId, hashPassword(parsed.data.newPassword));
    res.clearCookie(SESSION_COOKIE_NAME, buildSessionCookieOptions(req));
    res.json({ ok: true, message: 'Your password has been updated. Please sign in.' });
  });

  router.post('/auth/verify-email', authRateLimit, (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid verification link.' });
      return;
    }
    const tokenHash = hashOneTimeToken(parsed.data.token.trim());
    const consumed = repo.consumeAuthToken(tokenHash, 'email_verification');
    if (!consumed) {
      res.status(400).json({
        error: 'This verification link is invalid or has already been used.',
      });
      return;
    }
    const user = repo.markEmailVerified(consumed.userId);
    res.json({ ok: true, user });
  });

  router.post('/auth/resend-verification', requireAuth, authRateLimit, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.emailVerifiedAt) {
      res.json({ alreadyVerified: true, message: 'Your email is already verified.' });
      return;
    }
    const { rawToken, tokenHash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    repo.createAuthToken({
      userId: user.id,
      tokenType: 'email_verification',
      tokenHash,
      expiresAt,
    });
    res.json({
      message: 'A fresh verification link has been prepared.',
      verificationPreviewPath:
        process.env.NODE_ENV !== 'production'
          ? `/verify-email?token=${encodeURIComponent(rawToken)}`
          : undefined,
    });
  });

  // ======================== PRIVATE PROFILE PHOTOS (OWNER-ONLY) ========================

  const validateOwnedPhotoUrl = (userId: string, photoUrl?: string | null): boolean => {
    if (!photoUrl) return true;
    const match = /^\/api\/v1\/profile\/photo\/([a-z0-9-]+\.(?:jpg|png|webp))$/i.exec(photoUrl);
    if (!match) return false;
    return repo.userOwnsPhotoKey(userId, match[1]);
  };

  router.post(
    '/profile/photo',
    requireAuth,
    uploadRateLimit,
    photoUpload.single('photo'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'Please select an image file.' });
          return;
        }
        const mime = file.mimetype.split(';')[0].trim().toLowerCase();
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
          res.status(400).json({ error: 'Please upload a JPG, PNG, or WebP photo.' });
          return;
        }
        if (!validateImageMagicBytes(file.buffer)) {
          res.status(400).json({ error: 'Uploaded file is not a valid image.' });
          return;
        }
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const storageKey = await storage.saveBuffer(file.buffer, ext);
        repo.registerProfilePhoto(storageKey, req.authUser!.id);
        res.status(201).json({ photoUrl: `/api/v1/profile/photo/${storageKey}` });
      } catch {
        res.status(500).json({ error: 'Unable to save photo right now.' });
      }
    }
  );

  router.get('/profile/photo/:key', requireAuth, (req: AuthenticatedRequest, res) => {
    const key = req.params.key;
    if (!key || !/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(key)) {
      res.status(400).json({ error: 'Invalid photo identifier.' });
      return;
    }
    if (!repo.userOwnsPhotoKey(req.authUser!.id, key)) {
      res.status(403).json({ error: 'Not authorized to access this photo.' });
      return;
    }
    if (!storage.exists(key)) {
      res.status(404).json({ error: 'Photo not found.' });
      return;
    }
    const mime = key.endsWith('.png')
      ? 'image/png'
      : key.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', mime);
    storage.openReadStream(key).pipe(res);
  });

  // ======================== PARENT ONBOARDING ========================

  router.put(
    '/onboarding/parent',
    requireAuth,
    requireRole('parent'),
    (req: AuthenticatedRequest, res) => {
      const parsed = onboardingParentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parent details.' });
        return;
      }
      if (!validateOwnedPhotoUrl(req.authUser!.id, parsed.data.profilePhotoUrl)) {
        res.status(403).json({ error: 'Invalid or unauthorized profile photo reference.' });
        return;
      }
      const existingByEmail = repo.findUserByEmail(parsed.data.email);
      if (existingByEmail && existingByEmail.id !== req.authUser!.id) {
        res.status(409).json({ error: 'Another account already uses this email address.' });
        return;
      }
      const emailChanged =
        parsed.data.email.trim().toLowerCase() !== req.authUser!.email.trim().toLowerCase();
      const updated = repo.updateParentProfileAndPreferences(req.authUser!.id, {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        preferredLocale: parsed.data.preferredLocale,
        profilePhotoUrl: parsed.data.profilePhotoUrl,
      });

      let verificationPreviewPath: string | undefined;
      if (emailChanged && updated) {
        const { rawToken, tokenHash } = generateOneTimeToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        repo.createAuthToken({
          userId: updated.id,
          tokenType: 'email_verification',
          tokenHash,
          expiresAt,
        });
        if (process.env.NODE_ENV !== 'production') {
          verificationPreviewPath = `/verify-email?token=${encodeURIComponent(rawToken)}`;
        }
      }

      res.json({ user: updated, verificationPreviewPath });
    }
  );

  router.post(
    '/onboarding/complete',
    requireAuth,
    requireRole('parent'),
    (req: AuthenticatedRequest, res) => {
      const parsed = onboardingPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid preferences.' });
        return;
      }
      const children = repo.listChildrenByParent(req.authUser!.id);
      if (children.length === 0) {
        res.status(400).json({
          error: 'Please add your baby’s information before finishing onboarding.',
        });
        return;
      }
      const updated = repo.updateParentProfileAndPreferences(req.authUser!.id, {
        preferredActivityTime: parsed.data.preferredActivityTime,
        notificationPreference: parsed.data.notificationPreference,
        preferredLocale: parsed.data.preferredLocale,
        markOnboardingComplete: parsed.data.markComplete,
      });
      res.json({ user: updated });
    }
  );

  // ======================== PARENT: CHILDREN ========================

  router.get('/children', requireAuth, requireRole('parent'), (req: AuthenticatedRequest, res) => {
    const children = repo.listChildrenByParent(req.authUser!.id);
    res.json({ children });
  });

  router.post('/children', requireAuth, requireRole('parent'), (req: AuthenticatedRequest, res) => {
    const parsed = childSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid child profile.' });
      return;
    }
    if (!validateOwnedPhotoUrl(req.authUser!.id, parsed.data.profilePhotoUrl)) {
      res.status(403).json({ error: 'Invalid or unauthorized baby photo reference.' });
      return;
    }
    const dobDate = new Date(parsed.data.dateOfBirth);
    if (dobDate.getTime() > Date.now()) {
      res.status(400).json({ error: 'Date of birth cannot be in the future.' });
      return;
    }
    const child = repo.createChild(req.authUser!.id, parsed.data.displayName, parsed.data.dateOfBirth, {
      profilePhotoUrl: parsed.data.profilePhotoUrl ?? null,
      activityPreferences: parsed.data.activityPreferences ?? null,
    });
    res.status(201).json({ child });
  });

  router.patch('/children/:id', requireAuth, requireRole('parent'), (req: AuthenticatedRequest, res) => {
    const parsed = childSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid child profile.' });
      return;
    }
    if (!validateOwnedPhotoUrl(req.authUser!.id, parsed.data.profilePhotoUrl)) {
      res.status(403).json({ error: 'Invalid or unauthorized baby photo reference.' });
      return;
    }
    const dobDate = new Date(parsed.data.dateOfBirth);
    if (dobDate.getTime() > Date.now()) {
      res.status(400).json({ error: 'Date of birth cannot be in the future.' });
      return;
    }
    const child = repo.updateChild(
      req.params.id,
      req.authUser!.id,
      parsed.data.displayName,
      parsed.data.dateOfBirth,
      {
        profilePhotoUrl: parsed.data.profilePhotoUrl,
        activityPreferences: parsed.data.activityPreferences,
      }
    );
    if (!child) {
      res.status(404).json({ error: 'Child profile not found.' });
      return;
    }
    res.json({ child });
  });

  router.delete(
    '/children/:id',
    requireAuth,
    requireRole('parent'),
    async (req: AuthenticatedRequest, res) => {
      const child = repo.findChildByIdForParent(req.params.id, req.authUser!.id);
      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }

      // Purge any private child video files from vault storage before cascading the DB rows
      const activeSubs = repo.listActiveSubmissionsForChild(child.id, req.authUser!.id);
      for (const sub of activeSubs) {
        await storage.deleteObject(sub.storage_key);
        repo.logMediaAudit(req.authUser!.id, req.authUser!.role, sub.id, 'parent_delete');
      }

      const deleted = repo.deleteChild(child.id, req.authUser!.id);
      if (!deleted) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }
      res.json({ ok: true, purgedVideos: activeSubs.length });
    }
  );

  // ======================== PARENT: PUBLISHED ACTIVITIES LIBRARY ========================

  router.get('/activities', requireAuth, (req, res) => {
    const ageGroupId = typeof req.query.ageGroupId === 'string' && req.query.ageGroupId !== 'all'
      ? req.query.ageGroupId
      : undefined;
    const domainId = typeof req.query.domainId === 'string' && req.query.domainId !== 'all'
      ? req.query.domainId
      : undefined;
    const activities = repo.listActivities({ ageGroupId, domainId, status: 'published' });
    res.json({ activities });
  });

  router.get('/activities/:id', requireAuth, (req, res) => {
    const activity = repo.getActivityDetail(req.params.id);
    if (!activity || activity.status !== 'published') {
      res.status(404).json({ error: 'Activity not found.' });
      return;
    }
    res.json({ activity });
  });

  // ======================== PARENT: JOURNEY & COMPLETIONS ========================

  router.get(
    '/journey/:childId/today',
    requireAuth,
    requireRole('parent'),
    (req: AuthenticatedRequest, res) => {
      const child = repo.findChildByIdForParent(req.params.childId, req.authUser!.id);
      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }
      const dayParam = req.query.day ? Number(req.query.day) : undefined;
      const journey = repo.getJourneyForChild(
        child,
        dayParam && Number.isFinite(dayParam) ? dayParam : undefined
      );
      res.json(journey);
    }
  );

  router.get(
    '/progress/:childId',
    requireAuth,
    requireRole('parent'),
    (req: AuthenticatedRequest, res) => {
      const child = repo.findChildByIdForParent(req.params.childId, req.authUser!.id);
      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }

      const querySchema = z.object({
        dateFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dateTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        domainId: z.string().max(64).optional(),
        completionStatus: z
          .enum(['all', 'not_started', 'in_progress', 'completed', 'submitted_for_review', 'reviewed'])
          .optional(),
        reviewStatus: z
          .enum(['all', 'none', 'queued', 'in_review', 'resubmit_requested', 'reviewed'])
          .optional(),
      });

      const parsed = querySchema.safeParse({
        dateFrom:
          typeof req.query.dateFrom === 'string' && req.query.dateFrom
            ? req.query.dateFrom
            : undefined,
        dateTo:
          typeof req.query.dateTo === 'string' && req.query.dateTo ? req.query.dateTo : undefined,
        domainId:
          typeof req.query.domainId === 'string' && req.query.domainId
            ? req.query.domainId
            : undefined,
        completionStatus:
          typeof req.query.completionStatus === 'string' && req.query.completionStatus
            ? req.query.completionStatus
            : undefined,
        reviewStatus:
          typeof req.query.reviewStatus === 'string' && req.query.reviewStatus
            ? req.query.reviewStatus
            : undefined,
      });

      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid progress filter parameters.' });
        return;
      }

      const overview = repo.getParentProgressOverview(child.id, parsed.data);
      if (!overview) {
        res.status(404).json({ error: 'Progress data not found.' });
        return;
      }
      res.json(overview);
    }
  );

  router.post(
    '/completions',
    requireAuth,
    requireRole('parent'),
    (req: AuthenticatedRequest, res) => {
      const parsed = completionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid completion data.' });
        return;
      }
      const child = repo.findChildByIdForParent(parsed.data.childId, req.authUser!.id);
      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }
      const activity = repo.getActivityDetail(parsed.data.activityId);
      if (!activity || activity.status !== 'published') {
        res.status(404).json({ error: 'Activity not found.' });
        return;
      }
      const result = repo.upsertActivityCompletion({
        childId: child.id,
        activityId: activity.id,
        status: parsed.data.status,
        caregiverNotes: parsed.data.caregiverNotes ?? null,
      });
      res.status(201).json({ completion: result });
    }
  );

  // ======================== PRIVATE VIDEO UPLOAD, SIGNED STREAM & DELETE ========================

  router.get('/submissions/storage-status', requireAuth, (_req, res) => {
    res.json(storage.getStorageStatus());
  });

  const handleSingleVideoUpload: express.RequestHandler = (req, res, next) => {
    upload.single('video')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'Video file exceeds the 50 MB size limit. Please choose a shorter clip.',
          });
          return;
        }
        res.status(400).json({ error: err.message || 'Invalid video upload request.' });
        return;
      }
      if (err) {
        res.status(400).json({ error: 'Unable to process uploaded video file.' });
        return;
      }
      next();
    });
  };

  router.post(
    '/submissions',
    requireAuth,
    requireRole('parent'),
    uploadRateLimit,
    handleSingleVideoUpload,
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        const { childId, activityId, caregiverNotes, durationSeconds, consentConfirmed } = req.body as {
          childId?: string;
          activityId?: string;
          caregiverNotes?: string;
          durationSeconds?: string;
          consentConfirmed?: string;
        };

        if (consentConfirmed !== 'true') {
          res.status(400).json({
            error: 'Please confirm your consent for private 30-day review storage before uploading.',
          });
          return;
        }
        if (!childId || !activityId) {
          res.status(400).json({ error: 'Child and activity must be specified.' });
          return;
        }
        if (!file || file.size === 0) {
          res.status(400).json({ error: 'Please record or choose a valid non-empty video clip to upload.' });
          return;
        }
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          res.status(413).json({ error: 'Video file exceeds the 50 MB maximum size limit.' });
          return;
        }
        const normalizedMime = file.mimetype.split(';')[0].trim().toLowerCase();
        if (
          !ALLOWED_VIDEO_MIME_TYPES.includes(
            normalizedMime as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]
          )
        ) {
          res.status(400).json({
            error: 'Only MP4, WebM, or MOV video files are accepted.',
          });
          return;
        }
        if (!validateVideoMagicBytes(file.buffer, normalizedMime)) {
          res.status(400).json({
            error:
              'Uploaded file failed binary video verification or does not match its declared format. Please upload a genuine MP4, WebM, or MOV clip.',
          });
          return;
        }

        const rawDuration = Number(durationSeconds);
        if (Number.isFinite(rawDuration) && rawDuration > MAX_VIDEO_DURATION_SECONDS + 5) {
          res.status(400).json({
            error: `Video clips must be ${MAX_VIDEO_DURATION_SECONDS} seconds (2 minutes) or shorter.`,
          });
          return;
        }
        const parsedDuration = Math.max(
          1,
          Math.min(MAX_VIDEO_DURATION_SECONDS, Math.round(Number.isFinite(rawDuration) ? rawDuration : 10))
        );

        const safeNotes =
          typeof caregiverNotes === 'string' ? caregiverNotes.trim().slice(0, 600) : null;

        const child = repo.findChildByIdForParent(childId, req.authUser!.id);
        if (!child) {
          res.status(404).json({ error: 'Child profile not found.' });
          return;
        }
        const activity = repo.getActivityDetail(activityId);
        if (!activity || activity.status !== 'published') {
          res.status(404).json({ error: 'Activity not found.' });
          return;
        }

        const ext = normalizedMime === 'video/mp4' ? 'mp4' : normalizedMime === 'video/quicktime' ? 'mov' : 'webm';
        const storageKey = await storage.saveBuffer(file.buffer, ext);
        const storageStatus = storage.getStorageStatus();

        const consentRecord = repo.recordUserConsent(
          req.authUser!.id,
          'video_processing',
          hashIp(req.ip || 'unknown')
        );

        const completion = repo.upsertActivityCompletion({
          childId: child.id,
          activityId: activity.id,
          status: 'submitted_for_review',
          caregiverNotes: safeNotes,
        });

        const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const submission = repo.createVideoSubmission({
          completionId: completion.id,
          parentUserId: req.authUser!.id,
          childId: child.id,
          activityId: activity.id,
          activityVersion: activity.version,
          storageKey,
          storageProvider: storageStatus.mode,
          consentRecordId: consentRecord.id,
          mimeType: normalizedMime,
          fileSizeBytes: file.size,
          durationSeconds: parsedDuration,
          caregiverNotes: safeNotes,
          expiresAt,
        });

        res.status(201).json({ submission, storageStatus });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save video submission.';
        res.status(500).json({ error: message });
      }
    }
  );

  router.get(
    '/submissions/:id/stream-token',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const sub = repo.findSubmissionRawById(req.params.id);
      if (!sub) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }

      // Strict RBAC ownership / assignment enforcement
      const reviewerAssignedElsewhere =
        user.role === 'reviewer' &&
        Boolean(sub.assigned_reviewer_id) &&
        sub.assigned_reviewer_id !== user.id &&
        sub.review_status === 'in_review';

      const allowed =
        (user.role === 'parent' && sub.parent_user_id === user.id) ||
        (user.role === 'reviewer' && !reviewerAssignedElsewhere) ||
        user.role === 'admin';

      if (!allowed) {
        res.status(403).json({
          error: reviewerAssignedElsewhere
            ? 'This submission is actively assigned to another reviewer.'
            : 'Not authorized to access this video.',
        });
        return;
      }

      if (!sub.storage_key || sub.deleted_at || !storage.exists(sub.storage_key)) {
        res.status(410).json({
          error: 'This video is no longer stored in the private vault.',
          deletionReason: sub.deletion_reason || 'deleted',
        });
        return;
      }

      const { token, expiresAt } = signVideoStreamToken(user.id, user.role, sub.id);
      res.json({
        streamUrl: `/api/v1/media/stream/${sub.id}?token=${encodeURIComponent(token)}`,
        expiresAt,
      });
    }
  );

  router.get('/media/stream/:submissionId', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const verified = verifyVideoStreamToken(token);
    if (!verified || verified.submissionId !== req.params.submissionId) {
      res.status(401).json({ error: 'Invalid or expired video stream token.' });
      return;
    }

    const sub = repo.findSubmissionRawById(req.params.submissionId);
    if (!sub || !sub.storage_key || sub.deleted_at || !storage.exists(sub.storage_key)) {
      res.status(410).json({ error: 'Video file has been deleted.' });
      return;
    }

    // Re-check active user status and RBAC / assignment isolation at streaming time
    const actor = repo.findUserById(verified.userId);
    if (!actor || !actor.isActive) {
      res.status(401).json({ error: 'Account is no longer active.' });
      return;
    }
    if (verified.role === 'parent' && sub.parent_user_id !== verified.userId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (
      verified.role === 'reviewer' &&
      sub.assigned_reviewer_id &&
      sub.assigned_reviewer_id !== verified.userId &&
      sub.review_status === 'in_review'
    ) {
      res.status(403).json({ error: 'This submission is actively assigned to another reviewer.' });
      return;
    }

    const fileSize = storage.getSize(sub.storage_key);
    const range = req.headers.range;

    // Log first stream open (not every subsequent range chunk)
    if (!range || range.startsWith('bytes=0-')) {
      repo.logMediaAudit(verified.userId, verified.role, sub.id, 'stream');
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : Math.min(start + 1024 * 1024, fileSize - 1);
      if (Number.isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(end - start + 1));
      res.setHeader('Content-Type', sub.mime_type);
      storage.openReadStream(sub.storage_key, start, end).pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(fileSize));
    res.setHeader('Content-Type', sub.mime_type);
    storage.openReadStream(sub.storage_key).pipe(res);
  });

  router.delete(
    '/submissions/:id/video',
    requireAuth,
    requireRole('parent', 'admin'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const sub = repo.findSubmissionRawById(req.params.id);
      if (!sub) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      if (user.role === 'parent' && sub.parent_user_id !== user.id) {
        res.status(403).json({ error: 'You can only delete your own videos.' });
        return;
      }
      if (sub.storage_key) {
        await storage.deleteObject(sub.storage_key);
      }
      const reason = user.role === 'admin' ? 'admin_deleted' : 'parent_deleted';
      repo.markSubmissionVideoDeleted(sub.id, reason);
      repo.logMediaAudit(
        user.id,
        user.role,
        sub.id,
        user.role === 'admin' ? 'admin_delete' : 'parent_delete'
      );
      res.json({ ok: true, deletedAt: new Date().toISOString() });
    }
  );

  // ======================== REVIEWER WORKBENCH ========================

  router.get(
    '/reviewer/queue',
    requireAuth,
    requireRole('reviewer', 'admin'),
    (req: AuthenticatedRequest, res) => {
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      const ageGroupSlug =
        typeof req.query.ageGroupSlug === 'string' ? req.query.ageGroupSlug : 'all';
      const summary = repo.getReviewerDashboardSummary();
      const queue = repo.listReviewerQueue({
        status: status as 'queued' | 'in_review' | 'reviewed' | 'resubmit_requested' | 'all',
        ageGroupSlug,
      });
      res.json({ summary, queue });
    }
  );

  router.post(
    '/reviewer/submissions/:id/claim',
    requireAuth,
    requireRole('reviewer'),
    (req: AuthenticatedRequest, res) => {
      const claimed = repo.claimSubmissionForReviewer(req.params.id, req.authUser!.id);
      if (!claimed) {
        res.status(409).json({
          error: 'This submission is already assigned to another reviewer or completed.',
        });
        return;
      }
      const detail = repo.getReviewerSubmissionDetail(req.params.id);
      res.json(detail);
    }
  );

  router.get(
    '/reviewer/submissions/:id',
    requireAuth,
    requireRole('reviewer', 'admin'),
    (req: AuthenticatedRequest, res) => {
      const rawSub = repo.findSubmissionRawById(req.params.id);
      if (!rawSub) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      if (
        req.authUser!.role === 'reviewer' &&
        rawSub.assigned_reviewer_id &&
        rawSub.assigned_reviewer_id !== req.authUser!.id &&
        rawSub.review_status === 'in_review'
      ) {
        res.status(403).json({
          error: 'This submission is actively assigned to another reviewer.',
        });
        return;
      }
      const detail = repo.getReviewerSubmissionDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      res.json(detail);
    }
  );

  router.post(
    '/reviewer/submissions/:id/review',
    requireAuth,
    requireRole('reviewer'),
    (req: AuthenticatedRequest, res) => {
      const rawSub = repo.findSubmissionRawById(req.params.id);
      if (!rawSub) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      if (
        rawSub.assigned_reviewer_id &&
        rawSub.assigned_reviewer_id !== req.authUser!.id &&
        rawSub.review_status === 'in_review'
      ) {
        res.status(403).json({
          error: 'This submission is actively assigned to another reviewer.',
        });
        return;
      }

      const parsed = reviewSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review input.' });
        return;
      }
      try {
        const review = repo.submitRubricReview({
          submissionId: req.params.id,
          reviewerUserId: req.authUser!.id,
          mode: parsed.data.mode,
          strengthsNote: parsed.data.strengthsNote,
          coachingTip: parsed.data.coachingTip,
          reviewerComments: parsed.data.reviewerComments,
          notAssessableReason: parsed.data.notAssessableReason,
          criterionRatings: parsed.data.criterionRatings,
        });
        const detail = repo.getReviewerSubmissionDetail(req.params.id);
        res.status(201).json({ review, detail });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to submit review.';
        res.status(400).json({ error: msg });
      }
    }
  );

  router.post(
    '/reviewer/submissions/:id/request-changes',
    requireAuth,
    requireRole('reviewer'),
    (req: AuthenticatedRequest, res) => {
      const rawSub = repo.findSubmissionRawById(req.params.id);
      if (!rawSub) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      if (
        rawSub.assigned_reviewer_id &&
        rawSub.assigned_reviewer_id !== req.authUser!.id &&
        rawSub.review_status === 'in_review'
      ) {
        res.status(403).json({
          error: 'This submission is actively assigned to another reviewer.',
        });
        return;
      }

      const schema = z.object({
        note: z
          .string()
          .min(10, 'Please share a clear, gentle explanation of what to re-record.')
          .max(600),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid note.' });
        return;
      }
      const updated = repo.requestSubmissionChanges(
        req.params.id,
        req.authUser!.id,
        parsed.data.note
      );
      if (!updated) {
        res.status(409).json({
          error:
            'Could not request changes for this submission (it may already be reviewed, deleted, or claimed by another reviewer).',
        });
        return;
      }
      const detail = repo.getReviewerSubmissionDetail(req.params.id);
      res.json({ ok: true, detail });
    }
  );

  // ======================== ADMIN CURRICULUM, PLANS, USERS & AUDIT ========================

  router.get('/admin/overview', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(repo.getAdminOverview(retentionWorker.lastSweepAt));
  });

  // --- Age Groups ---
  router.get('/admin/age-groups', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ ageGroups: repo.listAdminAgeGroups() });
  });

  router.post(
    '/admin/age-groups',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = ageGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid age group payload.' });
        return;
      }
      try {
        const ageGroup = repo.saveAgeGroup(req.authUser!.id, parsed.data);
        res.status(201).json({ ageGroup });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Could not create age group.' });
      }
    }
  );

  router.put(
    '/admin/age-groups/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = ageGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid age group payload.' });
        return;
      }
      try {
        const ageGroup = repo.saveAgeGroup(req.authUser!.id, { ...parsed.data, id: req.params.id });
        res.json({ ageGroup });
      } catch (err: any) {
        res.status(404).json({ error: err.message || 'Age group not found.' });
      }
    }
  );

  // --- Domains ---
  router.get('/admin/domains', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ domains: repo.listAdminDomains() });
  });

  router.post(
    '/admin/domains',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = domainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid domain payload.' });
        return;
      }
      try {
        const domain = repo.saveDomain(req.authUser!.id, parsed.data);
        res.status(201).json({ domain });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Could not create domain.' });
      }
    }
  );

  router.put(
    '/admin/domains/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = domainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid domain payload.' });
        return;
      }
      try {
        const domain = repo.saveDomain(req.authUser!.id, { ...parsed.data, id: req.params.id });
        res.json({ domain });
      } catch (err: any) {
        res.status(404).json({ error: err.message || 'Domain not found.' });
      }
    }
  );

  // --- Activities ---
  router.get('/admin/activities', requireAuth, requireRole('admin'), (req, res) => {
    const ageGroupId = typeof req.query.ageGroupId === 'string' ? req.query.ageGroupId : undefined;
    const domainId = typeof req.query.domainId === 'string' ? req.query.domainId : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as ActivityStatus) : undefined;
    res.json({ activities: repo.listActivities({ ageGroupId, domainId, status }) });
  });

  router.get('/admin/activities/:id', requireAuth, requireRole('admin'), (req, res) => {
    const activity = repo.getActivityDetail(req.params.id);
    if (!activity) {
      res.status(404).json({ error: 'Activity not found.' });
      return;
    }
    res.json({ activity });
  });

  router.get('/admin/activities/:id/versions', requireAuth, requireRole('admin'), (req, res) => {
    const activity = repo.getActivityDetail(req.params.id);
    if (!activity) {
      res.status(404).json({ error: 'Activity not found.' });
      return;
    }
    const versions = repo.listActivityVersions(req.params.id);
    res.json({ versions });
  });

  router.post(
    '/admin/activities',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = adminActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid activity fields.' });
        return;
      }
      const weightSum = parsed.data.rubricCriteria.reduce((acc, c) => acc + c.weightPoints, 0);
      if (weightSum !== 100) {
        res.status(400).json({
          error: `Rubric criteria weights must sum to 100 points (currently ${weightSum}).`,
        });
        return;
      }
      const activity = repo.saveActivity(req.authUser!.id, parsed.data);
      res.status(201).json({ activity });
    }
  );

  router.put(
    '/admin/activities/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = adminActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid activity fields.' });
        return;
      }
      const weightSum = parsed.data.rubricCriteria.reduce((acc, c) => acc + c.weightPoints, 0);
      if (weightSum !== 100) {
        res.status(400).json({
          error: `Rubric criteria weights must sum to 100 points (currently ${weightSum}).`,
        });
        return;
      }
      try {
        const activity = repo.saveActivity(req.authUser!.id, {
          ...parsed.data,
          id: req.params.id,
        });
        res.json({ activity });
      } catch (err: any) {
        res.status(404).json({ error: err.message || 'Activity not found.' });
      }
    }
  );

  router.patch(
    '/admin/activities/:id/status',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const statusSchema = z.object({
        status: z.enum(['draft', 'published', 'archived']),
      });
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Valid status (draft, published, or archived) is required.' });
        return;
      }
      const updated = repo.updateActivityStatus(req.authUser!.id, req.params.id, parsed.data.status);
      if (!updated) {
        res.status(404).json({ error: 'Activity not found.' });
        return;
      }
      res.json({ activity: updated });
    }
  );

  router.delete(
    '/admin/activities/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      try {
        const deleted = repo.deleteActivity(req.params.id, req.authUser!.id);
        if (!deleted) {
          res.status(404).json({ error: 'Activity not found.' });
          return;
        }
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Could not delete activity.' });
      }
    }
  );

  // --- Daily Plans ---
  router.get('/admin/daily-plans', requireAuth, requireRole('admin'), (req, res) => {
    const ageGroupId = typeof req.query.ageGroupId === 'string' ? req.query.ageGroupId : 'ag_6-9m';
    const plans = repo.listDailyPlansForAgeGroup(ageGroupId);
    const activities = repo.listActivities({ ageGroupId, status: 'published' });
    res.json({ plans, activities });
  });

  router.put(
    '/admin/daily-plans',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = dailyPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid daily plan data.' });
        return;
      }
      const uniqueActivityIds = new Set(parsed.data.activityIds);
      if (uniqueActivityIds.size !== parsed.data.activityIds.length) {
        res.status(400).json({
          error: 'A daily plan cannot include the same activity more than once.',
        });
        return;
      }
      for (const actId of uniqueActivityIds) {
        const act = repo.getActivityDetail(actId);
        if (!act || act.ageGroupId !== parsed.data.ageGroupId) {
          res.status(400).json({
            error: 'All activities in a daily plan must belong to the selected age group.',
          });
          return;
        }
      }
      repo.upsertDailyPlan(parsed.data, req.authUser!.id);
      res.json({ plans: repo.listDailyPlansForAgeGroup(parsed.data.ageGroupId) });
    }
  );

  router.delete(
    '/admin/daily-plans/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const deleted = repo.deleteDailyPlan(req.params.id, req.authUser!.id);
      if (!deleted) {
        res.status(404).json({ error: 'Daily plan not found.' });
        return;
      }
      res.json({ ok: true });
    }
  );

  // --- Reviewers ---
  router.get('/admin/reviewers', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ reviewers: repo.listAdminReviewers() });
  });

  router.post(
    '/admin/reviewers',
    requireAuth,
    requireRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      const parsed = createReviewerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reviewer account data.' });
        return;
      }
      const existing = repo.findUserByEmail(parsed.data.email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }
      const passwordHash = await hashPassword(parsed.data.password);
      const reviewer = repo.createReviewerAccount(req.authUser!.id, {
        ...parsed.data,
        passwordHash,
      });
      res.status(201).json({ reviewer });
    }
  );

  router.patch(
    '/admin/reviewers/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const parsed = updateReviewerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reviewer update data.' });
        return;
      }
      const reviewer = repo.updateReviewerPermissions(req.authUser!.id, req.params.id, parsed.data);
      if (!reviewer) {
        res.status(404).json({ error: 'Reviewer not found.' });
        return;
      }
      res.json({ reviewer });
    }
  );

  // --- Submissions ---
  router.get('/admin/submissions', requireAuth, requireRole('admin'), (req, res) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as SubmissionReviewStatus | 'all') : undefined;
    const reviewerId = typeof req.query.reviewerId === 'string' ? req.query.reviewerId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json({ submissions: repo.listAdminSubmissions({ status, reviewerId, search }) });
  });

  router.patch(
    '/admin/submissions/:id/assign',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const schema = z.object({
        reviewerUserId: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid reviewer assignment payload.' });
        return;
      }
      const submission = repo.assignSubmissionReviewer(
        req.authUser!.id,
        req.params.id,
        parsed.data.reviewerUserId ?? null
      );
      if (!submission) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      res.json({ submission });
    }
  );

  // --- Users ---
  router.get('/admin/users', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ users: repo.listAdminUsers() });
  });

  router.patch(
    '/admin/users/:id/role',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res) => {
      const schema = z.object({
        role: z.enum(['parent', 'reviewer', 'admin']).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid role or status update.' });
        return;
      }
      if (req.params.id === req.authUser!.id && parsed.data.isActive === false) {
        res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
        return;
      }
      try {
        const updated = repo.updateUserRoleAndStatus(req.params.id, parsed.data, req.authUser!.id);
        if (!updated) {
          res.status(404).json({ error: 'User not found.' });
          return;
        }
        res.json({ user: updated });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Could not update user account.' });
      }
    }
  );

  // --- Unified Audit Logs & Retention ---
  router.get('/admin/audit-logs', requireAuth, requireRole('admin'), (req, res) => {
    const category = typeof req.query.category === 'string' ? (req.query.category as UnifiedAuditCategory | 'all') : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json({
      logs: repo.listUnifiedAuditLogs({ category, limit }),
      lastRetentionSweepAt: retentionWorker.lastSweepAt,
    });
  });

  router.post('/admin/retention/run', requireAuth, requireRole('admin'), async (_req, res) => {
    const result = await retentionWorker.runSweep();
    res.json(result);
  });

  return router;
}
