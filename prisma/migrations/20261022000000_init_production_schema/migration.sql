-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'volunteer',
    "baseRole" TEXT NOT NULL DEFAULT 'volunteer',
    "roles" TEXT NOT NULL DEFAULT '["volunteer"]',
    "avatar" TEXT,
    "city" TEXT,
    "bio" TEXT,
    "emailVerifiedAt" DATETIME,
    "emailVerificationToken" TEXT,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationExpires" DATETIME,
    "passwordResetToken" TEXT,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionReason" TEXT,
    "savedCampaigns" TEXT NOT NULL DEFAULT '[]',
    "notificationPreferences" TEXT DEFAULT '{"email":true,"app":true}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NgoProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL DEFAULT 'MH/REG/2026/001',
    "website" TEXT,
    "description" TEXT NOT NULL,
    "cause" TEXT NOT NULL DEFAULT 'Community Development',
    "city" TEXT NOT NULL DEFAULT 'Pune',
    "logo" TEXT,
    "banner" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NgoProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VolunteerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skills" TEXT DEFAULT 'Community Outreach',
    "interests" TEXT DEFAULT 'Environment, Education',
    "availability" TEXT DEFAULT 'Weekends',
    "totalHours" REAL NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'Bronze',
    "optOutLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VolunteerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DonorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalDonated" REAL NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'Supporter',
    "optOutLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DonorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "goalAmount" REAL NOT NULL,
    "raisedAmount" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT NOT NULL DEFAULT 'Pune, Maharashtra',
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "NgoProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 20,
    "registeredCount" INTEGER NOT NULL DEFAULT 0,
    "requiredSkills" TEXT DEFAULT 'Open for all',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "image" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drive_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "NgoProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriveRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driveId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "hoursConfirmed" REAL NOT NULL DEFAULT 0,
    "passCode" TEXT NOT NULL,
    "volunteerName" TEXT,
    "volunteerEmail" TEXT,
    "volunteerPhone" TEXT,
    "skillsShared" TEXT,
    "qrCodeUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DriveRegistration_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriveRegistration_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "donorName" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "donorPhone" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'SUCCEEDED',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "refId" TEXT,
    "reason" TEXT NOT NULL,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "token" TEXT,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actionTaken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT DEFAULT 'General Inquiry',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DispatchedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "NgoProfile_userId_key" ON "NgoProfile"("userId");

-- CreateIndex
CREATE INDEX "NgoProfile_verificationStatus_idx" ON "NgoProfile"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerProfile_userId_key" ON "VolunteerProfile"("userId");

-- CreateIndex
CREATE INDEX "VolunteerProfile_points_idx" ON "VolunteerProfile"("points");

-- CreateIndex
CREATE INDEX "VolunteerProfile_totalHours_idx" ON "VolunteerProfile"("totalHours");

-- CreateIndex
CREATE UNIQUE INDEX "DonorProfile_userId_key" ON "DonorProfile"("userId");

-- CreateIndex
CREATE INDEX "DonorProfile_totalDonated_idx" ON "DonorProfile"("totalDonated");

-- CreateIndex
CREATE INDEX "DonorProfile_tier_idx" ON "DonorProfile"("tier");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_category_idx" ON "Campaign"("category");

-- CreateIndex
CREATE INDEX "Campaign_ngoId_idx" ON "Campaign"("ngoId");

-- CreateIndex
CREATE INDEX "Drive_status_idx" ON "Drive"("status");

-- CreateIndex
CREATE INDEX "Drive_city_idx" ON "Drive"("city");

-- CreateIndex
CREATE INDEX "Drive_category_idx" ON "Drive"("category");

-- CreateIndex
CREATE INDEX "Drive_ngoId_idx" ON "Drive"("ngoId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveRegistration_passCode_key" ON "DriveRegistration"("passCode");

-- CreateIndex
CREATE INDEX "DriveRegistration_volunteerId_idx" ON "DriveRegistration"("volunteerId");

-- CreateIndex
CREATE INDEX "DriveRegistration_status_idx" ON "DriveRegistration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DriveRegistration_driveId_volunteerId_key" ON "DriveRegistration"("driveId", "volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_receiptNo_key" ON "Donation"("receiptNo");

-- CreateIndex
CREATE INDEX "Donation_campaignId_idx" ON "Donation"("campaignId");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "RewardEvent_userId_idx" ON "RewardEvent"("userId");

-- CreateIndex
CREATE INDEX "RewardEvent_type_idx" ON "RewardEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContactMessage_ticketId_key" ON "ContactMessage"("ticketId");

-- CreateIndex
CREATE INDEX "ContactMessage_ticketId_idx" ON "ContactMessage"("ticketId");

-- CreateIndex
CREATE INDEX "DispatchedEmail_to_idx" ON "DispatchedEmail"("to");

-- CreateIndex
CREATE INDEX "DispatchedEmail_sentAt_idx" ON "DispatchedEmail"("sentAt");

