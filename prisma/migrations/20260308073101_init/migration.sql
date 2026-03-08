-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qqNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qqNumber" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Certificate_qqNumber_idx" ON "Certificate"("qqNumber");

-- CreateIndex
CREATE INDEX "VerificationCode_qqNumber_idx" ON "VerificationCode"("qqNumber");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
