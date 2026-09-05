-- CreateTable
CREATE TABLE `Estimate` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `convertedInvoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Estimate_orgId_status_idx`(`orgId`, `status`),
    INDEX `Estimate_customerId_idx`(`customerId`),
    UNIQUE INDEX `Estimate_orgId_number_key`(`orgId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EstimateLine` (
    `id` VARCHAR(191) NOT NULL,
    `estimateId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxRatePercent` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `incomeAccountId` VARCHAR(191) NOT NULL,

    INDEX `EstimateLine_estimateId_idx`(`estimateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Estimate` ADD CONSTRAINT `Estimate_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Estimate` ADD CONSTRAINT `Estimate_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EstimateLine` ADD CONSTRAINT `EstimateLine_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `Estimate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EstimateLine` ADD CONSTRAINT `EstimateLine_incomeAccountId_fkey` FOREIGN KEY (`incomeAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
