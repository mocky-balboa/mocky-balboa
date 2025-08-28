---
sidebar_position: 1
title: Introduction
---

# Mocky Balboa

Mocky Balboa is a tool that allows you to __fixture http requests on your server directly from your automated test suite__ without having to modify any application code. It's been designed to be used to solve the problem of testing full-stack applications that make HTTP requests on the server before rendering the page. For example Next.js server components.

## Why use Mocky Balboa?

Mocky Balboa has been designed to provide a seamless experience for developers using popular full-stack JavaScript frameworks allowing you to focus on writing your tests without having to worry about the nuances of http request mocking on the server. It does this without requiring any changes to your application code. No more mock http servers, or branching logic to handle different environments.

In return you can gain more confidence in your tests, knowing you are testing against the version of your application that is going to be deployed to production.

## Core concepts

### Server

The server integration is responsible for working inside the same process as your application server. It intercepts all outbound http requests and interacts with the _client_ to determine the behaviour of the requests at runtime.

### Client

The client integration is responsible for working inside your browser automation framework. It receives requests from the server and allows you to handle them directly within your test suite.
