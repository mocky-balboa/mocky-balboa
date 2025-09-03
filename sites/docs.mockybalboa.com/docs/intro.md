---
sidebar_position: 1
title: Introduction
---

# Mocky Balboa

Mocky Balboa is a tool that allows you to __fixture http requests across your SSR application directly from your automated test suite__ without having to modify any application code. It's been designed to be used to solve the problem of testing full-stack applications that make HTTP requests on the server before rendering the page. For example Next.js server components.

## Why use Mocky Balboa?

Mocky Balboa has been designed to provide a seamless experience for developers using popular full-stack JavaScript frameworks allowing you to focus on writing your tests without having to worry about the nuances of http request mocking on the server. It does this without requiring any changes to your application code. No more mock http servers, or branching logic to handle different environments.

In return you can gain more confidence in your tests, knowing you are testing against the version of your application that is going to be deployed to production.

## When not to use Mocky Balboa

The only reason to use Mocky Balboa is when you need to mock http requests on the server. If you are only doing static rendering without any server-side network requests, or working on a client-side only application, you do not need to use Mocky Balboa.

Instead I'd recommend using your browser automation framework's built-in mocking capabilities.

## Core concepts

### Server

The server integration is responsible for working inside the same process as your application server. It intercepts all outbound http requests and interacts with the __client__ to determine the behaviour of the requests at runtime.

### Client

The client integration is responsible for working inside your __browser automation framework__. It receives requests from the server and allows you to handle them directly within your test suite. It also intercepts client-side http requests on the same API allowing for a seamless experience when mocking requests anywhere in your stack.

## Similar solutions

- [@playwright/ssr](https://github.com/playwright-community/ssr) no longer active
- [request-mocking-protocol](https://github.com/vitalets/request-mocking-protocol)
