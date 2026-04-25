/**
 * 公共 API 配置
 * 包含 Supabase 和 Cloudflare Worker 的访问信息
 */
const SB_URL  = 'https://dibqibhjwoogkbdqsrcc.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYnFpYmhqd29vZ2tiZHFzcmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjMzNDQsImV4cCI6MjA4NzY5OTM0NH0.Wnvd9RC8kTyQQMrZcQvI2AQBoeja0nMbxKxhJwytIbI';
const SB_HDR  = { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + SB_ANON };

const WORKER_URL = 'https://linzefei-word-worker.linzefei174.workers.dev';
