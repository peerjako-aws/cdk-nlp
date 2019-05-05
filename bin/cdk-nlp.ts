#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { CdkNlpStack } from '../lib/cdk-nlp-stack';
import { SentimentStack } from '../lib/sentiment-stack';

const app = new cdk.App();
new CdkNlpStack(app, 'CdkNlpStack');

new SentimentStack(app, 'SentimentStack');
