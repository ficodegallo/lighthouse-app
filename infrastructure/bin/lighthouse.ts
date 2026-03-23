#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LighthouseStack } from '../lib/lighthouse-stack';

const app = new cdk.App();

const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
};

new LighthouseStack(app, 'LighthouseStack', {
  env,
  description: 'Lighthouse — AI Memory Companion for Alzheimer\'s patients',
});
