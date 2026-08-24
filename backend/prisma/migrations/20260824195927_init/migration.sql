-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `baseCurrency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `fiscalYearStartMonth` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'ACCOUNTANT', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_orgId_idx`(`orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `subtype` VARCHAR(191) NULL,
    `normalBalance` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Account_orgId_idx`(`orgId`),
    UNIQUE INDEX `Account_orgId_code_key`(`orgId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `memo` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'POSTED', 'VOID') NOT NULL DEFAULT 'POSTED',
    `source` ENUM('MANUAL', 'INVOICE', 'BILL', 'PAYMENT') NOT NULL DEFAULT 'MANUAL',
    `sourceId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JournalEntry_orgId_date_idx`(`orgId`, `date`),
    INDEX `JournalEntry_source_sourceId_idx`(`source`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,

    INDEX `JournalLine_entryId_idx`(`entryId`),
    INDEX `JournalLine_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_orgId_idx`(`orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amountPaid` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `journalEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Invoice_orgId_status_idx`(`orgId`, `status`),
    INDEX `Invoice_customerId_idx`(`customerId`),
    UNIQUE INDEX `Invoice_orgId_number_key`(`orgId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxRatePercent` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `incomeAccountId` VARCHAR(191) NOT NULL,

    INDEX `InvoiceLine_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Vendor_orgId_idx`(`orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bill` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `billDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'PARTIAL', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `amountPaid` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `journalEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Bill_orgId_status_idx`(`orgId`, `status`),
    INDEX `Bill_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `Bill_orgId_number_key`(`orgId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillLine` (
    `id` VARCHAR(191) NOT NULL,
    `billId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxRatePercent` DECIMAL(9, 4) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `expenseAccountId` VARCHAR(191) NOT NULL,

    INDEX `BillLine_billId_idx`(`billId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `type` ENUM('RECEIVED', 'MADE') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `method` VARCHAR(191) NULL,
    `bankAccountId` VARCHAR(191) NOT NULL,
    `partyType` ENUM('CUSTOMER', 'VENDOR') NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `journalEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_orgId_type_idx`(`orgId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `billId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,

    INDEX `PaymentAllocation_paymentId_idx`(`paymentId`),
    INDEX `PaymentAllocation_invoiceId_idx`(`invoiceId`),
    INDEX `PaymentAllocation_billId_idx`(`billId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaxRate` (
    `id` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ratePercent` DECIMAL(9, 4) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaxRate_orgId_idx`(`orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_incomeAccountId_fkey` FOREIGN KEY (`incomeAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillLine` ADD CONSTRAINT `BillLine_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillLine` ADD CONSTRAINT `BillLine_expenseAccountId_fkey` FOREIGN KEY (`expenseAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaxRate` ADD CONSTRAINT `TaxRate_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaxRate` ADD CONSTRAINT `TaxRate_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
