/**
 * ImpactHub - Zod Request Validation Schemas
 * Strict validation and sanitization for all REST API endpoints
 */

const { z } = require('zod');

// Password policy: Min 8 chars, at least 1 letter and 1 number
const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number');

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80).trim(),
  email: z.string().trim().toLowerCase().pipe(z.string().email('Please provide a valid email address')),
  password: passwordPolicy,
  confirmPassword: z.string().optional(),
  role: z.enum(['volunteer', 'donor', 'ngo'], {
    errorMap: () => ({ message: 'Role must be volunteer, donor, or ngo. Admin cannot be chosen.' })
  }),
  orgName: z.string().optional(),
  registrationNumber: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  cause: z.string().optional(),
  phone: z.string().optional(),
  termsConsent: z.boolean().optional().default(true)
}).refine((data) => {
  if (data.confirmPassword && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email('Valid email required')),
  password: z.string().min(1, 'Password required'),
  rememberMe: z.boolean().optional().default(false)
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email('Valid email required'))
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid or missing reset token'),
  password: passwordPolicy
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: passwordPolicy
});

const changeEmailSchema = z.object({
  password: z.string().min(1, 'Password confirmation required'),
  newEmail: z.string().trim().toLowerCase().pipe(z.string().email('Valid new email address required'))
});

const campaignSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  category: z.string().min(2),
  goalAmount: z.number().positive('Goal amount must be positive').min(100),
  deadline: z.string().optional().default(() => new Date(Date.now() + 86400000 * 30).toISOString()),
  location: z.string().optional().default('Pune, Maharashtra'),
  images: z.array(z.string()).optional()
});

const driveSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  category: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  startsAt: z.string(), // ISO date
  endsAt: z.string(),
  slots: z.number().int().positive().min(1),
  requiredSkills: z.string().optional(),
  image: z.string().optional()
});

const driveJoinSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().min(10, 'Valid 10-digit phone required'),
  skills: z.string().optional(),
  availability: z.string().optional()
});

const donationOrderSchema = z.object({
  campaignId: z.string().min(1),
  amount: z.number().positive().min(10, 'Minimum contribution is ₹10'),
  donorName: z.string().min(2),
  donorEmail: z.string().email().toLowerCase().trim(),
  donorPhone: z.string().optional(),
  anonymous: z.boolean().optional().default(false),
  message: z.string().max(500).optional()
});

const donationVerifySchema = z.object({
  donationId: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1)
});

const markAttendanceSchema = z.object({
  status: z.enum(['ATTENDED', 'NO_SHOW', 'CANCELLED']),
  hoursConfirmed: z.number().min(0).max(24).optional().default(4)
});

const ngoVerificationSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().optional(),
  adminPassword: z.string().optional() // required for sensitive admin approval
});

const suspendUserSchema = z.object({
  isSuspended: z.boolean(),
  reason: z.string().optional(),
  adminPassword: z.string().optional()
});

const contactMessageSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase().trim(),
  subject: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters')
});

const reportSchema = z.object({
  entityType: z.enum(['CAMPAIGN', 'DRIVE', 'NGO']),
  entityId: z.string().min(1),
  reason: z.string().min(5, 'Please provide a clear reason for reporting (min 5 characters)')
});

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().optional(),
  skills: z.string().optional(),
  interests: z.string().optional(),
  availability: z.string().optional(),
  optOutLeaderboard: z.boolean().optional()
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
  campaignSchema,
  driveSchema,
  driveJoinSchema,
  donationOrderSchema,
  donationVerifySchema,
  markAttendanceSchema,
  ngoVerificationSchema,
  suspendUserSchema,
  contactMessageSchema,
  reportSchema,
  profileUpdateSchema
};
