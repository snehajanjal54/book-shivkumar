-- Run this in MySQL Workbench on "Local instance MySQL80" (root@localhost:3306).
-- Query > Execute (All or Selection).

CREATE DATABASE IF NOT EXISTS selfish_readers
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE selfish_readers;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(32) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  address VARCHAR(500) NOT NULL,
  landmark VARCHAR(160) NULL,
  city VARCHAR(80) NOT NULL,
  taluka VARCHAR(80) NULL,
  district VARCHAR(80) NOT NULL,
  pin_code CHAR(6) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  payment_mode VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  razorpay_order_id VARCHAR(64) NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  shipfigo_order_id VARCHAR(64) NULL,
  awb_code VARCHAR(64) NULL,
  ship_status VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (order_code),
  UNIQUE KEY uq_orders_rzp (razorpay_order_id)
);
