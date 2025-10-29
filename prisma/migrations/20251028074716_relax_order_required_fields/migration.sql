-- AlterTable
ALTER TABLE `orders` MODIFY `shopify_order_id` VARCHAR(191) NULL,
    MODIFY `order_number` INTEGER NULL,
    MODIFY `ordered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
