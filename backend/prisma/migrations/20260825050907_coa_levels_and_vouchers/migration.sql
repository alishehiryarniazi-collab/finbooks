-- AlterTable
ALTER TABLE `account` ADD COLUMN `isPostable` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `journalentry` ADD COLUMN `voucherType` ENUM('JOURNAL', 'DEBIT', 'CREDIT') NOT NULL DEFAULT 'JOURNAL';
