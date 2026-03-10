-- CreateTable
CREATE TABLE "CertificateTracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qqNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CertificateTracking_qqNumber_idx" ON "CertificateTracking"("qqNumber");
