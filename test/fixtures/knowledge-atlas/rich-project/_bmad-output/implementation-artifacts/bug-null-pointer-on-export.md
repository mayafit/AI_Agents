---
title: "Bug: Null pointer on export"
status: done
---

# Bug: Null pointer on export

Status: done

## Description

A null pointer exception occurs when exporting an empty dataset.
This is related to FR102 (Data Export).

## Steps to Reproduce

1. Create an empty dataset
2. Click Export
3. Select CSV format

## Root Cause

The export handler did not check for null dataset before iterating.

## Fix

Added null check in the CSV export handler.

## Addressed by: Story 2.1
