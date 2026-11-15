/**
 * FINTRACK — Struktur Database 14 Sheet Google Sheets (Bagian 7 & 8 Dokumen Rancangan)
 * Setiap tabel operasional menyertakan `user_id` untuk validasi kepemilikan data oleh backend.
 */

const SHEETS_SCHEMA = {
  Users: [
    'user_id', 'name', 'username', 'auth_uid', 'photo_url', 'created_at', 'status'
  ],
  Wallets: [
    'wallet_id', 'user_id', 'wallet_name', 'wallet_type', 'initial_balance', 'current_balance', 'color', 'is_active'
  ],
  Categories: [
    'category_id', 'user_id', 'category_name', 'category_type', 'icon', 'color', 'is_active'
  ],
  Transactions: [
    'transaction_id', 'user_id', 'wallet_id', 'category_id', 'transaction_type', 'amount',
    'transaction_date', 'description', 'transfer_group_id', 'attachment_url',
    'created_at', 'updated_at', 'is_deleted'
  ],
  Budgets: [
    'budget_id', 'user_id', 'category_id', 'month', 'year', 'limit_amount', 'created_at'
  ],
  Savings_Goals: [
    'goal_id', 'user_id', 'goal_name', 'target_amount', 'current_amount', 'start_date', 'target_date', 'status'
  ],
  Savings_Activities: [
    'activity_id', 'user_id', 'goal_id', 'wallet_id', 'activity_type', 'amount', 'activity_date', 'description'
  ],
  Debts: [
    'debt_id', 'user_id', 'debt_type', 'person_name', 'description', 'principal_amount',
    'remaining_amount', 'start_date', 'due_date', 'status'
  ],
  Debt_Payments: [
    'payment_id', 'user_id', 'debt_id', 'wallet_id', 'amount', 'payment_date', 'description'
  ],
  Recurring: [
    'recurring_id', 'user_id', 'wallet_id', 'category_id', 'transaction_type', 'amount',
    'frequency', 'start_date', 'end_date', 'next_execution', 'is_active'
  ],
  Notifications: [
    'notification_id', 'user_id', 'title', 'message', 'notification_type', 'created_at', 'is_read'
  ],
  Settings: [
    'setting_id', 'user_id', 'setting_key', 'setting_value'
  ],
  Receipts: [
    'receipt_id', 'user_id', 'transaction_id', 'merchant_name', 'receipt_date',
    'subtotal', 'tax', 'discount', 'total_amount', 'image_url', 'ai_status', 'created_at'
  ],
  Receipt_Items: [
    'item_id', 'receipt_id', 'user_id', 'item_name', 'quantity', 'unit_price', 'total_price'
  ]
};

module.exports = { SHEETS_SCHEMA };
