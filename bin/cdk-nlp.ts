#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { CdkNlpStack } from '../lib/cdk-nlp-stack';

const app = new cdk.App();
new CdkNlpStack(app, 'CdkNlpStack');
