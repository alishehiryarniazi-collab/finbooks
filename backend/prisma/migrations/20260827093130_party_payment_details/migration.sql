-- AlterTable
ALTER TABLE `customer` ADD COLUMN `accountNumber` VARCHAR(191) NULL,
    ADD COLUMN `accountTitle` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `iban` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `raastId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `vendor` ADD COLUMN `accountNumber` VARCHAR(191) NULL,
    ADD COLUMN `accountTitle` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `iban` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `raastId` VARCHAR(191) NULL;
