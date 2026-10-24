# SMF-reCAPTCHA

[![GitHub release](https://img.shields.io/github/release/Ezerous/SMF-reCAPTCHA.svg)](https://github.com/Ezerous/SMF-reCAPTCHA/releases)
[![SMF](https://img.shields.io/badge/SMF-1.1.x-blue.svg?style==flat)](https://simplemachines.org)
![Last Commit](https://img.shields.io/github/last-commit/Ezerous/SMF-reCAPTCHA/develop.svg?style=flat)

A package for [SMF](https://www.simplemachines.org/) v1.1.x forums that adds [reCAPTCHA](https://developers.google.com/recaptcha) v3 functionality to the registration page.


## What is reCAPTCHA?

reCAPTCHA is a free service by Google that protects websites from spam and abuse, by using advanced risk analysis techniques to tell humans and bots apart. 
It works in the background, without user interaction, by returning a score for each request, which represents the likelihood that the latter originated from a bot.

## Requirements

This package is intended for SMF v1.1.x forums that run on PHP>=v5.2.

## Usage

After installing the package, navigate to Admin -> Registration -> Settings and set up the newly added section by following the [official instructions](https://developers.google.com/recaptcha/docs/v3).

Use a reCAPTCHA v3 score-based site key and its legacy secret key. The package uses the legacy `SiteVerify` endpoint for compatibility with SMF 1.1.x and third-party integrations. Google currently recommends Enterprise `CreateAssessment` for new custom integrations, but legacy `SiteVerify` remains available for existing integrations.

The verification request is sent when the registration form is submitted, so the token is not generated prematurely and allowed to expire while the user is completing the form. If verification fails, check the SMF error log for the reason and confirm that the server can make HTTPS POST requests to `www.google.com`.
