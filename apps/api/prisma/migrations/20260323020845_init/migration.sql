-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('Event', 'Routine', 'LifeMemory', 'QuickNote', 'Person');

-- CreateEnum
CREATE TYPE "Horizon" AS ENUM ('Today', 'ThisWeek', 'Always');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('active', 'archived', 'expired', 'flagged');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('patient', 'caregiver');

-- CreateEnum
CREATE TYPE "CareCircleRole" AS ENUM ('admin', 'contributor', 'viewer');

-- CreateEnum
CREATE TYPE "ComplexityLevel" AS ENUM ('full', 'simplified', 'audio_only');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('appointment', 'medication', 'routine', 'day_before');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'delivered', 'acknowledged', 'escalated');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "cognitoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "briefingTime" TEXT NOT NULL DEFAULT '07:30',
    "speechRate" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "voiceId" TEXT,
    "complexityLevel" "ComplexityLevel" NOT NULL DEFAULT 'full',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "autoPlayAudio" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "horizon" "Horizon" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "attributionLabel" TEXT,
    "status" "MemoryStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryPerson" (
    "memoryId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "MemoryPerson_pkey" PRIMARY KEY ("memoryId","personId")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fullText" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioS3Key" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "audioPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareCircle" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "role" "CareCircleRole" NOT NULL DEFAULT 'contributor',
    "inviteToken" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareCircle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceType" TEXT,
    "actorId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cognitoId_key" ON "User"("cognitoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_cognitoId_idx" ON "User"("cognitoId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Memory_userId_status_idx" ON "Memory"("userId", "status");

-- CreateIndex
CREATE INDEX "Memory_userId_horizon_status_idx" ON "Memory"("userId", "horizon", "status");

-- CreateIndex
CREATE INDEX "Memory_userId_type_status_idx" ON "Memory"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "Memory_expiresAt_idx" ON "Memory"("expiresAt");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "Briefing_userId_date_idx" ON "Briefing"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_userId_date_key" ON "Briefing"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CareCircle_inviteToken_key" ON "CareCircle"("inviteToken");

-- CreateIndex
CREATE INDEX "CareCircle_caregiverId_idx" ON "CareCircle"("caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "CareCircle_patientId_caregiverId_key" ON "CareCircle"("patientId", "caregiverId");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_triggerAt_idx" ON "Reminder"("userId", "status", "triggerAt");

-- CreateIndex
CREATE INDEX "Reminder_triggerAt_status_idx" ON "Reminder"("triggerAt", "status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPerson" ADD CONSTRAINT "MemoryPerson_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPerson" ADD CONSTRAINT "MemoryPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCircle" ADD CONSTRAINT "CareCircle_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCircle" ADD CONSTRAINT "CareCircle_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
