# Control-M Smart RCA System - Complete Guide

## 🎯 System Overview

This is a complete AI-powered Root Cause Analysis (RCA) system for Control-M batch jobs that works entirely with **local JSON files** - no real Control-M or ServiceNow API required.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Dashboard (Port 3000)             │
│  - Dashboard with summary metrics                       │
│  - Failed jobs table                                    │
│  - Job detail with RCA                                  │
│  - Add incident form (self-learning KB)                 │
└─────────────