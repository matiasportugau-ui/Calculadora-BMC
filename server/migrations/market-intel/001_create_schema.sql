-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 001 — Create isolated schema bmc_market_intel
-- NOTE: Strictly isolated from bmc_price_monitor. Cross-schema joins prohibited
--       without an explicit justifying comment.

CREATE SCHEMA IF NOT EXISTS bmc_market_intel;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
