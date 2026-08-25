-- AlterTable
ALTER TABLE `organization` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `logoDataUrl` TEXT NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL;
