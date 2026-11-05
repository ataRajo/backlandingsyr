-- Chat module tables
CREATE TABLE `chat_conversations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `created_by_user_id` BIGINT UNSIGNED NULL,
  `assigned_admin_id` BIGINT UNSIGNED NULL,
  `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  `last_message_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `chat_conversations_customer_id_status_index` (`customer_id`, `status`),
  INDEX `chat_conversations_created_by_user_id_foreign` (`created_by_user_id`),
  INDEX `chat_conversations_assigned_admin_id_foreign` (`assigned_admin_id`),
  INDEX `chat_conversations_last_message_at_index` (`last_message_at`),
  CONSTRAINT `chat_conversations_customer_id_foreign`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chat_conversations_created_by_user_id_foreign`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chat_conversations_assigned_admin_id_foreign`
    FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `sender_type` ENUM('admin', 'customer') NOT NULL,
  `sender_user_id` BIGINT UNSIGNED NULL,
  `sender_customer_id` BIGINT UNSIGNED NULL,
  `content` LONGTEXT NOT NULL,
  `metadata` LONGTEXT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `chat_messages_conversation_id_created_at_index` (`conversation_id`, `created_at`),
  INDEX `chat_messages_sender_user_id_foreign` (`sender_user_id`),
  INDEX `chat_messages_sender_customer_id_foreign` (`sender_customer_id`),
  CONSTRAINT `chat_messages_conversation_id_foreign`
    FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chat_messages_sender_user_id_foreign`
    FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chat_messages_sender_customer_id_foreign`
    FOREIGN KEY (`sender_customer_id`) REFERENCES `customers` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;