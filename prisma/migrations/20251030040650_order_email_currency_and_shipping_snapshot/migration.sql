-- AlterTable
ALTER TABLE `order_items` MODIFY `image_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'JPY',
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `shipping_address_1` VARCHAR(191) NULL,
    ADD COLUMN `shipping_address_2` VARCHAR(191) NULL,
    ADD COLUMN `shipping_name` VARCHAR(191) NULL,
    ADD COLUMN `shipping_phone` VARCHAR(191) NULL,
    ADD COLUMN `shipping_postal_code` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `orders_email_idx` ON `orders`(`email`);
