-- AlterTable
ALTER TABLE `organization` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;
